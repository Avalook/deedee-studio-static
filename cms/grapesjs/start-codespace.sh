#!/usr/bin/env bash
# Run the CMS inside a GitHub Codespace of this repo. Publishing commits to the repo with the
# Codespace's own GitHub credentials, so no token or Render account is needed.
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
data="${POC_DATA_DIR:-$repo/cms/grapesjs/data}"
cd "$repo"

# Already running (start and attach hooks may both call this script).
if (exec 3<>/dev/tcp/127.0.0.1/${POC_PORT:-4174}) 2>/dev/null; then exit 0; fi

# Static copy of the site that the editor frames (same server the local setup uses).
if ! (exec 3<>/dev/tcp/127.0.0.1/4173) 2>/dev/null; then
  python3 serve.py > /tmp/deedee-static.log 2>&1 &
fi

# First run only: generate strong random passwords and keep them in the (git-ignored) data dir.
if [ ! -f "$data/users.json" ]; then
  mkdir -p "$data"
  pw() { node -e "process.stdout.write(require('crypto').randomBytes(18).toString('base64url'))"; }
  umask 077
  {
    echo "admin     $(pw)"
    echo "publisher $(pw)"
    echo "editor    $(pw)"
  } > "$data/FIRST-RUN-PASSWORDS.txt"
  echo "First run: passwords saved to cms/grapesjs/data/FIRST-RUN-PASSWORDS.txt (change them in /admin/users, then delete the file)."
fi
if [ -f "$data/FIRST-RUN-PASSWORDS.txt" ]; then
  export POC_ADMIN_PASSWORD="$(awk '$1=="admin"{print $2}' "$data/FIRST-RUN-PASSWORDS.txt")"
  export POC_PUBLISHER_PASSWORD="$(awk '$1=="publisher"{print $2}' "$data/FIRST-RUN-PASSWORDS.txt")"
  export POC_EDITOR_PASSWORD="$(awk '$1=="editor"{print $2}' "$data/FIRST-RUN-PASSWORDS.txt")"
fi

# Optional separate media repository (set CMS_MEDIA_REPO=owner/name): uploaded images and videos are published there
# so this repository stays small. If it cannot be cloned, uploads fall back to this repository.
if [ -n "${CMS_MEDIA_REPO:-}" ]; then
  media_dir="${CMS_MEDIA_REPO_DIR:-$(dirname "$repo")/${CMS_MEDIA_REPO##*/}}"
  if [ ! -d "$media_dir/.git" ]; then
    git clone --quiet "https://github.com/$CMS_MEDIA_REPO.git" "$media_dir" \
      || echo "WARNING: could not clone $CMS_MEDIA_REPO; media stays in this repository."
  fi
  if [ -d "$media_dir/.git" ]; then
    owner="${CMS_MEDIA_REPO%%/*}"
    export CMS_MEDIA_REPO_DIR="$media_dir"
    export CMS_MEDIA_BASE_URL="${CMS_MEDIA_BASE_URL:-https://$(printf '%s' "$owner" | tr '[:upper:]' '[:lower:]').github.io/${CMS_MEDIA_REPO##*/}}"
  else
    unset CMS_MEDIA_REPO_DIR CMS_MEDIA_BASE_URL
  fi
fi

export CMS_EXPORT=1 CMS_GIT_PUSH="${CMS_GIT_PUSH:-1}"
export CMS_SITE_ORIGIN="${CMS_SITE_ORIGIN:-https://avalook.github.io/deedee-studio-static}"
exec node cms/grapesjs/server.mjs
