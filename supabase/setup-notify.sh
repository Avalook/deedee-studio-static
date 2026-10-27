#!/usr/bin/env bash
# CLI alternative to the Dashboard steps in docs/SUPABASE-NOTIFY.md: sets the secrets and (re)deploys the function.
# Run it yourself in a terminal: it asks for the Resend API key with a hidden prompt, so the key never appears
# in a chat, a command line or this repository. Needs the Supabase CLI, already logged in (`supabase login`).
set -euo pipefail
cd "$(dirname "$0")/.."
REF="${SUPABASE_PROJECT_REF:-eyecmmwnvlhubzvijktf}"
command -v supabase >/dev/null || { echo "Cần cài Supabase CLI trước: https://supabase.com/docs/guides/cli"; exit 1; }

read -r -p "Email nhận thông báo [avalook.dev@gmail.com]: " TO; TO="${TO:-avalook.dev@gmail.com}"
read -r -s -p "Dán Resend API key (gõ ẩn, bắt đầu bằng re_): " KEY; echo
case "$KEY" in re_*) ;; *) echo "Khóa Resend phải bắt đầu bằng re_"; exit 1;; esac
# resend.dev can only deliver to the Resend account's own email. A verified domain lifts that limit.
FROM="${NOTIFY_FROM:-DeeDee Studio <onboarding@resend.dev>}"

ENVFILE="$(mktemp)"; chmod 600 "$ENVFILE"; trap 'rm -f "$ENVFILE"' EXIT
printf 'RESEND_API_KEY=%s\nNOTIFY_FROM=%s\nNOTIFY_TO=%s\n' "$KEY" "$FROM" "$TO" > "$ENVFILE"
supabase secrets set --project-ref "$REF" --env-file "$ENVFILE"
supabase functions deploy notify-submission --project-ref "$REF" --no-verify-jwt

echo
echo "Xong: secret đã đặt và hàm đã triển khai. Webhook form_submissions/comments (Supabase Dashboard → Database → Webhooks) trỏ tới hàm notify-submission; không cần mã bí mật."
echo "Thử: gửi một form trên trang web, mail đến $TO trong vài giây."
