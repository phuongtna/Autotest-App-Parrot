#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../src/config.js";
import { MaestroBridge } from "../bridge/maestroBridge.js";
import { sendOtpViaLogin } from "./otpLoginSender.js";

/**
 * TC_LIM_DEV_01 / TC_LIM_DEV_02 - Giới hạn gửi OTP theo THIẾT BỊ (5 lần/ngày, đếm MỌI lần gửi từ
 * thiết bị bất kể SĐT nào khác nhau) - ĐÃ CHẠY THẬT VÀ PASS 2026-09-10 trên thiết bị
 * 3201d866d40a1681 với 2 SĐT thật (0987652170, 0936021880), xem
 * automation/output/otp_device_limit_result.json cho log đầy đủ của lần chạy đó.
 *
 * Thiết kế: gửi OTP luân phiên qua danh sách PHONES (không cần đủ 5 SĐT khác nhau - lặp lại số cũ
 * vẫn tính vào bộ đếm THIẾT BỊ miễn số đó CHƯA tự chạm giới hạn RIÊNG của nó) cho tới khi:
 *   - Đủ 5 lần SUCCESS đầu tiên (TC_LIM_DEV_01), rồi
 *   - Lần thứ 6 (PHONES[5 % PHONES.length]) phải BLOCKED (TC_LIM_DEV_02), với thông báo thật đã
 *     xác nhận: "Bạn đã gửi quá số lần cho phép trong ngày. Vui lòng thử lại vào ngày mai".
 *
 * CẢNH BÁO: đây là lần gửi Zalo THẬT, tốn quota 5 lần/ngày CHUNG của thiết bị - KHÔNG chạy song
 * song với runOtpSendLimitTest.mjs trong cùng ngày (2 case dùng chung 1 quota thiết bị, xem ghi
 * chú trong runOtpSendLimitTest.mjs). Quota reset lại vào hôm sau theo đúng thông báo lỗi.
 *
 * Chạy: PHONES=0987652170,0936021880 node automation/otp/runOtpDeviceLimitTest.mjs
 * Tham số env: PHONES (bắt buộc, danh sách SĐT thật cách nhau dấu phẩy), TARGET_ATTEMPTS (mặc định 6).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const RESULT_FILE = join(OUTPUT_DIR, "otp_device_limit_result.json");

function log(...args) {
  console.log(`[otp-device-limit]`, ...args);
}

async function main() {
  const phonesRaw = process.env.PHONES;
  if (!phonesRaw) {
    throw new Error(
      "Thiếu PHONES - chạy: PHONES=<sđt1>,<sđt2>,... node automation/otp/runOtpDeviceLimitTest.mjs",
    );
  }
  const phones = phonesRaw.split(",").map((p) => p.trim()).filter(Boolean);
  const targetAttempts = Number(process.env.TARGET_ATTEMPTS || 6);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });

  const attempts = [];
  let stoppedReason = "COMPLETED";

  for (let attemptNo = 1; attemptNo <= targetAttempts; attemptNo++) {
    const phone = phones[(attemptNo - 1) % phones.length];
    log(`Gửi OTP lần #${attemptNo} (thiết bị) cho ${phone}...`);
    const result = await sendOtpViaLogin(bridge, phone);
    attempts.push({ attemptNo, phone, timestamp: new Date().toISOString(), ...result });
    log(`Lần #${attemptNo} (${phone}) -> ${result.outcome}${result.blockedMessage ? ` ("${result.blockedMessage}")` : ""}`);

    if (result.outcome !== "SUCCESS") {
      stoppedReason = `DỪNG sau lần #${attemptNo} (outcome=${result.outcome}) - không thử tiếp.`;
      log(stoppedReason);
      break;
    }
  }

  const successCount = attempts.filter((a) => a.outcome === "SUCCESS").length;
  const sixthAttempt = attempts.find((a) => a.attemptNo === 6);
  const summary = {
    phones,
    targetAttempts,
    stoppedReason,
    attempts,
    verdict: {
      tc_lim_dev_01: successCount >= 5 ? "PASS" : `CẦN XEM LẠI - chỉ ${successCount}/5 lần SUCCESS`,
      tc_lim_dev_02: sixthAttempt
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
  console.error("[otp-device-limit] LỖI:", err);
  process.exit(1);
});
