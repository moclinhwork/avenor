#!/usr/bin/env bash
# Lưu khóa Claude API vào .env rồi khởi động lại app. Khóa được nhập ẩn, không lưu vào lịch sử lệnh.
#   bash /opt/avenor/deploy/set-ai.sh
set -euo pipefail
cd /opt/avenor
read -r -s -p "Dan khoa Claude API (sk-ant-...) roi nhan Enter: " KEY; echo
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
case "$KEY" in sk-ant-*) ;; *) echo "Khoa khong dung dinh dang (phai bat dau bang sk-ant-)."; exit 1;; esac
touch .env; chmod 600 .env
grep -v '^ANTHROPIC_API_KEY=' .env > .env.tmp || true
printf 'ANTHROPIC_API_KEY=%s\n' "$KEY" >> .env.tmp
mv .env.tmp .env; chmod 600 .env
unset KEY
bash /opt/avenor/deploy/install.sh
echo "Da bat tro ly AI."
