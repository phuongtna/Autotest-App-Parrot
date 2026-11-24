#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { config } from "../../src/config.js";
import { execCliSync } from "../../src/execCli.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

/**
 * runOnThiYamlSafeMultiGroup.mjs - WRAPPER cho file `.yaml` NHIỀU NHÓM ĐỘC LẬP (mỗi nhóm tự
 * `launch-fresh` + tự mở 1 đề riêng), vd `flows/app/on_thi/onthimanketqua.yaml`. Khác
 * `runOnThiYamlSafe.mjs` (chỉ xử lý ĐÚNG 1 điểm mở đề TRƯỚC KHI `maestro test` bắt đầu - không đủ
 * cho file có NHIỀU điểm mở đề BÊN TRONG cùng 1 lượt `maestro test`, xem phân tích kiến trúc
 * 2026-11-24): wrapper này LẶP qua từng nhóm trong file manifest `*.groups.json`, với MỖI nhóm:
 *
 *   1) Node (`openDeThiSafe.mjs`) tự launch (fresh/keep theo `launchMode` của nhóm) + login + tìm +
 *      tap ĐÚNG đề - AN TOÀN với lỗi encoding (xem `openDeThiSafe.mjs`).
 *   2) CHỈ KHI (1) báo FOUND_AND_TAPPED, gọi 1 lượt `maestro test <flowFile>` RIÊNG, với
 *      `GROUP_ID=<id của nhóm>` + `PRE_OPENED_BY_NODE=true` - file `.yaml` test case tự SKIP mọi
 *      nhóm khác + SKIP cả `launch-fresh`/`open-de(${DE_NAME})` của ĐÚNG nhóm này (xem guard kép đã
 *      thêm trong `onthimanketqua.yaml`: lớp `GROUP_ID` chọn nhóm, lớp `PRE_OPENED_BY_NODE` bên
 *      trong nhóm đó tắt luôn `launch-fresh` + đoạn `${DE_NAME}` của `open-de.yaml`) - chỉ còn phần
 *      NGHIỆP VỤ của nhóm chạy, bắt đầu NGAY từ màn hiện tại (Node vừa để lại).
 *
 * Node và `maestro test` KHÔNG BAO GIỜ chạy đồng thời (từng bước `await`/đồng bộ tuần tự, xem cùng
 * lý do đã ghi trong `runOnThiYamlSafe.mjs`/`openDeThiSafe.mjs` - MaestroBridge tự nó cũng hoạt động
 * bằng cách spawn nhiều lượt `maestro test` RỜI RẠC, không phải 1 phiên sống duy nhất).
 *
 * GROUP_ID KHÔNG truyền (gọi `maestro test onthimanketqua.yaml` TRỰC TIẾP, không qua wrapper này) ->
 * MỌI nhóm tự chạy hệt như trước 2026-11-24 (tương thích ngược 100%, dùng khi DE_NAME là ASCII).
 *
 * Nhóm có `optional: true` (vd nhóm "II" - `DE_NAME_MULTI_SKILL`) và biến đặt tên (`nameVar`) tương
 * ứng RỖNG trong `process.env` -> BỎ QUA HOÀN TOÀN (không gọi Node, không gọi `maestro test`) - giữ
 * ĐÚNG hành vi optional hiện tại của nhóm đó.
 *
 * LỖI Ở 1 NHÓM (Node không mở được đề, HOẶC `maestro test` nhóm đó FAIL) -> DỪNG NGAY, KHÔNG chạy
 * các nhóm còn lại trong manifest, exit code != 0 - không âm thầm bỏ qua.
 *
 * Tham số dòng lệnh: argv[2] = đường dẫn file manifest `*.groups.json` (tương đối REPO_ROOT hoặc
 * tuyệt đối). `flowFile` bên trong manifest được giải quyết tương đối THEO ĐÚNG THƯ MỤC chứa file
 * manifest đó (để manifest + file `.yaml` test case luôn nằm cạnh nhau, không phải đoán từ cwd).
 * Tham số process.env: PHONE, OTP (bắt buộc), ON_THI_TAB/DE_LIST_TAP_POINT/TOTAL_QUESTIONS_SAFETY
 * (optional, forward nguyên vẹn - đều là giá trị ASCII an toàn) + 1 biến riêng cho MỖI nhóm theo
 * đúng `nameVar` khai báo trong manifest (vd `DE_NAME`, `DE_NAME_MULTI_SKILL`).
 *
 * Usage: node automation/on_thi/runtime/runOnThiYamlSafeMultiGroup.mjs flows/app/on_thi/onthimanketqua.groups.json
 *
 * ĐÃ CHẠY THẬT (2026-11-24, thiết bị 3201d866d40a1681, đề "Đề kiểm tra cuối kỳ 1" có dấu, qua
 * `onthimanketqua.groups.json`): (1) cả 6 nhóm trong 1 lượt - PASS 5/5 nhóm chạy, nhóm II tự bỏ
 * qua đúng thiết kế; (2) log xác nhận MỌI điều kiện `GROUP_ID`/`PRE_OPENED_BY_NODE` đều SKIPPED
 * đúng ở các nhóm không được chọn - KHÔNG nhóm nào còn so khớp `${DE_NAME}` qua Maestro; (3) truyền
 * DE_NAME không tồn tại -> wrapper DỪNG ngay ở nhóm I (exit code 1), KHÔNG chạy II..VI.
 */

