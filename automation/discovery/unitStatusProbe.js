import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { dump } from "js-yaml";
import { config } from "../src/config.js";
import { getAppAccount } from "./appAccount.js";
import { normalizeUnitKey } from "./unitNameKey.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const OUTPUT_TMP_DIR = join(__dirname, "..", "output", ".tmp");
const LAUNCH_APP_SUBFLOW = join(REPO_ROOT, "flows", "subflows", "launch_app.yaml");

/**
 * ĐỌC TÍN HIỆU HOÀN THÀNH CỦA UNIT TRỰC TIẾP TRÊN APP (không phải CMS) - dùng làm fallback vì
 * CMS admin (CMS_ACCESS_TOKEN) không trả tiến độ theo TỪNG học sinh (xem
 * unitStateDetector.js#detectFromCmsFields để biết chi tiết lý do). Module này CHỈ lái
 * Maestro/adb thật + đọc `maestro hierarchy` để trả về TÍN HIỆU THÔ (progress fraction, nhãn
 * nút, enabled/clickable) cho unitStateDetector.js quyết định trạng thái - bản thân module này
 * KHÔNG tự kết luận COMPLETED/NOT_COMPLETED (tách theo đúng yêu cầu UnitStateDetector).
 *
 * CHỈ dùng cho automation/discovery/ (bước chọn Unit trước khi random Lesson), KHÔNG phải
 * Navigation Engine/Runtime của giai đoạn trả lời bài (automation/navigation/,
 * automation/runtime/ - việc khác, không dùng lại code ở đây).
 */

function requireCli(bin, helpArg = "--version") {
  try {
    execFileSync(bin, [helpArg], { encoding: "utf8" });
  } catch {
    throw new Error(
      `Không tìm thấy lệnh "${bin}" - cần cài đặt và có trong PATH để đọc trạng thái Unit trên ` +
        `app thật (unitStatusProbe.js). Xem scripts/run_tests.sh để biết cách cài Maestro.`,
    );
  }
}

function deviceArgs() {
  return config.deviceId ? ["--device", config.deviceId] : [];
}

function adbArgs(...rest) {
  return config.deviceId ? ["-s", config.deviceId, ...rest] : rest;
}

