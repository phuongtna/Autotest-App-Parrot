#!/usr/bin/env bash
# Liệt kê các package (appId) đã cài trên máy ảo/thiết bị đang kết nối.
# Dùng để tìm đúng appId cần điền vào các file flows/*.yaml
#
# Cách dùng:
#   ./scripts/find_appid.sh            # liệt kê tất cả package của bên thứ 3
#   ./scripts/find_appid.sh parrot     # lọc theo từ khóa

set -euo pipefail

if ! command -v adb &>/dev/null; then
  echo "Không tìm thấy lệnh 'adb'. Hãy đảm bảo Android SDK platform-tools nằm trong PATH." >&2
  exit 1
fi

DEVICES=$(adb devices | tail -n +2 | grep -c "device$" || true)
if [ "$DEVICES" -eq 0 ]; then
  echo "Không có thiết bị/máy ảo nào đang kết nối. Hãy mở máy ảo trong Android Studio (AVD Manager) trước." >&2
  exit 1
fi

KEYWORD="${1:-}"
if [ -n "$KEYWORD" ]; then
  adb shell pm list packages -3 | sed 's/^package://' | grep -i "$KEYWORD"
else
  adb shell pm list packages -3 | sed 's/^package://' | sort
fi
