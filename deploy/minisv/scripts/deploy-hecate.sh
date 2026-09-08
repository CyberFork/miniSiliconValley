#!/bin/zsh
set -euo pipefail
umask 077

: "${MINISV_RELEASE_ARCHIVE:?set MINISV_RELEASE_ARCHIVE to the release tar.gz}"
: "${MINISV_RELEASE_ID:?set MINISV_RELEASE_ID}"
: "${MINISV_ACCOUNTS_SOURCE:?set MINISV_ACCOUNTS_SOURCE to a private account JSON}"
: "${MINISV_TUNNEL_ID:?set MINISV_TUNNEL_ID}"
: "${MINISV_TUNNEL_CREDENTIAL_SOURCE:=$HOME/.cloudflared/$MINISV_TUNNEL_ID.json}"

ROOT="$HOME/Services/minisv"
CLASSROOM_ROOT="$HOME/Services/msv-classroom"
RELEASES="$ROOT/releases"
TARGET="$RELEASES/$MINISV_RELEASE_ID"
INCOMING="$RELEASES/.incoming-$MINISV_RELEASE_ID"
BACKUP="$ROOT/backups/$(date -u +%Y%m%dT%H%M%SZ)-$MINISV_RELEASE_ID"
DOCKER=/usr/local/bin/docker
PYTHON=/opt/homebrew/bin/python3
NODE=/opt/homebrew/bin/node
CURL=/usr/bin/curl
UID_VALUE=$(id -u)
DOMAIN="gui/$UID_VALUE"
CLASSROOM_LABEL="com.cyberforker.msv-classroom"
CLASSROOM_PLIST="$HOME/Library/LaunchAgents/$CLASSROOM_LABEL.plist"
TUNNEL_RELOAD_REQUIRED=0
DEPLOY_MUTATED=0
PREVIOUS_RELEASE_ID=""

