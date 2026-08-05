import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseEnvFile } from "../src/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Cùng file account đã dùng cho các flow Maestro hiện có (flows/vui_hoc/*.yaml qua
// scripts/run_tests.sh) - dùng lại để đăng nhập khi cần mở app thật (xem unitStatusProbe.js),
// KHÔNG tạo tài khoản test riêng cho automation/.
const ACCOUNTS_ENV_PATH = join(__dirname, "..", "..", "test_data", "accounts.env");

/**
 * Đọc số điện thoại/OTP test dùng để đăng nhập app thật khi automation/discovery/ cần mở
 * app (unitStatusProbe.js) - throw rõ nếu thiếu file, không âm thầm trả về rỗng.
 */
export function getAppAccount() {
  if (!existsSync(ACCOUNTS_ENV_PATH)) {
    throw new Error(
      `Không tìm thấy ${ACCOUNTS_ENV_PATH}. File này cần có PHONE_NUMBER/OTP_CODE để đăng nhập ` +
        `app thật (xem scripts/run_tests.sh - cùng file account đang dùng cho các flow Maestro).`,
    );
  }
  const vars = parseEnvFile(ACCOUNTS_ENV_PATH);
  if (!vars.PHONE_NUMBER || !vars.OTP_CODE) {
    throw new Error(
      `${ACCOUNTS_ENV_PATH} thiếu PHONE_NUMBER hoặc OTP_CODE.`,
    );
  }
  return { phoneNumber: vars.PHONE_NUMBER, otpCode: vars.OTP_CODE };
}
