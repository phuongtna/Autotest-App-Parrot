#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../../src/config.js";
import { execCliSync } from "../../src/execCli.js";
import { MaestroBridge } from "../../bridge/maestroBridge.js";
import { OnThiNavigationEngine } from "../navigation/onThiNavigationEngine.js";
import { OnThiExamEngine } from "../navigation/onThiExamEngine.js";
import { onThiPageObjects as po } from "../navigation/onThiPageObjects.js";
import { findDeThi, tapFoundDeCard } from "../discovery/findDeThi.js";
import {
  collectTextNodesWithBoundsInsideScrollableList,
  centerPoint,
  VIEW_COMPLETED_LINK,
} from "../discovery/onThiUiList.js";

const START_NEW_ATTEMPT_CTA = /^(Làm bài|Làm tiếp|Làm lại)$/;
const MAX_LOOKAHEAD_FOR_RETRY_CTA = 8;

/**
 * openDeThiSafe.mjs - mở 1 đề On thi theo ĐÚNG tên tiếng Việt có dấu, AN TOÀN với lỗi encoding
 * đã biết của Maestro trên máy Windows này (xem memory `maestro-vietnamese-encoding-bug`): Maestro
 * làm hỏng ký tự có dấu MỖI KHI thay thế biến `${...}` (dù qua `-e` dòng lệnh hay `env:` lồng
 * `runFlow`), nhưng KHÔNG hỏng khi text được ghi THẲNG vào nội dung 1 file `.yaml` rồi Maestro tự
 * đọc file đó - `findDeThi()`/`MaestroBridge` (đã có sẵn trong repo) làm ĐÚNG VẬY: đọc
 * `maestro hierarchy` JSON trực tiếp bằng Node rồi so khớp bằng JS, tap bằng TOẠ ĐỘ (không qua
 * selector text `${DE_NAME}`) - tái sử dụng NGUYÊN VẸN, KHÔNG viết lại cơ chế match/tap.
 *
 * MỤC ĐÍCH: cho phép các test case `.yaml` thuần của module Ôn thi (flows/app/on_thi/*.yaml) mở
 * đúng 1 đề có tên tiếng Việt có dấu - script này CHỈ làm phần "mở đề" (tìm card -> tap CTA), phần
 * còn lại của test (nộp bài, assert màn Kết quả...) vẫn chạy bằng `maestro test` như cũ, qua cờ mới
 * `PRE_OPENED_BY_NODE=true` của `flows/app/helpers/open-de.yaml` (xem docblock file đó).
 *
 * TẠI SAO AN TOÀN KHI "BÀN GIAO" LẠI CHO `maestro test` SAU ĐÓ: `MaestroBridge` (dùng ở đây) BẢN
 * CHẤT đã hoạt động bằng cách spawn NHIỀU lượt `maestro test <file tạm>` RIÊNG BIỆT, KHÔNG PHẢI 1
 * tiến trình/phiên sống duy nhất giữ kết nối ADB - xem chính docblock `MaestroBridge` (dòng ~18-25):
 * "nhiều lượt `maestro test` RIÊNG BIỆT gọi liên tiếp KHÔNG làm mất trạng thái app". Lượt `maestro
 * test` cuối cùng của WRAPPER (chạy file test case .yaml thật) chỉ là 1 lượt KẾ TIẾP cùng loại,
 * không khác gì các lượt `runSteps()` nội bộ của chính Bridge - KHÔNG có "phiên sống" nào cần đóng,
 * miễn là file test case .yaml đó KHÔNG gọi `launchApp`/`clearState` lại từ đầu (xem ghi chú
 * `PRE_OPENED_BY_NODE` ở `open-de.yaml` - dùng `DEVICE_MODE=true` cùng lúc để khỏi login lại).
 *
 * Tham số (process.env, giống quy ước `onThiExamE2E.js`):
 *   - PHONE, OTP (bắt buộc)      - đăng nhập (số/chữ số thuần, không rủi ro encoding).
 *   - DE_NAME (bắt buộc)         - tên đề NGUYÊN VĂN có dấu, vd "Đề thi chung 1 kỹ năng".
 *   - DE_DUE_DATE_DM (optional)  - "DD/MM", dùng khi DE_NAME có thể trùng ≥2 card.
 *   - ON_THI_TAB (optional)      - mặc định "Đề thầy cô giao"; "Kho đề Parrot" để mở tab kia.
 *   - LAUNCH_MODE (optional, "keep"|"fresh", mặc định "keep") - THÊM MỚI 2026-11-24 (phục vụ kiến
 *     trúc multi-group `runOnThiYamlSafeMultiGroup.mjs`): "fresh" dùng
 *     `flows/app/helpers/launch-fresh.yaml` (kill + mở lại app) THAY vì `launch-keep-session.yaml`
 *     TRƯỚC khi login - dùng khi nhóm test cần app ở trạng thái SẠCH (không kế thừa màn hình/dữ
 *     liệu của nhóm/lượt chạy trước, đúng ĐÚNG trách nhiệm mà bản thân file `.yaml` test case đang
 *     tự làm bằng `runFlow: ../helpers/launch-fresh.yaml` ở đầu mỗi nhóm - khi dùng wrapper
 *     multi-group, bước đó CHUYỂN sang đây, làm TRƯỚC khi tìm+mở đề, để không xoá mất card Node vừa
 *     mở nếu còn nằm trong CÙNG 1 file `.yaml` test case).
 *
 * CƠ CHẾ GỌI MAESTRO (xác nhận rõ theo yêu cầu - KHÔNG phải giả định): login/launch bên dưới gọi
 * THẲNG `execCliSync("maestro", ["test", "<đường dẫn file .yaml có sẵn>", ...])` - CÙNG MỘT hàm
 * nguyên thuỷ (`automation/src/execCli.js#execCliSync`) mà chính `MaestroBridge._execMaestro()`
 * dùng nội bộ, chỉ khác: `MaestroBridge` tự SINH 1 file `.yaml` tạm từ mảng JS rồi trỏ `maestro test`
 * vào đó, còn ở đây trỏ THẲNG vào file `.yaml` CÓ SẴN trong repo
 * (`flows/app/helpers/launch-fresh.yaml`/`launch-keep-session.yaml`/`login.yaml`) - Maestro CLI
 * chấp nhận ĐƯỢC nhiều đường dẫn file flow trong 1 lệnh `test` (đã xác nhận THẬT qua nhiều lượt chạy
 * trong phiên viết file này, xem "DA CHAY THAT" cuối docblock `open-de.yaml`). KHÔNG dùng
 * `bridge.runSteps([{runFlow: "..."}])` cho bước này (đường dẫn tương đối bên trong file `.yaml` tạm
 * của Bridge, ở `automation/output/.tmp/`, sẽ phải tính lại tương đối - CHƯA xác nhận, không thêm
 * rủi ro không cần thiết khi cách gọi trực tiếp hiện tại đã verify thật nhiều lần).
 *
 * KẾT QUẢ: in 1 dòng JSON DUY NHẤT ra stdout (dòng cuối cùng, dễ parse cho wrapper) dạng
 *   {"status":"FOUND_AND_TAPPED"} khi thành công, hoặc
 *   {"status":"NOT_FOUND"|"AMBIGUOUS"|"ERROR","reason":"...","diagnostics":"..."} khi thất bại -
 * exit code 0 CHỈ khi FOUND_AND_TAPPED, khác 0 cho MỌI trường hợp còn lại (wrapper PHẢI kiểm tra
 * exit code + dòng JSON này TRƯỚC KHI gọi `maestro test` tiếp, KHÔNG được giả định thành công).
 *
 * ĐÃ CHẠY THẬT (2026-11-24, thiết bị 3201d866d40a1681, đề "Đề kiểm tra cuối kỳ 1" có dấu): qua
 * `runOnThiYamlSafeMultiGroup.mjs` cho cả 6 nhóm của `onthimanketqua.yaml` - PASS cả 5 nhóm chạy
 * (I/III/IV/V/VI, nhóm II tự bỏ qua đúng thiết kế khi thiếu DE_NAME_MULTI_SKILL), cta="Làm lại" dò
 * đúng mỗi lần - xem thêm ghi chú thật ở docblock `open-de.yaml` (mục PRE_OPENED_BY_NODE).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const OUTPUT_DIR = join(__dirname, "..", "..", "output");

function printResultAndExit(result, exitCode) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, "open_de_thi_safe_result.json"), JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify(result));
  process.exitCode = exitCode;
}

async function main() {
  const PHONE = process.env.PHONE;
  const OTP = process.env.OTP;
  const DE_NAME = process.env.DE_NAME;
  const DE_DUE_DATE_DM = process.env.DE_DUE_DATE_DM || null;
  const ON_THI_TAB = process.env.ON_THI_TAB || po.list.subTabAssignedByTeacher;
  const LAUNCH_MODE = process.env.LAUNCH_MODE === "fresh" ? "fresh" : "keep";
  const launchFlowFile = LAUNCH_MODE === "fresh" ? "flows/app/helpers/launch-fresh.yaml" : "flows/app/helpers/launch-keep-session.yaml";

  if (!PHONE || !OTP || !DE_NAME) {
    printResultAndExit(
      { status: "ERROR", reason: "MISSING_PARAM", diagnostics: "Cần PHONE, OTP, DE_NAME (process.env)." },
      1,
    );
    return;
  }

  // Kiểm tra encoding thật (yêu cầu bắt buộc #5): ghi rõ DE_NAME nhận được dạng JSON (dễ đối chiếu
  // byte-for-byte với chuỗi gốc) TRƯỚC khi làm gì khác - nếu Windows/Node làm hỏng ký tự ở bước
  // truyền process.env, dòng log này sẽ lộ ra NGAY, không cần đợi tới bước tìm card.
  console.error(`[openDeThiSafe] DE_NAME nhận được: ${JSON.stringify(DE_NAME)}`);

  // Đăng nhập (số điện thoại/OTP thuần số - không có rủi ro encoding) qua 1 lượt `maestro test`
  // riêng, TÁCH KHỎI MaestroBridge bên dưới - cùng tinh thần "mỗi thao tác 1 lượt test riêng" của
  // chính MaestroBridge, không cần viết lại qua Bridge.
  try {
    execCliSync(
      "maestro",
      [
        "test",
        launchFlowFile,
        "flows/app/helpers/login.yaml",
        "--no-reinstall-driver",
        "-e",
        `APP_ID=${config.appId}`,
        "-e",
        `PHONE=${PHONE}`,
        "-e",
        `OTP=${OTP}`,
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        env: {
          ...process.env,
          JAVA_TOOL_OPTIONS: `${process.env.JAVA_TOOL_OPTIONS ?? ""} -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -Dfile.encoding=UTF-8`.trim(),
        },
      },
    );
  } catch (err) {
    printResultAndExit(
      { status: "ERROR", reason: "LOGIN_FAILED", diagnostics: String(err.message || err) },
      1,
    );
    return;
  }

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
  const nav = new OnThiNavigationEngine(bridge);
  const exam = new OnThiExamEngine(bridge);

  try {
    if (ON_THI_TAB === po.list.subTabParrotBank) {
      await nav.openKhoDeParrotTab();
    } else {
      await nav.openDeThayCoGiaoTab();
    }
  } catch (err) {
    printResultAndExit({ status: "ERROR", reason: "OPEN_TAB_FAILED", diagnostics: String(err.message || err) }, 1);
    return;
  }

  let located;
  try {
    located = await findDeThi(bridge, { title: DE_NAME, dueDateDM: DE_DUE_DATE_DM });
  } catch (err) {
    printResultAndExit({ status: "ERROR", reason: "FIND_THREW", diagnostics: String(err.message || err) }, 1);
    return;
  }

  if (located.status === "AMBIGUOUS") {
    printResultAndExit(
      {
        status: "AMBIGUOUS",
        reason: `Tìm thấy ${located.matches.length} card trùng khớp "${DE_NAME}" - cần thêm DE_DUE_DATE_DM để chọn đúng.`,
        diagnostics: located.diagnostics,
      },
      2,
    );
    return;
  }
  if (located.status !== "FOUND") {
    printResultAndExit(
      { status: located.status, reason: located.reason ?? located.status, diagnostics: located.diagnostics },
      1,
    );
    return;
  }

  // SỬA (2026-11-24, FAIL THAT XAC NHAN qua chay that): `findDeThi()`/`parseOnThiCardsWithDetail()`
  // CỐ Ý dừng quét CTA của card tại "Xem bài đã làm" cho card ĐÃ NỘP (xem docblock
  // onThiUiList.js#parseOnThiCardsWithDetail - thiết kế cho mục đích KHÁC: chỉ cần XÁC NHẬN card
  // tồn tại, không cần mở lượt làm mới). Script này cần mở lượt làm MỚI (cùng ngữ nghĩa CTA
  // "Làm bài/Làm tiếp/Làm lại" của `open-de.yaml`) - nếu `tapFoundDeCard()` tap đúng "Xem bài đã
  // làm" sẽ mở NHẦM màn Lịch sử, không phải "Thông tin đề". Tự dò thêm nút CTA THẬT (nằm NGAY SAU
  // "Xem bài đã làm" trong cùng card, xác nhận thật qua maestro hierarchy) bằng cách đọc lại
  // hierarchy + tìm đúng node title (khớp bounds, không chỉ text, để không nhầm 2 card trùng tên)
  // rồi quét tiếp vài node kế - KHÔNG sửa `findDeThi.js`/`onThiUiList.js` gốc (thuật toán dùng
  // chung với module Bài tập), chỉ thêm bước XỬ LÝ RIÊNG ở tầng script này.
  let tapTarget = located.card;
  if (located.card.cta === VIEW_COMPLETED_LINK) {
    const tree = bridge.hierarchy();
    const nodes = collectTextNodesWithBoundsInsideScrollableList(tree, []);
    const titleIdx = nodes.findIndex(
      (n) =>
        n.text === located.card.title &&
        n.bounds?.y1 === located.card.titleBounds?.y1 &&
        n.bounds?.x1 === located.card.titleBounds?.x1,
    );
    let retryNode = null;
    if (titleIdx >= 0) {
      for (let j = titleIdx + 1; j < Math.min(nodes.length, titleIdx + 1 + MAX_LOOKAHEAD_FOR_RETRY_CTA); j++) {
        if (START_NEW_ATTEMPT_CTA.test(nodes[j].text)) {
          retryNode = nodes[j];
          break;
        }
      }
    }
    if (retryNode?.bounds) {
      tapTarget = { title: located.card.title, cta: retryNode.text, ctaBounds: retryNode.bounds };
    } else {
      console.error(
        `[openDeThiSafe] CẢNH BÁO: card "${located.card.title}" đã nộp (cta="${VIEW_COMPLETED_LINK}") ` +
          `nhưng KHÔNG dò được nút "Làm lại" kế bên - fallback tap đúng "${VIEW_COMPLETED_LINK}" (CÓ THỂ mở sai màn).`,
      );
    }
  }

  const tapped = await tapFoundDeCard(bridge, tapTarget);
  if (!tapped.success) {
    printResultAndExit({ status: "ERROR", reason: "TAP_FAILED", diagnostics: tapped.error }, 1);
    return;
  }

  await bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);
  await exam.dismissAiPopupIfPresent();

  printResultAndExit({ status: "FOUND_AND_TAPPED", card: { title: located.card.title, cta: tapTarget.cta } }, 0);
}

main().catch((err) => {
  printResultAndExit({ status: "ERROR", reason: "UNCAUGHT", diagnostics: String(err?.stack || err) }, 1);
});
