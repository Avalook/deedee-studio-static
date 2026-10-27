#!/bin/bash
# Run the CMS on this computer; existing drafts and uploads are preserved.
set -euo pipefail
cd "$(dirname "$0")"

fail() {
  printf '\n%s\n' "$1" >&2
  read -r -p 'Press Enter to close. ' || true
  exit 1
}
command -v node >/dev/null 2>&1 || fail 'Install Node.js 24 LTS, then open this launcher again.'
command -v npm >/dev/null 2>&1 || fail 'npm is missing. Install Node.js with npm.'
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)' \
  || fail 'Node.js 22.12 or newer is required; Node.js 24 LTS is recommended.'

if [ ! -d cms/grapesjs/node_modules/grapesjs ] || [ ! -d cms/grapesjs/node_modules/sanitize-html ]; then
  npm --prefix cms/grapesjs ci --ignore-scripts || fail 'Dependency installation failed. Check your Internet connection and retry.'
fi

export POC_HOST=127.0.0.1
export POC_HOSTED=0
: "${POC_PORT:=4174}"
: "${POC_STATIC_SITE_ORIGIN:=https://avalook.github.io/deedee-studio-static/}"
: "${POC_STATIC_SITE_DIR:=$PWD}"
: "${CMS_EXPORT_DIR:=$PWD}"
: "${CMS_GIT_PUSH:=1}"
export POC_PORT POC_STATIC_SITE_ORIGIN POC_STATIC_SITE_DIR CMS_EXPORT_DIR CMS_GIT_PUSH
printf '\nDeeDee CMS: http://127.0.0.1:%s/admin/content\nKeep this window open. Ctrl+C stops the CMS.\n' "$POC_PORT"
printf 'Publish pushes to GitHub from clean main. Set CMS_GIT_PUSH=0 for local export only.\n\n'
# Wait for readiness before opening the browser; do not expose the server on LAN.
if command -v curl >/dev/null 2>&1; then
  (
    for attempt in {1..30}; do
      if curl --silent --fail "http://127.0.0.1:$POC_PORT/healthz" >/dev/null; then
        open "http://127.0.0.1:$POC_PORT/admin/content"
        exit
      fi
      sleep 1
    done
  ) &
fi
node cms/grapesjs/server.mjs || fail 'CMS stopped with an error. Read the message above; check whether its port is already in use.'