classroom_ready() {
  local http_status
  http_status=$($CURL -sS --connect-timeout 2 -o /dev/null -w '%{http_code}'     -H 'Host: minisv.vip' -H 'X-Forwarded-Host: minisv.vip' -H 'X-Forwarded-Proto: https'     http://127.0.0.1:18787/api/auth/session 2>/dev/null || true)
  [[ "$http_status" = 200 || "$http_status" = 401 ]]
}

restart_classroom() {
  local error_log="$BACKUP/$CLASSROOM_LABEL.bootstrap.log"
  for attempt in {1..10}; do
    launchctl bootout "$DOMAIN/$CLASSROOM_LABEL" >/dev/null 2>&1 || true
    sleep 1
    : > "$error_log"
    local loaded=0
    if launchctl bootstrap "$DOMAIN" "$CLASSROOM_PLIST" 2>"$error_log"; then
      loaded=1
    elif launchctl print "$DOMAIN/$CLASSROOM_LABEL" >/dev/null 2>&1; then
      loaded=1
    fi
    if [[ "$loaded" = 1 ]]; then
      launchctl enable "$DOMAIN/$CLASSROOM_LABEL"
      for readiness_attempt in {1..30}; do
        if launchctl print "$DOMAIN/$CLASSROOM_LABEL" >/dev/null 2>&1 && classroom_ready; then
          echo "classroom worker ready (attempt $attempt)"
          return 0
        fi
        sleep 1
      done
    fi
  done
  sed -E '/token|cookie|password|credential/Id' "$error_log" >&2 || true
  echo "classroom worker did not become ready after 10 attempts" >&2
  return 1
}

ensure_cloudflared() {
  local label="com.minisv.cloudflared"
  local plist="$HOME/Library/LaunchAgents/com.minisv.cloudflared.plist"
  local error_log="$BACKUP/$label.bootstrap.log"

  if [[ "$TUNNEL_RELOAD_REQUIRED" = 0 ]]      && launchctl print "$DOMAIN/$label" >/dev/null 2>&1      && $CURL -fsS http://127.0.0.1:18792/metrics >/dev/null; then
    echo "cloudflared preserved (healthy; effective inputs unchanged)"
    return 0
  fi

  for attempt in {1..10}; do
    launchctl bootout "$DOMAIN/$label" >/dev/null 2>&1 || true
    sleep 2
    : > "$error_log"
    local loaded=0
    if launchctl bootstrap "$DOMAIN" "$plist" 2>"$error_log"; then
      loaded=1
    elif launchctl print "$DOMAIN/$label" >/dev/null 2>&1; then
      loaded=1
    fi
    if [[ "$loaded" = 1 ]]; then
      launchctl enable "$DOMAIN/$label"
      for readiness_attempt in {1..15}; do
        if launchctl print "$DOMAIN/$label" >/dev/null 2>&1            && $CURL -fsS http://127.0.0.1:18792/metrics >/dev/null; then
          echo "cloudflared ready (attempt $attempt)"
          return 0
        fi
        sleep 1
      done
    fi
  done
  sed -E '/token|credential/Id' "$error_log" >&2 || true
  echo "cloudflared did not become ready after 10 attempts" >&2
  return 1
}

restore_file() {
  local backup_name=$1 target=$2
  [[ -f "$BACKUP/$backup_name" ]] && cp -p "$BACKUP/$backup_name" "$target"
}

rollback_failed_deploy() {
  local failure=$?
  trap - ERR
  [[ "$DEPLOY_MUTATED" = 1 ]] || exit "$failure"
  echo "deployment failed; restoring previous unified release" >&2
  # Restore the exact symlink target captured before mutation. The first
  # unified deployment may be upgrading from a legacy static-only release, so
  # rollback must not require that previous release to pass the new validator.
  if [[ -f "$BACKUP/previous-current.txt" ]]; then
    "$PYTHON" - "$ROOT" "$BACKUP/previous-current.txt" <<'PY' || true
from pathlib import Path
import os, sys
root = Path(sys.argv[1])
target = Path(sys.argv[2]).read_text().strip()
if not target or Path(target).is_absolute() or '..' in Path(target).parts:
    raise SystemExit('unsafe previous current target')
temporary = root / f'.rollback-current-{os.getpid()}'
temporary.unlink(missing_ok=True)
temporary.symlink_to(target)
os.replace(temporary, root / 'current')
PY
  fi
  restore_file compose.yml "$ROOT/compose.yml"
  restore_file default.conf "$ROOT/gateway/default.conf"
  restore_file app-proxy.conf "$ROOT/gateway/app-proxy.conf"
  restore_file config.yml "$ROOT/cloudflared/config.yml"
  if [[ -f "$BACKUP/$CLASSROOM_LABEL.plist" ]]; then
    cp -p "$BACKUP/$CLASSROOM_LABEL.plist" "$CLASSROOM_PLIST"
  elif [[ -n "$PREVIOUS_RELEASE_ID" && -f "$RELEASES/$PREVIOUS_RELEASE_ID/ops/launchd/$CLASSROOM_LABEL.plist" ]]; then
    "$PYTHON" - "$RELEASES/$PREVIOUS_RELEASE_ID/ops/launchd/$CLASSROOM_LABEL.plist" "$CLASSROOM_PLIST" "$HOME" <<'PY'
from pathlib import Path
import sys
source,target,home=sys.argv[1:]
Path(target).write_text(Path(source).read_text().replace('__HOME__',home))
PY
  fi
  restart_classroom || true
  # A first unified deployment retires the two legacy mutable runtimes. If a
  # later health gate fails, rollback must restore not only the old static
  # pointer but also every legacy agent that actually existed before mutation.
  for legacy_label in com.minisv.live-run-controller com.minisv.remote-console; do
    local legacy_backup="$BACKUP/$legacy_label.plist"
    local legacy_target="$HOME/Library/LaunchAgents/$legacy_label.plist"
    if [[ -f "$legacy_backup" ]]; then
      cp -p "$legacy_backup" "$legacy_target"
      chmod 600 "$legacy_target"
      launchctl enable "$DOMAIN/$legacy_label" >/dev/null 2>&1 || true
      if ! launchctl print "$DOMAIN/$legacy_label" >/dev/null 2>&1; then
        launchctl bootstrap "$DOMAIN" "$legacy_target" >/dev/null 2>&1 || true
      fi
      launchctl kickstart -k "$DOMAIN/$legacy_label" >/dev/null 2>&1 || true
    fi
  done
  (cd "$ROOT" && "$DOCKER" compose -f compose.yml up -d --force-recreate gateway) || true
  echo "MINISV_DEPLOY_ROLLED_BACK release=$PREVIOUS_RELEASE_ID failed=$MINISV_RELEASE_ID backup=$BACKUP" >&2
  exit "$failure"
}
trap rollback_failed_deploy ERR

[[ "$MINISV_RELEASE_ID" =~ '^[A-Za-z0-9._-]+$' ]] || { echo "invalid release id" >&2; exit 2; }
[[ -f "$MINISV_RELEASE_ARCHIVE" && -f "$MINISV_ACCOUNTS_SOURCE" && -f "$MINISV_TUNNEL_CREDENTIAL_SOURCE" ]] || { echo "required deployment input missing" >&2; exit 2; }
[[ -x "$DOCKER" && -x "$PYTHON" && -x "$NODE" && -x /opt/homebrew/bin/cloudflared ]] || { echo "required Hecate runtime missing" >&2; exit 2; }
[[ -f "$CLASSROOM_ROOT/runtime/node_modules/wrangler/bin/wrangler.js" ]] || { echo "classroom wrangler runtime missing" >&2; exit 2; }
[[ -f "$ROOT/secrets/classroom.env" ]] || { echo "classroom environment file missing" >&2; exit 2; }
$CURL -fsS http://127.0.0.1:18789/health >/dev/null

mkdir -p "$RELEASES" "$ROOT/backups" "$ROOT/secrets" "$ROOT/logs" "$ROOT/gateway" "$ROOT/cloudflared"   "$CLASSROOM_ROOT/data" "$CLASSROOM_ROOT/logs"
chmod 700 "$ROOT" "$RELEASES" "$ROOT/backups" "$ROOT/secrets" "$ROOT/logs" "$ROOT/cloudflared" "$CLASSROOM_ROOT/data" "$CLASSROOM_ROOT/logs"
mkdir -p "$BACKUP"
if [[ -L "$ROOT/current" ]]; then
  readlink "$ROOT/current" > "$BACKUP/previous-current.txt"
  PREVIOUS_RELEASE_ID=$(basename "$(cat "$BACKUP/previous-current.txt")")
fi
for item in "$ROOT/compose.yml" "$ROOT/gateway/default.conf" "$ROOT/gateway/app-proxy.conf" "$ROOT/cloudflared/config.yml"; do
  [[ -f "$item" ]] && cp -p "$item" "$BACKUP/$(basename "$item")"
done
for label in "$CLASSROOM_LABEL" com.minisv.live-run-controller com.minisv.remote-console com.minisv.cloudflared; do
  p="$HOME/Library/LaunchAgents/$label.plist"; [[ -f "$p" ]] && cp -p "$p" "$BACKUP/$label.plist"
done

[[ ! -e "$TARGET" ]] || { echo "release already exists: $TARGET" >&2; exit 2; }
"$PYTHON" - "$INCOMING" <<'PY'
from pathlib import Path
import shutil,sys
shutil.rmtree(Path(sys.argv[1]), ignore_errors=True)
PY
mkdir "$INCOMING"
"$PYTHON" - "$MINISV_RELEASE_ARCHIVE" "$INCOMING" <<'PY'
from pathlib import Path, PurePosixPath
import sys, tarfile
archive, target = map(Path, sys.argv[1:])
with tarfile.open(archive, 'r:gz') as source:
    for member in source.getmembers():
        path = PurePosixPath(member.name)
        if path.is_absolute() or '..' in path.parts or member.issym() or member.islnk() or member.isdev():
            raise SystemExit(f'unsafe release archive member: {member.name}')
    source.extractall(target, filter='data')
PY
[[ -f "$INCOMING/MANIFEST.sha256" && -f "$INCOMING/site/MANIFEST.sha256"    && -f "$INCOMING/app/dist/server/index.js" && -f "$INCOMING/app/dist/server/wrangler.json"    && -f "$INCOMING/app/dist/client/vinext-client-entry-manifest.json"    && -f "$INCOMING/ops/compose.yml"    && -f "$INCOMING/ops/launchd/com.minisv.cloudflared.plist"    && -f "$INCOMING/ops/launchd/$CLASSROOM_LABEL.plist" ]] || { echo "unified release archive incomplete" >&2; exit 2; }
"$PYTHON" -B - "$INCOMING" <<'PY'
from pathlib import Path
import importlib.util, sys
root = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location('minisv_bundle', root / 'ops' / 'package_bundle.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.verify_manifest(root)
module.verify_manifest(root / 'site')
module.validate_app_dist(root / 'app' / 'dist')
PY
plutil -lint "$INCOMING/ops/launchd/com.minisv.cloudflared.plist" >/dev/null
plutil -lint "$INCOMING/ops/launchd/$CLASSROOM_LABEL.plist" >/dev/null
mv "$INCOMING" "$TARGET"
chmod -R go-w "$TARGET"

if [[ ! -f "$ROOT/secrets/tunnel-credentials.json" ]]    || ! cmp -s "$MINISV_TUNNEL_CREDENTIAL_SOURCE" "$ROOT/secrets/tunnel-credentials.json"; then
  TUNNEL_RELOAD_REQUIRED=1
fi
"$PYTHON" - "$MINISV_ACCOUNTS_SOURCE" "$ROOT/secrets/accounts.json"   "$MINISV_TUNNEL_CREDENTIAL_SOURCE" "$ROOT/secrets/tunnel-credentials.json" <<'PY'
from pathlib import Path
import shutil, sys
for source_value, target_value in zip(sys.argv[1::2], sys.argv[2::2]):
    source, target = Path(source_value), Path(target_value)
    if source.resolve() != target.resolve():
        shutil.copy2(source, target)
PY
chmod 600 "$ROOT/secrets/accounts.json" "$ROOT/secrets/tunnel-credentials.json" "$ROOT/secrets/classroom.env"
cp "$TARGET/ops/compose.yml" "$ROOT/compose.yml"
cp "$TARGET/ops/gateway/default.conf" "$ROOT/gateway/default.conf"
cp "$TARGET/ops/gateway/app-proxy.conf" "$ROOT/gateway/app-proxy.conf"

cloudflared_config_next="$ROOT/cloudflared/config.yml.next.$$"
"$PYTHON" - "$TARGET/ops/cloudflared/config.yml.template" "$cloudflared_config_next" "$HOME" "$MINISV_TUNNEL_ID" <<'PY'
from pathlib import Path
import sys
source,target,home,tunnel_id=sys.argv[1:]
Path(target).write_text(Path(source).read_text().replace('__HOME__',home).replace('__TUNNEL_ID__',tunnel_id))
PY
chmod 600 "$cloudflared_config_next"
if [[ -f "$ROOT/cloudflared/config.yml" ]] && cmp -s "$cloudflared_config_next" "$ROOT/cloudflared/config.yml"; then
  rm "$cloudflared_config_next"
else
  TUNNEL_RELOAD_REQUIRED=1
  mv "$cloudflared_config_next" "$ROOT/cloudflared/config.yml"
fi

mkdir -p "$HOME/Library/LaunchAgents"
for source in "$TARGET/ops/launchd/com.minisv.cloudflared.plist" "$TARGET/ops/launchd/$CLASSROOM_LABEL.plist"; do
  target="$HOME/Library/LaunchAgents/$(basename "$source")"
  target_next="$target.next.$$"
  "$PYTHON" - "$source" "$target_next" "$HOME" <<'PY'
from pathlib import Path
import sys
source,target,home=sys.argv[1:]
Path(target).write_text(Path(source).read_text().replace('__HOME__',home))
PY
  chmod 600 "$target_next"
  if [[ -f "$target" ]] && cmp -s "$target_next" "$target"; then
    rm "$target_next"
  else
    [[ "$(basename "$source")" = "com.minisv.cloudflared.plist" ]] && TUNNEL_RELOAD_REQUIRED=1
    mv "$target_next" "$target"
  fi
  plutil -lint "$target" >/dev/null
done

DEPLOY_MUTATED=1
# Stop once, then snapshot the quiescent D1 directory. Runtime data never
# enters the release and the new CREATE-only schema bootstrap is reversible.
launchctl bootout "$DOMAIN/$CLASSROOM_LABEL" >/dev/null 2>&1 || true
if [[ -d "$CLASSROOM_ROOT/data" ]]; then
  tar -czf "$BACKUP/classroom-data-before.tgz" -C "$CLASSROOM_ROOT" data
  chmod 600 "$BACKUP/classroom-data-before.tgz"
fi

# Retire both global mutable runtimes. Every controller is now keyed by
# classroomId inside the D1-backed worker included in this same release.
for label in com.minisv.live-run-controller com.minisv.remote-console; do
  launchctl bootout "$DOMAIN/$label" >/dev/null 2>&1 || true
  launchctl disable "$DOMAIN/$label" >/dev/null 2>&1 || true
  rm -f "$HOME/Library/LaunchAgents/$label.plist"
done

"$PYTHON" "$TARGET/ops/scripts/switch-current.py" "$ROOT" "$MINISV_RELEASE_ID"
restart_classroom

cd "$ROOT"
"$DOCKER" compose -f compose.yml config -q
"$DOCKER" compose -f compose.yml up -d --force-recreate gateway
ensure_cloudflared

for attempt in {1..30}; do
  if classroom_ready      && $CURL -fsS http://127.0.0.1:18792/metrics >/dev/null      && $CURL -fsS -H 'Host: minisv.vip' http://127.0.0.1:18780/healthz >/dev/null; then
    break
  fi
  sleep 1
  [[ $attempt -lt 30 ]] || { echo "service health timeout; see $BACKUP" >&2; exit 1; }
done
"$ROOT/current/ops/scripts/healthcheck-hecate.sh"
trap - ERR
printf 'MINISV_DEPLOYED release=%s previous=%s backup=%s app=unified
' "$MINISV_RELEASE_ID" "$PREVIOUS_RELEASE_ID" "$BACKUP"
