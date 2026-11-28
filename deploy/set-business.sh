#!/usr/bin/env bash
# Cấu hình nguồn dữ liệu cho module Business rồi khởi động lại app. Khóa bí mật được nhập ẩn, không lưu vào lịch sử lệnh.
#   bash /opt/avenor/deploy/set-business.sh            (hỏi lần lượt, Enter để bỏ qua mục không dùng)
#   bash /opt/avenor/deploy/set-business.sh google     (chỉ Google Ads / GA4 / YouTube)
#   bash /opt/avenor/deploy/set-business.sh meta | tiktok | users
set -euo pipefail
cd /opt/avenor
touch .env; chmod 600 .env
ONLY="${1:-all}"
setv() { # setv TEN GIA_TRI: ghi đè một dòng trong .env
  grep -v "^$1=" .env > .env.tmp || true
  printf '%s=%s\n' "$1" "$2" >> .env.tmp
  mv .env.tmp .env; chmod 600 .env
}
ask() { # ask TEN "Câu hỏi" [an]
  local v
  if [ "${3:-}" = an ]; then read -r -s -p "$2: " v; echo; else read -r -p "$2: " v; fi
  v="$(printf '%s' "$v" | tr -d '[:space:]')"
  if [ -n "$v" ]; then setv "$1" "$v"; echo "  da luu $1"; fi
}
DOMAIN="$(grep '^DOMAIN=' .env | cut -d= -f2)"
if [ "$ONLY" = all ] || [ "$ONLY" = users ]; then
  echo "== Tai khoan Avenor duoc xem Business (Enter = tai khoan dau tien)"
  ask BUSINESS_USERS "Ten dang nhap, cach nhau dau phay"
fi
if [ "$ONLY" = all ] || [ "$ONLY" = google ]; then
  echo "== Google (Ads, GA4, YouTube). Redirect URI: https://$DOMAIN/api/business/oauth/google/callback"
  ask BIZ_GOOGLE_CLIENT_ID "Google OAuth Client ID"
  ask BIZ_GOOGLE_CLIENT_SECRET "Google OAuth Client secret" an
  ask GOOGLE_ADS_DEVELOPER_TOKEN "Google Ads developer token (khong can nua, Enter de bo qua)" an
  ask GOOGLE_ADS_LOGIN_CUSTOMER_ID "Google Ads MCC id (Enter neu khong dung MCC)"
fi
if [ "$ONLY" = all ] || [ "$ONLY" = meta ]; then
  echo "== Meta Ads. Cach 1: app Facebook (redirect https://$DOMAIN/api/business/oauth/meta/callback). Cach 2: token System User co quyen ads_read"
  ask META_APP_ID "Meta App ID (Enter neu dung token)"
  ask META_APP_SECRET "Meta App secret" an
  ask META_ACCESS_TOKEN "Token System User (Enter neu dung app)" an
fi
if [ "$ONLY" = all ] || [ "$ONLY" = tiktok ]; then
  echo "== TikTok (Login Kit + Display API). Redirect URI: https://$DOMAIN/api/business/oauth/tiktok/callback"
  ask TIKTOK_CLIENT_KEY "TikTok Client key"
  ask TIKTOK_CLIENT_SECRET "TikTok Client secret" an
fi
bash /opt/avenor/deploy/install.sh
echo "Xong. Mo Avenor -> Business -> Connections de ket noi."
