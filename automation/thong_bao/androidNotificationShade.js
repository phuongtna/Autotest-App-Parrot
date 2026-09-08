import { execCliSync } from "../src/execCli.js";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Wrapper THUẦN adb (không qua Maestro) để thao tác/đọc Android notification shade + kiểm tra
 * app có đang ở foreground hay không, dùng cho case OS-level "notification xuất hiện ngoài app"
 * (bổ sung TB-01..05 trong flows/app/thong_bao/TEST-CASES.md, các case đó CHỈ verify thông báo
 * bên TRONG app qua icon chuông, không verify được Android notification shade thật).
 *
 * KHÔNG dùng "|"/pipe trong remote shell command (adb shell dumpsys ... | grep ...) - filter
 * luôn ở phía JS: execFileSync (execCliSync) trên Windows với shell:true quote từng phần tử mảng
 * args riêng biệt trước khi giao cho cmd.exe, "|" truyền như vậy sẽ bị coi là 1 ký tự literal
 * trong 1 argument (không phải operator của cmd.exe LẪN không phải operator của remote shell trên
 * thiết bị, vì mỗi phần tử mảng args đến `adb` dưới dạng 1 tham số CLI riêng, không phải 1 chuỗi
 * lệnh duy nhất) - tránh toàn bộ vấn đề quoting 2 lớp (host Windows + remote Android shell) bằng
 * cách luôn gọi dumpsys/uiautomator KHÔNG lọc, rồi filter bằng regex JS ở phía Node.
 */

function adbBaseArgs(deviceId) {
  return deviceId ? ["-s", deviceId] : [];
}

/** Chạy `adb shell <...shellArgs>` (mỗi phần tử là 1 arg riêng, KHÔNG có "|"/";" bên trong 1 phần tử). */
function adbShell(deviceId, shellArgs) {
  return execCliSync("adb", [...adbBaseArgs(deviceId), "shell", ...shellArgs], { encoding: "utf8" });
}

/** Chạy `adb <...args>` KHÔNG qua "shell" (vd pull/push/screencap cần truyền nguyên 1 dòng). */
function adbRaw(deviceId, args) {
  return execCliSync("adb", [...adbBaseArgs(deviceId), ...args], { encoding: "utf8" });
}

/** Bấm phím HOME - đưa app hiện tại (nếu có) ra ngoài foreground (về màn Home/Launcher thật). */
export function pressHome(deviceId) {
  adbShell(deviceId, ["input", "keyevent", "KEYCODE_HOME"]);
}

/** Mở (kéo xuống) Android notification shade - lệnh CHÍNH THỨC `cmd statusbar expand-notifications`. */
export function expandNotificationShade(deviceId) {
  adbShell(deviceId, ["cmd", "statusbar", "expand-notifications"]);
}

/** Đóng lại notification shade - dùng giữa các lượt poll để buộc lượt mở kế tiếp render lại từ đầu. */
export function collapseNotificationShade(deviceId) {
  adbShell(deviceId, ["cmd", "statusbar", "collapse"]);
}

/** Vuốt trong vùng shade để cuộn xuống (khi item cần tìm chưa hiện, danh sách shade dài). */
export function swipeUpInsideShade(deviceId) {
  adbShell(deviceId, ["input", "swipe", "540", "1900", "540", "600", "300"]);
}

/** Tap tại toạ độ tuyệt đối (vd tâm bounds của 1 item notification trong shade). */
export function tap(deviceId, x, y) {
  adbShell(deviceId, ["input", "tap", String(Math.round(x)), String(Math.round(y))]);
}

/**
 * Đọc package của Activity đang RESUMED (foreground thật) qua `dumpsys activity activities` -
 * dùng để xác nhận (a) app KHÔNG ở foreground trước khi trigger, (b) app ĐÃ lên foreground sau
 * khi tap notification. Không lọc bằng "|" (xem docblock đầu file) - filter dòng bằng regex JS.
 */
