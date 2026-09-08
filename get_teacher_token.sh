#!/bin/bash
# Tự động lấy TEACHER_ACCESS_TOKEN bằng tài khoản giáo viên, thay cho cách lấy tay qua DevTools
# nêu ở automation/README.md mục "Bài tập" (đăng nhập parrotedu.vn/teacher/login rồi copy header).
#
# ĐÃ XÁC NHẬN THẬT (2026-08-09): endpoint login KHÔNG phải OAuth2 Casdoor (đó là của
# exam.parrotedu.vn/Exam Editor - hệ thống khác, xem examSession.js) mà là API JSON bình
# thường:
#   POST /api/auth/login   body {username, password, role:"teacher"}   -> data.token
# Token trả về (Bearer JWT, payload có role:"teacher") đã test THẬT hoạt động một mình (không
# cần cookie đi kèm) với GET /api/user/exams/room.json - TEACHER_SESSION_COOKIE trong .env vẫn
# giữ lại vì automation/src/config.js coi là optional, không xoá bớt.
#
# Token là JWT ngắn hạn (quan sát thật ~1 giờ, xem automation/README.md) - chạy lại script này
# để lấy token mới mỗi khi discover-homework/run-homework-e2e báo lỗi 401/hết hạn.
#
# Cách dùng:
#   1. Sao chép .env.example thành .env (nếu chưa có), điền TEACHER_USERNAME/TEACHER_PASSWORD
#      (chỉ làm 1 lần)
#   2. ./get_teacher_token.sh
#   3. set -a; source .env; set +a   (để nạp TEACHER_ACCESS_TOKEN vào shell hiện tại)

set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE=".env"
[ -f "$ENV_FILE" ] || {
  echo "Không tìm thấy $ENV_FILE - sao chép $ENV_FILE.example thành $ENV_FILE rồi điền TEACHER_USERNAME/TEACHER_PASSWORD." >&2
  exit 1
}

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${TEACHER_USERNAME:?Thiếu TEACHER_USERNAME trong $ENV_FILE}"
: "${TEACHER_PASSWORD:?Thiếu TEACHER_PASSWORD trong $ENV_FILE}"

# SỬA (2026-09-08, sau sự cố thật: automation/src/config.js gọi API bằng token lấy TỪ SCRIPT NÀY
# nhưng script này luôn hardcode production trong khi TEACHER_PORTAL_ENV đã đổi sang staging -
# token production bị 401 khi backend thật là staging, 2 hệ thống tách biệt hoàn toàn). Chọn host
# theo ĐÚNG cơ chế TEACHER_PORTAL_ENV/TEACHER_PORTAL_BASE_URL_STAGING/_PRODUCTION trong .env (xem
# automation/src/config.js#resolveTeacherPortalBaseUrl) thay vì hardcode 1 host cố định.
TEACHER_PORTAL_ENV="${TEACHER_PORTAL_ENV:-staging}"
case "$TEACHER_PORTAL_ENV" in
  staging) TEACHER_HOST="${TEACHER_PORTAL_BASE_URL_STAGING:?Thiếu TEACHER_PORTAL_BASE_URL_STAGING trong $ENV_FILE}" ;;
  production) TEACHER_HOST="${TEACHER_PORTAL_BASE_URL_PRODUCTION:?Thiếu TEACHER_PORTAL_BASE_URL_PRODUCTION trong $ENV_FILE}" ;;
  dev) TEACHER_HOST="${TEACHER_PORTAL_BASE_URL_DEV:?Thiếu TEACHER_PORTAL_BASE_URL_DEV trong $ENV_FILE}" ;;
  *) echo "TEACHER_PORTAL_ENV=\"$TEACHER_PORTAL_ENV\" không hợp lệ - chỉ chấp nhận: dev | staging | production." >&2; exit 1 ;;
esac

echo "Đang đăng nhập giáo viên (username=$TEACHER_USERNAME, môi trường=$TEACHER_PORTAL_ENV, host=$TEACHER_HOST)..."
LOGIN_BODY="$(jq -nc --arg u "$TEACHER_USERNAME" --arg p "$TEACHER_PASSWORD" '{username:$u,password:$p,role:"teacher"}')"
LOGIN_RESP="$(curl -sS --fail-with-body "$TEACHER_HOST/api/auth/login" \
  -H 'accept: */*' \
  -H 'content-type: application/json' \
  -H "origin: $TEACHER_HOST" \
  -H "referer: $TEACHER_HOST/teacher/login" \
  --data-raw "$LOGIN_BODY")" || {
  echo "Đăng nhập giáo viên thất bại: $LOGIN_RESP" >&2
  exit 1
}

TEACHER_TOKEN_NEW="$(echo "$LOGIN_RESP" | jq -er '.data.token // empty')" || {
  echo "Không tìm thấy token trong response login: $LOGIN_RESP" >&2
  exit 1
}
echo "  Lấy được TEACHER_ACCESS_TOKEN."

# Ghi đè dòng TEACHER_ACCESS_TOKEN= trong .env, giữ nguyên các dòng khác (dùng file tạm + mv
# để không làm hỏng .env nếu bị ngắt giữa chừng).
TMP_FILE="$(mktemp)"
awk -v tok="$TEACHER_TOKEN_NEW" '
  BEGIN { done=0 }
  /^TEACHER_ACCESS_TOKEN=/ { print "TEACHER_ACCESS_TOKEN=" tok; done=1; next }
  { print }
  END { if (!done) print "TEACHER_ACCESS_TOKEN=" tok }
' "$ENV_FILE" > "$TMP_FILE"
mv "$TMP_FILE" "$ENV_FILE"

echo "Đã cập nhật TEACHER_ACCESS_TOKEN trong $ENV_FILE."
echo "Chạy: set -a; source $ENV_FILE; set +a   (rồi chạy npm run discover-homework/run-homework-e2e như bình thường)"
