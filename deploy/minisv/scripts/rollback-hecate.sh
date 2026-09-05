#!/bin/zsh
set -euo pipefail
umask 077
: "${1:?usage: rollback-hecate.sh RELEASE_ID}"
ROOT="$HOME/Services/minisv"
TARGET="$ROOT/releases/$1"
[[ -d "$TARGET" && -f "$TARGET/site/MANIFEST.sha256" ]] || { echo "unknown release" >&2; exit 2; }
/opt/homebrew/bin/python3 "$TARGET/ops/scripts/switch-current.py" "$ROOT" "$1"
for label in com.minisv.live-run-controller com.minisv.remote-console; do
  launchctl kickstart -k "gui/$(id -u)/$label"
done
cd "$ROOT" && /usr/local/bin/docker compose -f compose.yml up -d --force-recreate gateway
"$ROOT/current/ops/scripts/healthcheck-hecate.sh"
printf 'MINISV_ROLLED_BACK release=%s\n' "$1"