function runMaestroFlow(steps, { label }) {
  mkdirSync(OUTPUT_TMP_DIR, { recursive: true });
  const flowPath = join(OUTPUT_TMP_DIR, `${label}.yaml`);
  const yaml = `appId: \${APP_ID}\n---\n${dump(steps, { lineWidth: -1 })}`;
  writeFileSync(flowPath, yaml, "utf8");
  try {
    const args = [...deviceArgs(), "test", flowPath, "-e", `APP_ID=${config.appId}`];
    execFileSync("maestro", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } finally {
    rmSync(flowPath, { force: true });
  }
}

function dumpHierarchy() {
  const args = [...deviceArgs(), "hierarchy"];
  const raw = execFileSync("maestro", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(raw);
}

function scrollDownOneScreen() {
  // Toạ độ theo màn 1080x2340 (đã xác nhận qua maestro hierarchy trên thiết bị test hiện có) -
  // vuốt dọc giữa màn từ dưới lên trên để scroll DOWN nội dung. Dùng adb input swipe trực tiếp
  // (không qua maestro) vì chỉ cần 1 cử chỉ đơn giản, không cần assertion. duration dài (600ms,
  // thay vì vuốt nhanh) để tránh fling - đã quan sát fling làm quãng scroll mỗi lần không đều.
  execFileSync("adb", adbArgs("shell", "input", "swipe", "540", "1800", "540", "1100", "600"), {
    encoding: "utf8",
  });
  // Chờ list đứng yên hẳn rồi mới dump hierarchy ở lượt lặp tiếp theo - dump ngay sau khi vừa
  // scroll có lúc bắt được frame đang chuyển động, khiến 2 lần dump liên tiếp tình cờ giống
  // nhau (list chưa kịp lộ nội dung mới) -> vòng lặp dừng sớm nhầm là đã hết danh sách.
  execFileSync("sleep", ["0.5"]);
}

function parseTop(bounds) {
  const m = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(bounds ?? "");
  return m ? Number(m[2]) : 0;
}

/**
 * Duyệt hết cây hierarchy, trả về 2 danh sách phẳng (đã sort theo `top` - thứ tự hiển thị trên
 * màn hình): text node (dùng tìm tiêu đề/progress fraction) và Button node (dùng tìm nút hành
 * động của từng card). Nhận diện nút hành động qua `class === "android.widget.Button"` (thuộc
 * tính CẤU TRÚC, đã xác nhận qua maestro hierarchy thật) - KHÔNG qua text hiển thị của nút, vì
 * chữ trên nút chỉ dùng làm tín hiệu PHỤ (xem unitStateDetector.js), không dùng để định vị nút.
 */
function collectCardSignals(tree) {
  const textNodes = [];
  const buttonNodes = [];

  function walk(node) {
    const a = node?.attributes;
    if (a) {
      const text = typeof a.text === "string" ? a.text.trim() : "";
      if (text) textNodes.push({ text, top: parseTop(a.bounds) });
      if (a.class === "android.widget.Button") {
        buttonNodes.push({
          top: parseTop(a.bounds),
          label: (a.accessibilityText || "").trim() || null,
          clickable: a.clickable === "true",
          enabled: a.enabled === "true",
        });
      }
    }
    for (const child of node?.children ?? []) walk(child);
  }
  walk(tree);

  textNodes.sort((a, b) => a.top - b.top);
  buttonNodes.sort((a, b) => a.top - b.top);
  return { textNodes, buttonNodes };
}

const PROGRESS_FRACTION_PATTERN = /^\d+\s*\/\s*\d+$/;

/**
 * Tìm tiêu đề + progress fraction ngay TRÊN 1 Button, dựa vào vị trí (`top`) - không dựa vào
 * text của Button. Card layout đã xác nhận qua `maestro hierarchy` thật: tiêu đề -> "x / y" ->
 * [mô tả, có thể vắng] -> Button - "x / y" luôn nằm NGAY SAU tiêu đề. Vì vậy tìm text node
 * "x / y" gần nhất phía trên Button (không vượt qua Button TRƯỚC đó), rồi lấy text ngay trước
 * nó làm tiêu đề.
 */
function findTitleAndFractionAboveButton(textNodes, buttonTop, previousButtonTop) {
  let fractionIndex = -1;
  for (let i = textNodes.length - 1; i >= 0; i--) {
    const node = textNodes[i];
    if (node.top >= buttonTop) continue;
    if (previousButtonTop !== null && node.top <= previousButtonTop) break;
    if (PROGRESS_FRACTION_PATTERN.test(node.text)) {
      fractionIndex = i;
      break;
    }
  }
  if (fractionIndex <= 0) return { title: null, fractionText: null };
  return { title: textNodes[fractionIndex - 1].text, fractionText: textNodes[fractionIndex].text };
}

/**
 * Đăng nhập + mở app từ đầu - CHỈ chạy 1 LẦN cho cả lượt `npm run discover` (không cần lặp lại
 * cho mỗi Book/Unit random tiếp theo, xem unitCompletion.js) - clearState đảm bảo điểm bắt đầu
 * xác định (không phụ thuộc trạng thái app còn sót từ lần chạy trước).
 */
export function bootstrapAppSession() {
  requireCli("maestro");
  requireCli("adb", "version");
  const { phoneNumber, otpCode } = getAppAccount();

  runMaestroFlow(
    [
      { runFlow: relative(OUTPUT_TMP_DIR, LAUNCH_APP_SUBFLOW) },
      { tapOn: "Nhập số điện thoại" },
      { inputText: phoneNumber },
      { tapOn: "Đăng nhập" },
      { extendedWaitUntil: { visible: { text: "Xác thực OTP" }, timeout: 10000 } },
      { tapOn: { below: "Đổi số điện thoại", above: "Xác nhận" } },
      { inputText: otpCode },
      { tapOn: "Xác nhận" },
      { extendedWaitUntil: { visible: { text: "Vui học" }, timeout: 15000 } },
      { tapOn: "Vui học" },
    ],
    { label: "bootstrap_session" },
  );
}

/**
 * Chuyển đúng Khối (nếu chưa đúng) + mở "Tất cả units" - giả định đã đăng nhập
 * (bootstrapAppSession() đã chạy trước đó trong cùng lượt discover). Gọi lại được nhiều lần
 * cho nhiều Book khác nhau trong 1 lượt random (không đăng nhập lại).
 */
export function openUnitsListForBook(bookName) {
  runMaestroFlow(
    [
      // "Danh sách Units" là 1 sub-screen TOÀN MÀN HÌNH (đã xác nhận qua screenshot thật:
      // không có bottom nav, chỉ có nút "X" đóng ở góc trên trái) - nút chuyển Khối chỉ có
      // trên tab gốc "Vui học". Nếu lần Book TRƯỚC đã mở sub-screen này, phải "back" về tab
      // gốc trước (đã thử tapOn "Vui học" - fail vì text đó không tồn tại trên sub-screen).
      // Dùng "back" (nút Back hệ thống, tương đương bấm "X") chứ không tapOn theo icon vì icon
      // "X" không có text/resource-id để chọn theo selector ổn định.
      // ".*" là bắt buộc - selector "text" của Maestro so khớp FULL regex (đã xác nhận qua lỗi
      // thật: tiêu đề đầy đủ là "Danh sách Units - Khối X", "Danh sách Units" không có ".*" thì
      // KHÔNG khớp, when bị đánh giá false -> bước back bị SKIPPED nhầm).
      {
        runFlow: {
          when: { visible: { text: "Danh sách Units.*" } },
          commands: ["back"],
        },
      },
      {
        runFlow: {
          when: { notVisible: bookName },
          commands: [
            { tapOn: { leftOf: "Chuyển profile" } },
            { extendedWaitUntil: { visible: { text: "Chọn khối" }, timeout: 5000 } },
            { tapOn: bookName },
          ],
        },
      },
      { extendedWaitUntil: { visible: { text: bookName }, timeout: 10000 } },
      { tapOn: "Tất cả units" },
      { extendedWaitUntil: { visible: { text: `Danh sách Units - ${bookName}` }, timeout: 10000 } },
    ],
    { label: "open_units_list" },
  );
  // extendedWaitUntil ở trên chỉ đợi tiêu đề màn hiện ra - phần danh sách Unit bên dưới có thể
  // vẫn đang render/load ảnh (đã xác nhận thật: dump ngay sau khi mở màn có lúc thiếu card đầu
  // danh sách so với dump sau khi đã scroll 1 lần).
  execFileSync("sleep", ["0.8"]);
}

/**
 * Scroll hết "Danh sách Units - <book>" ĐANG MỞ (do openUnitsListForBook() gọi trước đó), dump
 * `maestro hierarchy` mỗi lần scroll, gom TÍN HIỆU THÔ (không kết luận trạng thái) của TỪNG
 * card gặp được. Dừng khi 1 lượt scroll không còn tiết lộ text mới (hết danh sách).
 *
 * @returns {Map<string, {fractionText: string|null, buttonLabel: string|null, buttonClickable: boolean, buttonEnabled: boolean}>}
 *   key đã qua normalizeUnitKey() (unitNameKey.js) - bên gọi phải chuẩn hoá tên Unit từ CMS
 *   bằng CÙNG hàm này trước khi tra Map.
 */
export function scanUnitsListScreen({ maxScrolls = 40 } = {}) {
  const cardsByKey = new Map();
  let previousSnapshotKey = null;

  for (let i = 0; i < maxScrolls; i++) {
    const tree = dumpHierarchy();
    const { textNodes, buttonNodes } = collectCardSignals(tree);

    for (let j = 0; j < buttonNodes.length; j++) {
      const button = buttonNodes[j];
      const previousButtonTop = j > 0 ? buttonNodes[j - 1].top : null;
      const { title, fractionText } = findTitleAndFractionAboveButton(
        textNodes,
        button.top,
        previousButtonTop,
      );
      if (!title) continue;
      cardsByKey.set(normalizeUnitKey(title), {
        fractionText,
        buttonLabel: button.label,
        buttonClickable: button.clickable,
        buttonEnabled: button.enabled,
      });
    }

    const snapshotKey = textNodes.map((n) => n.text).join("␟");
    if (snapshotKey === previousSnapshotKey) break;
    previousSnapshotKey = snapshotKey;
    scrollDownOneScreen();
  }

  return cardsByKey;
}