export function getResumedActivityPackage(deviceId) {
  const out = adbShell(deviceId, ["dumpsys", "activity", "activities"]);
  const lines = out.split("\n").filter((l) => l.includes("ResumedActivity"));
  for (const line of lines) {
    const m = line.match(/ActivityRecord\{[^\s]+\s+u\d+\s+([^\s/]+)\//);
    if (m) return m[1];
  }
  return null;
}

/**
 * Đọc danh sách NotificationRecord thật (qua `dumpsys notification --noredact`) của 1 package -
 * trả về mảng {tag, title, text} (title/text lấy từ extras `android.title`/`android.text`, nguyên
 * văn Android hiển thị - KHÔNG phải suy đoán). Đây là dữ liệu THẬT từ NotificationManagerService
 * (chính OS, không phải trong app) - dùng để POLL nhanh (không cần mở/đóng shade lặp lại mỗi lượt,
 * tương tự tinh thần "đóng/mở icon chuông" của TB-01 nhưng ở tầng OS).
 */
export function listNotificationExtrasForPackage(deviceId, pkg) {
  const out = adbShell(deviceId, ["dumpsys", "notification", "--noredact"]);
  const lines = out.split("\n");
  const records = [];
  let current = null;
  const recordStartRe = /^\s*(NotificationRecord|StatusBarNotification)\(/;
  for (const line of lines) {
    if (recordStartRe.test(line)) {
      if (current) records.push(current);
      current = null;
      if (line.includes(` pkg=${pkg} `)) {
        const tagMatch = line.match(/\stag=(\S+)/);
        current = { tag: tagMatch ? tagMatch[1] : null, title: null, text: null };
      }
      continue;
    }
    if (!current) continue;
    const titleMatch = line.match(/^\s*android\.title=String \((.*)\)\s*$/);
    if (titleMatch) current.title = titleMatch[1];
    const textMatch = line.match(/^\s*android\.text=String \(([\s\S]*)\)\s*$/);
    if (textMatch) current.text = textMatch[1];
  }
  if (current) records.push(current);
  return records;
}

function parseBounds(str) {
  const m = str.match(/\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/);
  if (!m) return null;
  return { x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] };
}

/**
 * Dump UI hierarchy hiện tại của thiết bị qua `uiautomator dump` (native Android tool, giống cơ
 * chế `maestro hierarchy` dùng phía dưới - xem automation/bai_tap/discovery/maestroMcpSession.js)
 * rồi pull về máy host, đọc nội dung, dọn file tạm cả 2 phía. Dùng để đọc CHÍNH XÁC những gì
 * Android System UI (`com.android.systemui`) đang render trong notification shade - bằng chứng
 * OS-level thật (không phải nội dung nội bộ app).
 */
export function dumpUiHierarchy(deviceId) {
  const remotePath = "/sdcard/_tb06_shade_dump.xml";
  adbShell(deviceId, ["uiautomator", "dump", remotePath]);
  const localDir = mkdtempSync(join(tmpdir(), "tb06-shade-"));
  const localPath = join(localDir, "dump.xml");
  adbRaw(deviceId, ["pull", remotePath, localPath]);
  const xml = readFileSync(localPath, "utf8");
  rmSync(localDir, { recursive: true, force: true });
  adbShell(deviceId, ["rm", "-f", remotePath]);
  return xml;
}

/** Chụp screenshot màn hình hiện tại (bằng chứng hình ảnh cho notification shade thật), lưu ra `localPath`. */
export function screenshot(deviceId, localPath) {
  const remotePath = "/sdcard/_tb06_shade_screenshot.png";
  adbShell(deviceId, ["screencap", "-p", remotePath]);
  adbRaw(deviceId, ["pull", remotePath, localPath]);
  adbShell(deviceId, ["rm", "-f", remotePath]);
}

/**
 * Tìm 1 node lá `resource-id` kết thúc bằng "id/text" (body notification, theo khảo sát thật trên
 * One UI/Samsung - node cha gần nhất `clickable="true"` chính là toàn bộ card notification có thể
 * tap) mà giá trị `text` khớp `matchFn`. Duyệt XML bằng 1 stack đơn giản (mở/đóng thẻ `<node>`)
 * - KHÔNG dùng thư viện XML DOM ngoài (repo không có sẵn dependency đó, tự viết state machine nhỏ
 * đủ dùng cho 1 định dạng CỐ ĐỊNH do chính `uiautomator dump` sinh ra).
 *
 * Trả về {bodyText, titleText, appNameText, clickableBounds} của match ĐẦU TIÊN, hoặc null.
 */
export function findNotificationTapTarget(xml, matchFn) {
  const stack = [];
  let recentTitle = null;
  let recentAppName = null;
  const tagRe = /<node\b([^>]*?)(\/)?>|<\/node>/g;
  let m;
  while ((m = tagRe.exec(xml))) {
    if (m[0] === "</node>") {
      stack.pop();
      continue;
    }
    const attrStr = m[1] || "";
    const selfClose = Boolean(m[2]);
    const attrs = {};
    // `uiautomator dump` chuyển sang nháy đơn cho 1 attribute cụ thể (vd `text='...'`) khi chính
    // giá trị đó chứa dấu nháy kép bên trong (ĐÃ XÁC NHẬN THẬT: body notification dạng
    // `bài "Tên bài"` luôn có dấu nháy kép quanh tên bài) - PHẢI khớp CẢ 2 kiểu nháy, chỉ khớp
    // nháy kép sẽ bỏ sót toàn bộ attribute `text` của đúng loại node cần tìm.
    const attrRe = /([\w-]+)=(?:"([^"]*)"|'([^']*)')/g;
    let am;
    while ((am = attrRe.exec(attrStr))) attrs[am[1]] = am[2] !== undefined ? am[2] : am[3];

    const resId = attrs["resource-id"] || "";
    const text = attrs.text || "";
    const clickable = attrs.clickable === "true";
    const bounds = attrs.bounds ? parseBounds(attrs.bounds) : null;

    if (resId.endsWith("id/app_name_text") && text) recentAppName = text;
    if (resId.endsWith("id/title") && text) recentTitle = text;
    if (resId.endsWith("id/text") && text && matchFn(text)) {
      let clickableBounds = null;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].clickable && stack[i].bounds) {
          clickableBounds = stack[i].bounds;
          break;
        }
      }
      return { bodyText: text, titleText: recentTitle, appNameText: recentAppName, clickableBounds };
    }

    if (!selfClose) stack.push({ clickable, bounds });
  }
  return null;
}

/** Ghi 1 file text nhỏ (debug dump XML thô) ra `automation/output/` - dùng khi cần giữ bằng chứng thô. */
export function saveDebugArtifact(path, content) {
  writeFileSync(path, content, "utf8");
}
