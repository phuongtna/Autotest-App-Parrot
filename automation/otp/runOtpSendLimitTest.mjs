#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../src/config.js";
import { MaestroBridge } from "../bridge/maestroBridge.js";
import { sendOtpViaLogin } from "./otpLoginSender.js";

/**
 * TC_LIM_SDT_01 / TC_LIM_SDT_02 - Giới hạn gửi OTP theo SĐT (5 lần/ngày), qua UI thật (không gọi
 * API trực tiếp - repo CHƯA có endpoint OTP nào được Dev xác nhận, xem quyết định trong phiên
 * làm việc 2026-09-10). Gửi liên tục 6 lần cho CÙNG 1 SĐT qua otpLoginSender.js (xem file đó để
 * biết vì sao dùng "Đăng nhập" thay vì "Gửi lại OTP" - không cần chờ cooldown 300s).
 *
 * LƯU Ý QUAN TRỌNG rút ra từ phiên chạy thật 2026-09-10: thiết bị cũng có 1 bộ đếm 5 lần/ngày
 * RIÊNG (đếm MỌI lần gửi OTP từ thiết bị, bất kể SĐT nào - xem TC_LIM_DEV_*), cộng dồn CHUNG với
 * mọi SĐT test trên cùng thiết bị. Nếu thiết bị đã dùng gần hết quota cho case khác (vd
 * runOtpDeviceLimitTest.mjs) trong CÙNG NGÀY, case này sẽ bị chặn SỚM bởi giới hạn thiết bị chứ
 * không phải giới hạn của riêng SĐT - đọc kỹ trường `blockedMessage`/`texts` ở lần bị chặn để biết
 * chặn do đâu (thông báo hiện tại giống nhau cho cả 2 loại giới hạn: "Bạn đã gửi quá số lần cho
 * phép trong ngày..." - KHÔNG phân biệt được qua text, chỉ suy luận được qua lịch sử gửi trong
 * ngày của thiết bị/SĐT đó).
 *
 * Chạy: PHONE=<SĐT thật, KHÔNG dùng OTP=888888 cố định> node automation/otp/runOtpSendLimitTest.mjs
 * Tham số env: PHONE (bắt buộc), TARGET_ATTEMPTS (mặc định 6).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const RESULT_FILE = join(OUTPUT_DIR, "otp_send_limit_result.json");

function log(...args) {
  console.log(`[otp-send-limit]`, ...args);
}

async function main() {
  const phone = process.env.PHONE;
  if (!phone) {
    throw new Error("Thiếu PHONE - chạy: PHONE=<số điện thoại thật> node automation/otp/runOtpSendLimitTest.mjs");
  }
  const targetAttempts = Number(process.env.TARGET_ATTEMPTS || 6);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });

  const attempts = [];
  let stoppedReason = "COMPLETED";

  for (let attemptNo = 1; attemptNo <= targetAttempts; attemptNo++) {
    log(`Gửi OTP lần #${attemptNo} cho ${phone}...`);
    const result = await sendOtpViaLogin(bridge, phone);
    attempts.push({ attemptNo, timestamp: new Date().toISOString(), ...result });
    log(`Lần #${attemptNo} -> ${result.outcome}${result.blockedMessage ? ` ("${result.blockedMessage}")` : ""}`);

    if (result.outcome !== "SUCCESS") {
      stoppedReason = `DỪNG sau lần #${attemptNo} (outcome=${result.outcome}) - không thử tiếp.`;
      log(stoppedReason);
      break;
    }
  }

  const successCount = attempts.filter((a) => a.outcome === "SUCCESS").length;
  const sixthAttempt = attempts.find((a) => a.attemptNo === 6);
  const summary = {
    phone,
    targetAttempts,
    stoppedReason,
    attempts,
    verdict: {
      tc_lim_sdt_01: successCount >= 5 ? "PASS" : `CẦN XEM LẠI - chỉ ${successCount}/5 lần SUCCESS`,
      tc_lim_sdt_02: sixthAttempt
        ? sixthAttempt.outcome === "BLOCKED"
          ? "PASS"
          : `CẦN XEM LẠI - lần #6 outcome=${sixthAttempt.outcome}, kỳ vọng BLOCKED`
        : "CHƯA CHẠY TỚI LẦN #6",
    },
  };

  writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2), "utf8");
  log(`Kết quả ghi tại ${RESULT_FILE}`);
  log(`Verdict:`, JSON.stringify(summary.verdict, null, 2));
}

main().catch((err) => {
  console.error("[otp-send-limit] LỖI:", err);
  process.exit(1);
});
