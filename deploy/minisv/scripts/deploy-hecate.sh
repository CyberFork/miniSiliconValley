#!/bin/zsh
set -euo pipefail
umask 077

: "${MINISV_RELEASE_ARCHIVE:?set MINISV_RELEASE_ARCHIVE to the release tar.gz}"
: "${MINISV_RELEASE_ID:?set MINISV_RELEASE_ID}"
: "${MINISV_ACCOUNTS_SOURCE:?set MINISV_ACCOUNTS_SOURCE to a private account JSON}"
: "${MINISV_TUNNEL_ID:?set MINISV_TUNNEL_ID}"
: "${MINISV_TUNNEL_CREDENTIAL_SOURCE:=$HOME/.cloudflared/$MINISV_TUNNEL_ID.json}"

ROOT="$HOME/Services/minisv"
RELEASES="$ROOT/releases"
TARGET="$RELEASES/$MINISV_RELEASE_ID"
INCOMING="$RELEASES/.incoming-$MINISV_RELEASE_ID"
BACKUP="$ROOT/backups/$(date -u +%Y%m%dT%H%M%SZ)-$MINISV_RELEASE_ID"
DOCKER=/usr/local/bin/docker
CURL=/usr/bin/curl
UID_VALUE=$(id -u)
DOMAIN="gui/$UID_VALUE"
TUNNEL_RELOAD_REQUIRED=0

bootstrap_agent() {
  local label=$1
  local plist=$2
  local error_log="$BACKUP/$label.bootstrap.log"
  launchctl bootout "$DOMAIN/$label" >/dev/null 2>&1 || true
  # launchd can briefly retain a booted-out label and return EIO (5) when a
  # rapid second deployment immediately bootstraps the replacement. Retry the
  # real operation and also accept the service if launchd loaded it despite an
  # ambiguous command result.
  for attempt in {1..10}; do
    if launchctl bootstrap "$DOMAIN" "$plist" 2>"$error_log"; then
      launchctl enable "$DOMAIN/$label"
      return 0
    fi
    if launchctl print "$DOMAIN/$label" >/dev/null 2>&1; then
      launchctl enable "$DOMAIN/$label"
      launchctl kickstart -k "$DOMAIN/$label"
      return 0
    fi
    sleep 1
  done
  cat "$error_log" >&2
  echo "failed to bootstrap $label after 10 attempts" >&2
  return 1
}

