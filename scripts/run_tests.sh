#!/usr/bin/env bash
# Chạy toàn bộ test flow bằng Maestro trên máy ảo/thiết bị Android đang kết nối.
#
# Cách dùng:
#   ./scripts/run_tests.sh                                  # dùng APP_ID trong .env
#   APP_ID=com.example.parrot ./scripts/run_tests.sh        # override trực tiếp
#   ./scripts/run_tests.sh flows/login.yaml                 # chỉ chạy 1 flow

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  # shellcheck disable=SC1091
  source .env
fi

if [ -f test_data/accounts.env ]; then
  # shellcheck disable=SC1091
  source test_data/accounts.env
fi

if [ -z "${APP_ID:-}" ]; then
  echo "Chưa cấu hình APP_ID. Hãy tạo file .env (xem .env.example) hoặc export APP_ID=<package_name>." >&2
  echo "Dùng ./scripts/find_appid.sh để tìm package name của app trên máy ảo." >&2
  exit 1
fi

if ! command -v maestro &>/dev/null; then
  echo "Không tìm thấy lệnh 'maestro'. Cài đặt: curl -Ls \"https://get.maestro.mobile.dev\" | bash" >&2
  exit 1
fi

DEVICE_COUNT=$(adb devices | tail -n +2 | grep -c "device$" || true)
if [ "$DEVICE_COUNT" -eq 0 ]; then
  echo "Không có máy ảo/thiết bị nào đang chạy. Hãy mở máy ảo trong Android Studio trước." >&2
  exit 1
fi

REPORT_DIR="reports"
mkdir -p "$REPORT_DIR"

TARGET="${1:-flows}"

echo "Chạy Maestro test cho appId=$APP_ID, target=$TARGET"
maestro test "$TARGET" \
  -e APP_ID="$APP_ID" \
  -e PHONE_NUMBER="${PHONE_NUMBER:-}" \
  -e OTP_CODE="${OTP_CODE:-}" \
  -e UNREGISTERED_PHONE_NUMBER="${UNREGISTERED_PHONE_NUMBER:-}" \
  -e PHONE="${PHONE:-}" \
  -e OTP="${OTP:-}" \
  -e PROFILE_NAME_B="${PROFILE_NAME_B:-}" \
  -e PROFILE_BASIC_NAME="${PROFILE_BASIC_NAME:-}" \
  -e PROFILE_PRO_NAME="${PROFILE_PRO_NAME:-}" \
  --format junit \
  --output "$REPORT_DIR/report.xml"

echo "Xong. Báo cáo JUnit tại $REPORT_DIR/report.xml"
