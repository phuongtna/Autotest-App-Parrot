#!/usr/bin/env bash
# Bật chế độ máy bay (tắt wifi + dữ liệu di động) trước khi chạy RKL-17, rồi LUÔN bật lại mạng
# sau khi chạy xong (kể cả khi maestro test FAIL) - dùng `trap` để không bao giờ để máy thật kẹt
# ở trạng thái mất mạng nếu script bị ngắt giữa chừng (Ctrl+C, lỗi bất ngờ...).
#
# Maestro không có lệnh bật/tắt mạng built-in nên bước này PHẢI làm bằng adb trực tiếp, ngoài
# phạm vi 1 file .yaml Maestro - xem ghi chú đầu file
# flows/app/roi_khoi_lop/RKL-17-leave-offline-shows-error.yaml.
#
# Yêu cầu: PHONE/OTP đọc từ test_data/accounts.env (giống các case khác trong module).
#
# Chạy: ./scripts/run_rkl17_offline_case.sh <PROFILE_WITH_CLASS>
set -euo pipefail

PROFILE_WITH_CLASS="${1:?Thiếu tham số PROFILE_WITH_CLASS, vd: ./scripts/run_rkl17_offline_case.sh Hang}"

cd "$(dirname "$0")/.."
set -a
source test_data/accounts.env
set +a

restore_network() {
  echo "[run_rkl17_offline_case] Bật lại wifi + dữ liệu di động..."
  adb shell svc wifi enable || true
  adb shell svc data enable || true
}
trap restore_network EXIT

echo "[run_rkl17_offline_case] Tắt wifi + dữ liệu di động (mô phỏng mất mạng)..."
adb shell svc wifi disable
adb shell svc data disable
sleep 2

maestro test flows/app/roi_khoi_lop/RKL-17-leave-offline-shows-error.yaml \
  -e APP_ID="${APP_ID}" -e PHONE="${PHONE}" -e OTP="${OTP}" \
  -e PROFILE_WITH_CLASS="${PROFILE_WITH_CLASS}"
