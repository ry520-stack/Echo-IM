#!/bin/sh
set -eu

url="${GRAFANA_URL:-http://grafana:3000}"
admin_user="${GRAFANA_ADMIN_USER:-admin}"
admin_password="${GRAFANA_ADMIN_PASSWORD:?set GRAFANA_ADMIN_PASSWORD}"
demo_user="${GRAFANA_DEMO_USER:-demo}"
demo_password="${GRAFANA_DEMO_PASSWORD:-echo2026}"

for i in $(seq 1 60); do
  if curl -fsS "$url/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

payload=$(printf '{"name":"Demo","email":"demo@echo-im.local","login":"%s","password":"%s"}' "$demo_user" "$demo_password")
create_response=$(curl -fsS -u "$admin_user:$admin_password" \
  -H 'Content-Type: application/json' \
  -X POST "$url/api/admin/users" \
  -d "$payload" 2>/dev/null || true)

user_id=$(printf '%s' "$create_response" | sed -n 's/.*"id":[ ]*\([0-9][0-9]*\).*/\1/p')
if [ -z "$user_id" ]; then
  users=$(curl -fsS -u "$admin_user:$admin_password" "$url/api/users?perpage=1000")
  user_id=$(printf '%s' "$users" | sed -n "s/.*\"id\":[ ]*\\([0-9][0-9]*\\),[^}]*\"login\":\"$demo_user\".*/\\1/p")
fi

if [ -n "$user_id" ]; then
  curl -fsS -u "$admin_user:$admin_password" \
    -H 'Content-Type: application/json' \
    -X PATCH "$url/api/org/users/$user_id" \
    -d '{"role":"Viewer"}' >/dev/null || true
  echo "Grafana demo user ready: $demo_user"
else
  echo "Failed to create or find Grafana demo user" >&2
  exit 1
fi