ensure_cloudflared() {
  local label="com.minisv.cloudflared"
  local plist="$HOME/Library/LaunchAgents/com.minisv.cloudflared.plist"
  local error_log="$BACKUP/$label.bootstrap.log"

  # The tunnel is the public traffic path, not an application release unit.
  # Preserve a healthy process when its effective inputs did not change.
  if [[ "$TUNNEL_RELOAD_REQUIRED" = 0 ]] \
     && launchctl print "$DOMAIN/$label" >/dev/null 2>&1 \
     && $CURL -fsS http://127.0.0.1:18792/metrics >/dev/null; then
    echo "cloudflared preserved (healthy; effective inputs unchanged)"
    return 0
  fi

  # A missing/unhealthy tunnel, or an intentional input change, is recovered
  # as one bounded transaction. A bootstrap command returning success is not
  # enough: metrics readiness is the acceptance condition for every attempt.
  for attempt in {1..10}; do
    launchctl bootout "$DOMAIN/$label" >/dev/null 2>&1 || true
    sleep 2
    : > "$error_log"
    local loaded=0
    if launchctl bootstrap "$DOMAIN" "$plist" 2>"$error_log"; then
      loaded=1
    elif launchctl print "$DOMAIN/$label" >/dev/null 2>&1; then
      # launchd can return EIO even when it accepted the job.
      loaded=1
    fi
    if [[ "$loaded" = 1 ]]; then
      launchctl enable "$DOMAIN/$label"
      for readiness_attempt in {1..15}; do
        if launchctl print "$DOMAIN/$label" >/dev/null 2>&1 \
           && $CURL -fsS http://127.0.0.1:18792/metrics >/dev/null; then
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

[[ "$MINISV_RELEASE_ID" =~ '^[A-Za-z0-9._-]+$' ]] || { echo "invalid release id" >&2; exit 2; }
[[ -f "$MINISV_RELEASE_ARCHIVE" && -f "$MINISV_ACCOUNTS_SOURCE" && -f "$MINISV_TUNNEL_CREDENTIAL_SOURCE" ]] || { echo "required deployment input missing" >&2; exit 2; }
[[ -x "$DOCKER" && -x /opt/homebrew/bin/python3 && -x /opt/homebrew/bin/node && -x /opt/homebrew/bin/cloudflared ]] || { echo "required Hecate runtime missing" >&2; exit 2; }
classroom_status=$($CURL -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:18787/api/auth/session)
[[ "$classroom_status" = 200 || "$classroom_status" = 401 ]] || { echo "classroom worker is not reachable" >&2; exit 2; }
$CURL -fsS http://127.0.0.1:18789/health >/dev/null

mkdir -p "$RELEASES" "$ROOT/backups" "$ROOT/data/controller" "$ROOT/data/console" "$ROOT/data/courses/drafts" "$ROOT/data/courses/published" "$ROOT/data/courses/history" "$ROOT/secrets" "$ROOT/logs" "$ROOT/gateway" "$ROOT/cloudflared"
chmod 700 "$ROOT" "$RELEASES" "$ROOT/backups" "$ROOT/data" "$ROOT/data/controller" "$ROOT/data/console" "$ROOT/data/courses" "$ROOT/data/courses/drafts" "$ROOT/data/courses/published" "$ROOT/data/courses/history" "$ROOT/secrets" "$ROOT/logs" "$ROOT/cloudflared"
mkdir -p "$BACKUP"
if [[ -L "$ROOT/current" ]]; then readlink "$ROOT/current" > "$BACKUP/previous-current.txt"; fi
for item in "$ROOT/compose.yml" "$ROOT/gateway/default.conf" "$ROOT/gateway/app-proxy.conf" "$ROOT/cloudflared/config.yml"; do
  [[ -f "$item" ]] && cp -p "$item" "$BACKUP/$(basename "$item")"
done
for item in "$ROOT/data/controller/run-state.json" "$ROOT/data/console/claims.json"; do
  [[ -f "$item" ]] && cp -p "$item" "$BACKUP/$(basename "$item")"
done
for label in com.minisv.live-run-controller com.minisv.remote-console com.minisv.cloudflared; do
  p="$HOME/Library/LaunchAgents/$label.plist"; [[ -f "$p" ]] && cp -p "$p" "$BACKUP/$label.plist"
done

[[ ! -e "$TARGET" ]] || { echo "release already exists: $TARGET" >&2; exit 2; }
/opt/homebrew/bin/python3 - "$INCOMING" <<'PY'
from pathlib import Path
import shutil,sys
shutil.rmtree(Path(sys.argv[1]), ignore_errors=True)
PY
mkdir "$INCOMING"
tar -xzf "$MINISV_RELEASE_ARCHIVE" -C "$INCOMING"
[[ -f "$INCOMING/site/MANIFEST.sha256" && -f "$INCOMING/live-run/controller.py" && -f "$INCOMING/ops/compose.yml" ]] || { echo "release archive incomplete" >&2; exit 2; }
( cd "$INCOMING/site" && shasum -a 256 -c MANIFEST.sha256 >/dev/null )
/opt/homebrew/bin/python3 -m py_compile "$INCOMING/live-run/controller.py" "$INCOMING/live-run/classroom_api.py" "$INCOMING/live-run/course.py"
/opt/homebrew/bin/node --check "$INCOMING/live-run/remote-console/server.mjs"
for plist in "$INCOMING"/ops/launchd/*.plist; do plutil -lint "$plist" >/dev/null; done
mv "$INCOMING" "$TARGET"
chmod -R go-w "$TARGET"

if [[ ! -f "$ROOT/secrets/tunnel-credentials.json" ]] \
   || ! cmp -s "$MINISV_TUNNEL_CREDENTIAL_SOURCE" "$ROOT/secrets/tunnel-credentials.json"; then
  TUNNEL_RELOAD_REQUIRED=1
fi
/opt/homebrew/bin/python3 - "$MINISV_ACCOUNTS_SOURCE" "$ROOT/secrets/accounts.json" \
  "$MINISV_TUNNEL_CREDENTIAL_SOURCE" "$ROOT/secrets/tunnel-credentials.json" <<'PY'
from pathlib import Path
import shutil
import sys

for source_value, target_value in zip(sys.argv[1::2], sys.argv[2::2]):
    source = Path(source_value)
    target = Path(target_value)
    # An in-place redeploy may deliberately reuse the already-provisioned
    # secret. shutil.copy2, like cp, rejects source == destination.
    if source.resolve() != target.resolve():
        shutil.copy2(source, target)
PY
chmod 600 "$ROOT/secrets/accounts.json" "$ROOT/secrets/tunnel-credentials.json"
if [[ ! -f "$ROOT/secrets/controller-service.key" ]]; then
  /usr/bin/openssl rand -base64 48 > "$ROOT/secrets/controller-service.key"
fi
chmod 600 "$ROOT/secrets/controller-service.key"

cp "$TARGET/ops/compose.yml" "$ROOT/compose.yml"
cp "$TARGET/ops/gateway/default.conf" "$ROOT/gateway/default.conf"
cp "$TARGET/ops/gateway/app-proxy.conf" "$ROOT/gateway/app-proxy.conf"
cloudflared_config_next="$ROOT/cloudflared/config.yml.next.$$"
/opt/homebrew/bin/python3 - "$TARGET/ops/cloudflared/config.yml.template" "$cloudflared_config_next" "$HOME" "$MINISV_TUNNEL_ID" <<'PY'
from pathlib import Path
import sys
source,target,home,tunnel_id=sys.argv[1:]
value=Path(source).read_text().replace('__HOME__',home).replace('__TUNNEL_ID__',tunnel_id)
Path(target).write_text(value)
PY
chmod 600 "$cloudflared_config_next"
if [[ -f "$ROOT/cloudflared/config.yml" ]] && cmp -s "$cloudflared_config_next" "$ROOT/cloudflared/config.yml"; then
  rm "$cloudflared_config_next"
else
  TUNNEL_RELOAD_REQUIRED=1
  mv "$cloudflared_config_next" "$ROOT/cloudflared/config.yml"
fi

mkdir -p "$HOME/Library/LaunchAgents"
for source in "$TARGET"/ops/launchd/*.plist; do
  target="$HOME/Library/LaunchAgents/$(basename "$source")"
  target_next="$target.next.$$"
  /opt/homebrew/bin/python3 - "$source" "$target_next" "$HOME" <<'PY'
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

/opt/homebrew/bin/python3 "$TARGET/ops/scripts/switch-current.py" "$ROOT" "$MINISV_RELEASE_ID"

bootstrap_agent com.minisv.live-run-controller "$HOME/Library/LaunchAgents/com.minisv.live-run-controller.plist"
bootstrap_agent com.minisv.remote-console "$HOME/Library/LaunchAgents/com.minisv.remote-console.plist"

cd "$ROOT"
$DOCKER compose -f compose.yml config -q
$DOCKER compose -f compose.yml up -d --force-recreate gateway

# Keep the public traffic path alive across ordinary application releases.
# It is restarted only when unhealthy or when its effective inputs changed.
ensure_cloudflared

for attempt in {1..30}; do
  if $CURL -fsS http://127.0.0.1:18790/healthz >/dev/null \
     && $CURL -fsS http://127.0.0.1:18791/healthz >/dev/null \
     && $CURL -fsS http://127.0.0.1:18792/metrics >/dev/null \
     && $CURL -fsS -H 'Host: minisv.vip' http://127.0.0.1:18780/healthz >/dev/null; then
    break
  fi
  sleep 1
  [[ $attempt -lt 30 ]] || { echo "service health timeout; see $BACKUP" >&2; exit 1; }
done
"$ROOT/current/ops/scripts/healthcheck-hecate.sh"
printf 'MINISV_DEPLOYED release=%s backup=%s\n' "$MINISV_RELEASE_ID" "$BACKUP"
