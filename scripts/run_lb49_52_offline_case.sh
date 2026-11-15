#!/usr/bin/env bash
# Chay LB-49_to_52-mat-mang.yaml (On thi - mat mang trong luc lam bai) - dat 1 background timer
# tat mang SAU ${OFFLINE_DELAY_SEC}s (du thoi gian login + mo de), giu mat mang ${OFFLINE_DURATION_SEC}s
# (du thoi gian toast + chon dap an offline), roi tu dong bat lai mang - KHOP voi cac buoc cho
# (extendedWaitUntil) ben trong file .yaml. Maestro khong co lenh bat/tat mang built-in nen buoc
# nay PHAI lam bang adb ben ngoai (cung ky thuat da dung o scripts/run_rkl17_offline_case.sh).
#
# `trap` luon bat lai mang khi script ket thuc (ke ca FAIL/Ctrl+C) - KHONG bao gio de may that ket
# kep o trang thai mat mang.
#
# Yeu cau: PHONE/OTP doc tu test_data/accounts.env (giong RKL-17).
#
# Chay (TC_49..51):
#   ./scripts/run_lb49_52_offline_case.sh <DE_NAME_PER_SECTION>
#
# Chay bien the TC_52 (GATED, can fixture thoi luong rat ngan):
#   ./scripts/run_lb49_52_offline_case.sh <DE_NAME_PER_SECTION> --lb52 <DE_NAME_SHORT_TIMER_WHOLE_EXAM>
set -euo pipefail

DE_NAME_PER_SECTION="${1:?Thiếu tham số DE_NAME_PER_SECTION, vd: ./scripts/run_lb49_52_offline_case.sh \"Đề kiểm tra giữa kỳ\"}"
LB52_MODE="${2:-}"
DE_NAME_SHORT_TIMER_WHOLE_EXAM="${3:-}"

OFFLINE_DELAY_SEC="${OFFLINE_DELAY_SEC:-30}"
OFFLINE_DURATION_SEC="${OFFLINE_DURATION_SEC:-20}"

cd "$(dirname "$0")/.."
set -a
source test_data/accounts.env
set +a

restore_network() {
  echo "[run_lb49_52_offline_case] Bật lại wifi + dữ liệu di động..."
  adb shell svc wifi enable || true
  adb shell svc data enable || true
}
trap restore_network EXIT

if [ "$LB52_MODE" = "--lb52" ]; then
  DE_NAME_SHORT_TIMER_WHOLE_EXAM="${DE_NAME_SHORT_TIMER_WHOLE_EXAM:?Thiếu DE_NAME_SHORT_TIMER_WHOLE_EXAM cho biến thể --lb52}"
  echo "[run_lb49_52_offline_case] Che do TC_52: tắt mạng NGAY rồi chờ hết giờ, giữ mất mạng lâu hơn thời lượng đề..."
  adb shell svc wifi disable
  adb shell svc data disable
  ( sleep "${OFFLINE_DURATION_SEC}"; adb shell svc wifi enable || true; adb shell svc data enable || true ) &
  RESTORE_PID=$!
  maestro test flows/app/on_thi/LB-49_to_52-mat-mang.yaml \
    -e APP_ID="${APP_ID}" -e PHONE="${PHONE}" -e OTP="${OTP}" \
    -e DE_NAME_PER_SECTION="${DE_NAME_PER_SECTION}" \
    -e RUN_LB52_TIMEOUT_WHILE_OFFLINE="true" \
    -e DE_NAME_SHORT_TIMER_WHOLE_EXAM="${DE_NAME_SHORT_TIMER_WHOLE_EXAM}"
  wait "$RESTORE_PID" || true
  exit 0
fi

echo "[run_lb49_52_offline_case] Lịch tắt mạng sau ${OFFLINE_DELAY_SEC}s, giữ ${OFFLINE_DURATION_SEC}s rồi tự bật lại..."
( sleep "${OFFLINE_DELAY_SEC}"
  adb shell svc wifi disable
  adb shell svc data disable
  sleep "${OFFLINE_DURATION_SEC}"
  adb shell svc wifi enable || true
  adb shell svc data enable || true
) &
RESTORE_PID=$!

maestro test flows/app/on_thi/LB-49_to_52-mat-mang.yaml \
  -e APP_ID="${APP_ID}" -e PHONE="${PHONE}" -e OTP="${OTP}" \
  -e DE_NAME_PER_SECTION="${DE_NAME_PER_SECTION}" \
  -e OFFLINE_WAIT_MS="$(( (OFFLINE_DELAY_SEC + 10) * 1000 ))" \
  -e RECONNECT_WAIT_MS="$(( (OFFLINE_DURATION_SEC + 5) * 1000 ))"

wait "$RESTORE_PID" || true
