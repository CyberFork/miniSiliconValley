#!/bin/zsh
set -euo pipefail
umask 077
: "${1:?usage: rollback-hecate.sh RELEASE_ID}"

ROOT="$HOME/Services/minisv"
TARGET="$ROOT/releases/$1"
PYTHON=/opt/homebrew/bin/python3
DOCKER=/usr/local/bin/docker
CURL=/usr/bin/curl
LABEL=com.cyberforker.msv-classroom
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

[[ -d "$TARGET" && -f "$TARGET/MANIFEST.sha256" && -f "$TARGET/site/MANIFEST.sha256"   && -f "$TARGET/app/dist/server/index.js" && -f "$TARGET/app/dist/server/wrangler.json"   && -f "$TARGET/ops/launchd/$LABEL.plist" ]] || { echo "unknown or pre-unified release" >&2; exit 2; }

"$PYTHON" -B - "$TARGET" <<'PY'
from pathlib import Path
import importlib.util, sys
root=Path(sys.argv[1])
spec=importlib.util.spec_from_file_location('minisv_bundle', root/'ops/package_bundle.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.verify_manifest(root)
module.verify_manifest(root/'site')
module.validate_app_dist(root/'app/dist')
PY

cp "$TARGET/ops/compose.yml" "$ROOT/compose.yml"
cp "$TARGET/ops/gateway/default.conf" "$ROOT/gateway/default.conf"
cp "$TARGET/ops/gateway/app-proxy.conf" "$ROOT/gateway/app-proxy.conf"
"$PYTHON" - "$TARGET/ops/launchd/$LABEL.plist" "$PLIST" "$HOME" <<'PY'
from pathlib import Path
import sys
source,target,home=sys.argv[1:]
Path(target).write_text(Path(source).read_text().replace('__HOME__',home))
PY
chmod 600 "$PLIST"
plutil -lint "$PLIST" >/dev/null
"$PYTHON" "$TARGET/ops/scripts/switch-current.py" "$ROOT" "$1"

launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "$DOMAIN" "$PLIST" >/dev/null 2>&1 || launchctl print "$DOMAIN/$LABEL" >/dev/null
launchctl enable "$DOMAIN/$LABEL"
for attempt in {1..30}; do
  http_status=$($CURL -sS --connect-timeout 2 -o /dev/null -w '%{http_code}'     -H 'Host: minisv.vip' -H 'X-Forwarded-Host: minisv.vip' -H 'X-Forwarded-Proto: https'     http://127.0.0.1:18787/api/auth/session 2>/dev/null || true)
  [[ "$http_status" = 200 || "$http_status" = 401 ]] && break
  sleep 1
  [[ $attempt -lt 30 ]] || { echo "classroom worker rollback readiness timeout" >&2; exit 1; }
done

cd "$ROOT"
"$DOCKER" compose -f compose.yml config -q
"$DOCKER" compose -f compose.yml up -d --force-recreate gateway
"$ROOT/current/ops/scripts/healthcheck-hecate.sh"
printf 'MINISV_ROLLED_BACK release=%s app=unified
' "$1"
