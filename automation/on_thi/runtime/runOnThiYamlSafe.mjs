#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { config } from "../../src/config.js";
import { execCliSync } from "../../src/execCli.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

/**
 * runOnThiYamlSafe.mjs - WRAPPER nối 2 giai đoạn TUẦN TỰ (không chạy song song, xem docblock
 * `openDeThiSafe.mjs`):
 *   1) `openDeThiSafe.mjs` (Node + MaestroBridge) tìm + tap ĐÚNG card theo DE_NAME có dấu - AN TOÀN
 *      với lỗi encoding Maestro trên máy này.
 *   2) CHỈ KHI (1) báo FOUND_AND_TAPPED thật sự, mới gọi `maestro test <FLOW_FILE>` với
 *      `PRE_OPENED_BY_NODE=true` (+ `DEVICE_MODE=true`) để file test case tiếp tục NGAY từ màn hiện
 *      tại (không login/launchApp lại, không tự tìm card theo `${DE_NAME}` nữa).
 *
 * BẮT BUỘC theo yêu cầu (2026-11-24): KHÔNG được tự ý coi (1) "có vẻ ổn" là đủ - phải đọc ĐÚNG
 * dòng JSON kết quả cuối cùng của (1) (`status`) TRƯỚC khi quyết định có chạy (2) hay không. Nếu
 * (1) trả NOT_FOUND/AMBIGUOUS/ERROR: dừng NGAY, in rõ lý do, KHÔNG chạy (2), exit code khác 0.
 *
 * Tham số (process.env): PHONE, OTP, DE_NAME, DE_DUE_DATE_DM (optional), ON_THI_TAB (optional) -
 * chuyển tiếp nguyên vẹn cho `openDeThiSafe.mjs`.
 * Tham số dòng lệnh: argv[2] = đường dẫn FLOW_FILE (tuyệt đối hoặc tương đối REPO_ROOT) cần chạy
 * SAU KHI đã mở đề; các argv còn lại (nếu có) được forward NGUYÊN VĂN cho `maestro test` (vd
 * `-e TOTAL_QUESTIONS_SAFETY=30`) - dùng cho tham số KHÔNG có dấu tiếng Việt (an toàn qua CLI).
 *
 * Usage: node automation/on_thi/runtime/runOnThiYamlSafe.mjs <flow.yaml> [-e K=V ...]
 */

function log(...args) {
  console.log(...args);
}

function main() {
  const flowFile = process.argv[2];
  const extraArgs = process.argv.slice(3);
  if (!flowFile) {
    log('[runOnThiYamlSafe] Thiếu FLOW_FILE. Dùng: node runOnThiYamlSafe.mjs "<flow.yaml>" [-e K=V ...]');
    process.exitCode = 1;
    return;
  }

  log("\n[STEP 1/2] openDeThiSafe.mjs - tìm + mở đúng đề qua Node (an toàn với lỗi encoding)...");
  const openScript = join(__dirname, "openDeThiSafe.mjs");
  let stdout;
  try {
    stdout = execFileSync("node", [openScript], {
      cwd: REPO_ROOT,
      env: process.env,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
    });
  } catch (err) {
    // execFileSync throws khi exit code != 0 - vẫn cần đọc stdout đã in ra (dòng JSON kết quả)
    // trước khi coi là lỗi không rõ nguyên nhân.
    stdout = typeof err.stdout === "string" ? err.stdout : "";
    if (!stdout) {
      log(`[STEP 1/2] FAIL (không có output): ${err.message}`);
      process.exitCode = 1;
      return;
    }
  }

  const lines = stdout.trim().split("\n").filter(Boolean);
  const lastLine = lines[lines.length - 1] ?? "";
  let result;
  try {
    result = JSON.parse(lastLine);
  } catch {
    log(`[STEP 1/2] FAIL - không parse được dòng JSON kết quả cuối cùng: ${JSON.stringify(lastLine)}`);
    process.exitCode = 1;
    return;
  }

  if (result.status !== "FOUND_AND_TAPPED") {
    log(`[STEP 1/2] DỪNG - Node KHÔNG mở được đề (status=${result.status}).`);
    log(`  Lý do: ${result.reason ?? "(không có)"}`);
    if (result.diagnostics) log(`  Chi tiết: ${result.diagnostics}`);
    log("  => KHÔNG chạy maestro test tiếp (theo đúng yêu cầu bắt buộc).");
    process.exitCode = result.status === "AMBIGUOUS" ? 2 : 1;
    return;
  }

  log(`[STEP 1/2] OK - đã mở đúng card "${result.card?.title}" (cta="${result.card?.cta}").`);

  log("\n[STEP 2/2] maestro test (PRE_OPENED_BY_NODE=true) - tiếp tục test case từ màn hiện tại...");
  const args = [
    "test",
    flowFile,
    "--no-reinstall-driver",
    "-e",
    `APP_ID=${config.appId}`,
    "-e",
    "PRE_OPENED_BY_NODE=true",
    "-e",
    "DEVICE_MODE=true",
    ...(config.deviceId ? ["--device", config.deviceId] : []),
    ...extraArgs,
  ];
  try {
    const out = execCliSync("maestro", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        JAVA_TOOL_OPTIONS: `${process.env.JAVA_TOOL_OPTIONS ?? ""} -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -Dfile.encoding=UTF-8`.trim(),
      },
    });
    log(out);
    log("\n[STEP 2/2] PASS");
  } catch (err) {
    log(err.stdout ?? "");
    log(`\n[STEP 2/2] FAIL: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
