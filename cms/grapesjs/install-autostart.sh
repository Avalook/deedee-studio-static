#!/usr/bin/env bash
# Fallback for Codespaces lifecycle hooks that do not keep background processes alive:
# every new terminal makes sure the CMS is running (start-codespace.sh exits at once if it already is).
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
line="[ -f \"$repo/cms/grapesjs/start-codespace.sh\" ] && { setsid nohup bash \"$repo/cms/grapesjs/start-codespace.sh\" >> /tmp/deedee-cms.log 2>&1 < /dev/null & } 2>/dev/null # deedee-cms-autostart"
for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
  [ -f "$rc" ] || continue
  grep -q 'deedee-cms-autostart' "$rc" || printf '\n%s\n' "$line" >> "$rc"
done
