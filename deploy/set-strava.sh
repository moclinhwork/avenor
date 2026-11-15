#!/usr/bin/env bash
# Điền thông tin Strava API app vào .env rồi khởi động lại app.
#   bash /opt/avenor/deploy/set-strava.sh <client-id> <client-secret>
set -euo pipefail
cd /opt/avenor
[ $# -eq 2 ] || { echo "Cách dùng: bash deploy/set-strava.sh <client-id> <client-secret>"; exit 1; }
sed -i "s/^STRAVA_CLIENT_ID=.*/STRAVA_CLIENT_ID=$1/; s/^STRAVA_CLIENT_SECRET=.*/STRAVA_CLIENT_SECRET=$2/" .env
docker compose up -d
echo "Đã cập nhật Strava."
