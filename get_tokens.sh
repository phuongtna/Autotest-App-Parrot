#!/bin/bash
# Tự động lấy CMS_TOKEN và EXAM_COOKIE bằng tài khoản CMS, thay cho cách lấy tay qua DevTools
# (đăng nhập cms.parrotedu.vn/exam.parrotedu.vn rồi copy header) nêu ở đầu file refresh_data.py.
# Gọi 2 API của CMS:
#   1. POST /api/cms/login        (CMS_USERNAME/CMS_PASSWORD) -> CMS_TOKEN
#   2. GET  /api/cms/exams/token  (Bearer CMS_TOKEN)          -> EXAM_COOKIE
# rồi GHI ĐÈ 2 dòng CMS_TOKEN=/EXAM_COOKIE= trong .env ở thư mục gốc repo (giữ nguyên các dòng
# khác) để refresh_data.py/run.sh phía sau đọc qua biến môi trường.
#
# Cả 2 token đều là JWT ngắn hạn (hết hạn sau vài ngày) - chạy lại script này để lấy token mới
# mỗi khi refresh_data.py báo lỗi 401/hết hạn.
#
# Cách dùng:
#   1. Sao chép .env.example thành .env, điền CMS_USERNAME/CMS_PASSWORD (chỉ làm 1 lần)
#   2. ./get_tokens.sh
#   3. set -a; source .env; set +a   (để nạp CMS_TOKEN/EXAM_COOKIE vào shell hiện tại)

set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE=".env"
[ -f "$ENV_FILE" ] || {
  echo "Không tìm thấy $ENV_FILE - sao chép $ENV_FILE.example thành $ENV_FILE rồi điền CMS_USERNAME/CMS_PASSWORD." >&2
  exit 1
}

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${CMS_USERNAME:?Thiếu CMS_USERNAME trong $ENV_FILE}"
: "${CMS_PASSWORD:?Thiếu CMS_PASSWORD trong $ENV_FILE}"

echo "Đang đăng nhập CMS (username=$CMS_USERNAME)..."
LOGIN_BODY="$(jq -nc --arg u "$CMS_USERNAME" --arg p "$CMS_PASSWORD" '{username:$u,password:$p}')"
# STAGING (2026-08-20): API host là parrotedu-staging.parrotedu.vn (KHÔNG phải cms-staging.parrotedu.vn
# - đó chỉ là front-end SPA, đã xác nhận qua curl - giống quan hệ parrotedu.vn/api/cms vs
# cms.parrotedu.vn ở bản production cũ).
LOGIN_RESP="$(curl -sS --fail-with-body 'https://parrotedu-staging.parrotedu.vn/api/cms/login' \
  -H 'accept: */*' \
  -H 'content-type: application/json' \
  -H 'origin: https://cms-staging.parrotedu.vn' \
  -H 'referer: https://cms-staging.parrotedu.vn/' \
  --data-raw "$LOGIN_BODY")" || {
  echo "Đăng nhập CMS thất bại: $LOGIN_RESP" >&2
  exit 1
}

CMS_TOKEN_NEW="$(echo "$LOGIN_RESP" | jq -er '.data.token // .data.access_token // .token // empty')" || {
  echo "Không tìm thấy token trong response login: $LOGIN_RESP" >&2
  exit 1
}
echo "  Lấy được CMS_TOKEN."

echo "Đang lấy EXAM_COOKIE..."
EXAM_RESP="$(curl -sS --fail-with-body 'https://parrotedu-staging.parrotedu.vn/api/cms/exams/token' \
  -H 'accept: */*' \
  -H "authorization: Bearer $CMS_TOKEN_NEW" \
  -H 'origin: https://cms-staging.parrotedu.vn' \
  -H 'referer: https://cms-staging.parrotedu.vn/')" || {
  echo "Lấy EXAM_COOKIE thất bại: $EXAM_RESP" >&2
  exit 1
}

EXAM_COOKIE_NEW="$(echo "$EXAM_RESP" | jq -er '.data.token // empty')" || {
  echo "Không tìm thấy token trong response exams/token: $EXAM_RESP" >&2
  exit 1
}
echo "  Lấy được EXAM_COOKIE."

# Ghi đè 2 dòng CMS_TOKEN=/EXAM_COOKIE= trong .env, giữ nguyên các dòng khác (dùng file tạm + mv
# để không làm hỏng .env nếu bị ngắt giữa chừng).
TMP_FILE="$(mktemp)"
awk -v tok="$CMS_TOKEN_NEW" -v cookie="$EXAM_COOKIE_NEW" '
  BEGIN { done_tok=0; done_cookie=0 }
  /^CMS_TOKEN=/   { print "CMS_TOKEN=" tok; done_tok=1; next }
  /^EXAM_COOKIE=/ { print "EXAM_COOKIE=" cookie; done_cookie=1; next }
  { print }
  END {
    if (!done_tok) print "CMS_TOKEN=" tok
    if (!done_cookie) print "EXAM_COOKIE=" cookie
  }
' "$ENV_FILE" > "$TMP_FILE"
mv "$TMP_FILE" "$ENV_FILE"

echo "Đã cập nhật CMS_TOKEN/EXAM_COOKIE trong $ENV_FILE."
echo "Chạy: set -a; source $ENV_FILE; set +a   (rồi chạy refresh_data.py/run.sh như bình thường)"