function log(...args) {
  console.log(...args);
}

const JAVA_TOOL_OPTIONS_FIX = `${process.env.JAVA_TOOL_OPTIONS ?? ""} -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -Dfile.encoding=UTF-8`.trim();

function parseLastJsonLine(stdout) {
  const lines = (stdout ?? "").trim().split("\n").filter(Boolean);
  const lastLine = lines[lines.length - 1] ?? "";
  try {
    return JSON.parse(lastLine);
  } catch {
    return null;
  }
}

function runNodeOpenStep(nameVar, nameValue, launchMode) {
  const openScript = join(__dirname, "openDeThiSafe.mjs");
  let stdout;
  try {
    stdout = execFileSync("node", [openScript], {
      cwd: REPO_ROOT,
      env: { ...process.env, DE_NAME: nameValue, LAUNCH_MODE: launchMode ?? "fresh" },
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
    });
  } catch (err) {
    stdout = typeof err.stdout === "string" ? err.stdout : "";
  }
  return parseLastJsonLine(stdout);
}

function runMaestroForGroup(flowPath, groupId, nameVar) {
  const args = [
    "test",
    flowPath,
    "--no-reinstall-driver",
    "-e",
    `APP_ID=${config.appId}`,
    "-e",
    `GROUP_ID=${groupId}`,
    "-e",
    "PRE_OPENED_BY_NODE=true",
    "-e",
    "DEVICE_MODE=true",
    // SỬA (2026-11-24, FAIL THAT XAC NHAN qua chay that): nhom (vd "- runFlow: when: true:
    // ${(GROUP_ID==null||GROUP_ID=='I') && DE_NAME != null && ...}") VAN doc ${DE_NAME}/${nameVar}
    // de kiem tra "co truyen hay khong" (dieu kien bat buoc GIU NGUYEN cho tuong thich nguoc voi
    // cach goi truc tiep khong qua wrapper) - KHONG truyen gia tri NAY se khien dieu kien LUON false,
    // ca nhom bi SKIP HOAN TOAN ma `maestro test` van thoat ma 0 (PASS GIA, da gap that o lan chay
    // dau 2026-11-24). Gia tri THAT (co dau) KHONG can thiet o day (PRE_OPENED_BY_NODE=true da bo
    // qua moi cho dung ${DE_NAME}/${nameVar} that de dieu huong) - chi can 1 placeholder ASCII AN
    // TOAN de qua dieu kien "!= null && != ''".
    "-e",
    `${nameVar}=NODE_OPENED`,
    ...(process.env.TOTAL_QUESTIONS_SAFETY ? ["-e", `TOTAL_QUESTIONS_SAFETY=${process.env.TOTAL_QUESTIONS_SAFETY}`] : []),
    ...(config.deviceId ? ["--device", config.deviceId] : []),
  ];
  return execCliSync("maestro", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, JAVA_TOOL_OPTIONS: JAVA_TOOL_OPTIONS_FIX },
  });
}

