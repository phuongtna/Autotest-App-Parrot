#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readStudentSchoolNameFlow } from "./runtime/readStudentSchoolNameFlow.js";

/**
 * Entrypoint `npm run read-student-school-name` - đọc 1 snapshot cột "TÊN TRƯỜNG" trên CMS Quản lý
 * > "/students" cho 1 profile (case 9, xem runtime/readStudentSchoolNameFlow.js). Gọi nhiều lần
 * với `SCHOOL_OUT_FILE` khác nhau quanh 1 chuỗi thao tác đổi trạng thái lớp thật ở app/Maestro, để
 * có bằng chứng before/pending/after theo thời gian.
 *
 * Tham số qua ENV:
 *   SCHOOL_PHONE_DIGITS (bắt buộc, vd "84915775115")
 *   SCHOOL_PROFILE_NAME (bắt buộc)
 *   SCHOOL_OUT_FILE (optional - có truyền thì ghi thêm ra file JSON, không thì chỉ in ra console)
 *   SCHOOL_HEADLESS=false (mặc định true)
 *   CMS_ADMIN_ENV / --env=... (như các script khác trong quan_ly_goi_dich_vu/)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}.`);
  }
  return value;
}

function parseEnvArg() {
  const arg = process.argv.slice(2).find((a) => a.startsWith("--env="));
  return arg ? arg.split("=")[1] : undefined;
}

async function main() {
  const phoneDigits = readRequiredEnv("SCHOOL_PHONE_DIGITS");
  const profileName = readRequiredEnv("SCHOOL_PROFILE_NAME");
  const headless = process.env.SCHOOL_HEADLESS !== "false";
  const envOverride = parseEnvArg();

  const result = await readStudentSchoolNameFlow({ phoneDigits, profileName, headless, envOverride });
  console.log(`Tên trường hiện tại của "${profileName}" (${phoneDigits}): "${result.schoolName}"`);
  console.log(`  isEmpty: ${result.isEmpty}`);

  if (process.env.SCHOOL_OUT_FILE) {
    const outFile = join(__dirname, "..", process.env.SCHOOL_OUT_FILE);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, JSON.stringify(result, null, 2), "utf8");
    console.log(`Đã ghi ra ${outFile}`);
  }
}

main().catch((err) => {
  console.error("\n[read-student-school-name] Dừng lại vì lỗi ngoài dự kiến:\n");
  console.error(`  ${err.message}`);
  process.exitCode = 1;
});