function main() {
  const manifestArg = process.argv[2];
  if (!manifestArg) {
    log('[runOnThiYamlSafeMultiGroup] Thiếu manifest. Dùng: node runOnThiYamlSafeMultiGroup.mjs "<file.groups.json>"');
    process.exitCode = 1;
    return;
  }
  const manifestPath = resolve(REPO_ROOT, manifestArg);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const flowPath = join(dirname(manifestPath), manifest.flowFile);

  for (const group of manifest.groups) {
    const nameValue = process.env[group.nameVar];
    if (!nameValue) {
      if (group.optional) {
        log(`\n[NHÓM ${group.id}] BỎ QUA - biến "${group.nameVar}" rỗng (nhóm optional, đúng hành vi hiện tại).`);
        continue;
      }
      log(`\n[NHÓM ${group.id}] DỪNG - thiếu biến bắt buộc "${group.nameVar}".`);
      process.exitCode = 1;
      return;
    }

    log(`\n[NHÓM ${group.id}] STEP 1/2 - Node mở đề "${nameValue}" (launchMode=${group.launchMode ?? "fresh"})...`);
    const openResult = runNodeOpenStep(group.nameVar, nameValue, group.launchMode);
    if (!openResult || openResult.status !== "FOUND_AND_TAPPED") {
      log(`[NHÓM ${group.id}] DỪNG - Node KHÔNG mở được đề (status=${openResult?.status ?? "UNKNOWN"}).`);
      log(`  Lý do: ${openResult?.reason ?? "(không có output hợp lệ)"}`);
      if (openResult?.diagnostics) log(`  Chi tiết: ${openResult.diagnostics}`);
      log("  => WRAPPER DỪNG NGAY, KHÔNG chạy các nhóm còn lại trong manifest.");
      process.exitCode = openResult?.status === "AMBIGUOUS" ? 2 : 1;
      return;
    }
    log(`[NHÓM ${group.id}] Node OK - đã mở "${openResult.card?.title}" (cta="${openResult.card?.cta}").`);

    log(`[NHÓM ${group.id}] STEP 2/2 - maestro test (GROUP_ID=${group.id}, PRE_OPENED_BY_NODE=true)...`);
    try {
      const out = runMaestroForGroup(flowPath, group.id, group.nameVar);
      log(out);
      // BAT BUOC (2026-11-24, phat hien that lan dau tien viet file nay): `maestro test` thoat ma 0
      // KHONG DAM BAO khoi nghiep vu cua nhom THAT SU da chay (vd thieu "-e <nameVar>=..." khien ca
      // khoi `when` cua nhom bi SKIP HOAN TOAN, van thoat ma 0 vi khong co assertion nao de FAIL) -
      // KHONG tin tuong MOI "PASS" chi vi khong co loi, phai xac nhan co it nhat 1 buoc THAT SU cua
      // nhom da chay (moi nhom deu ket thuc bang 1 `takeScreenshot: artifacts/KQ-...`).
      if (!/Take screenshot artifacts\/KQ-/.test(out)) {
        log(`[NHÓM ${group.id}] DỪNG - "maestro test" thoát mã 0 NHƯNG không thấy dấu hiệu nghiệp vụ nhóm đã thực sự chạy (thiếu "Take screenshot artifacts/KQ-*") - rất có thể khối "when" của nhóm bị SKIP toàn bộ (PASS GIẢ). KHÔNG coi là PASS.`);
        process.exitCode = 1;
        return;
      }
      log(`[NHÓM ${group.id}] PASS`);
    } catch (err) {
      log(err.stdout ?? "");
      log(`[NHÓM ${group.id}] FAIL: ${err.message}`);
      log("  => WRAPPER DỪNG NGAY, KHÔNG chạy các nhóm còn lại trong manifest.");
      process.exitCode = 1;
      return;
    }
  }

  log("\n=== Tất cả nhóm (không bị bỏ qua) đã PASS ===");
}

main();
