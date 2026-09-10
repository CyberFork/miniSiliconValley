#!/bin/sh
set -eu
BASE=${MINISV_BASE_URL:-http://127.0.0.1:18780}
HOST=${MINISV_HOST_HEADER:-minisv.vip}
CURL=${CURL:-/usr/bin/curl}
APP_BASE=${MINISV_APP_BASE_URL:-http://127.0.0.1:18787}
QA_BASE=${MINISV_QA_BASE_URL:-http://127.0.0.1:18789}
QA_ENV=${MINISV_QA_ENV_FILE:-$HOME/Services/msv-parent-qa/secrets/deepseek.env}
probe() {
  path=$1 expected=$2
  status=$($CURL -sS -o /dev/null -w '%{http_code}' -H "Host: $HOST" "$BASE$path")
  [ "$status" = "$expected" ] || { echo "FAIL $path expected=$expected actual=$status" >&2; return 1; }
  printf 'OK %s %s\n' "$path" "$status"
}
probe_app() {
  path=$1 expected=$2
  status=$($CURL -sS -o /dev/null -w '%{http_code}' -H 'Host: minisv.vip' \
    -H 'X-Forwarded-Host: minisv.vip' -H 'X-Forwarded-Proto: https' "$APP_BASE$path")
  [ "$status" = "$expected" ] || { echo "FAIL app:$path expected=$expected actual=$status" >&2; return 1; }
  printf 'OK app:%s %s\n' "$path" "$status"
}
assert_retired_port() {
  port=$1
  if $CURL -sS --connect-timeout 1 -o /dev/null "http://127.0.0.1:$port/healthz" 2>/dev/null; then
    echo "FAIL retired global runtime still listens on $port" >&2
    return 1
  fi
  printf 'OK retired-port %s closed\n' "$port"
}
probe_app /api/auth/session 401
probe_app /api/internal/course-registry/release 404
probe /healthz 200
probe / 200
probe /world/ 200
probe /course/ 307
probe /studio/ 307
probe /courseware/product-mentor-foundations/ 401
probe /courseware/development-mentor-ligun/ 401
probe /courseware/market-mentor-user-system/ 401
probe /framework/ 200
probe /parents/ 200
probe /api/qa 200
# The review endpoint is loopback-only and must never be a public route.
probe /internal/knowledge-gaps 404
probe /workshop/ 200
probe /workshop/confirmed-baseline.json 200
probe /favicon.svg 200
probe /this-worldline-does-not-exist 404
probe /classroom/ 307
probe /alpha/ 410
probe /control/ 410
# Internal registry never leaves Hecate's loopback app boundary.
probe /api/internal/course-registry/release 404
launchctl print "gui/$(id -u)/com.cyberforker.msv-classroom" >/dev/null
launchctl print "gui/$(id -u)/com.cyberforker.msv-parent-qa" >/dev/null

# Validate both the public-safe health contract and the token-protected
# operational contract without placing the review token in argv or logs.
$CURL -fsS "$QA_BASE/health" | /opt/homebrew/bin/python3 -c '
import json,sys
data=json.load(sys.stdin).get("data", {})
if data.get("status") != "ready" or data.get("knowledgeGapRecording") is not True:
    raise SystemExit("parent Q&A is not ready for grounded answers and durable gap recording")
'
/opt/homebrew/bin/python3 - "$QA_ENV" "$QA_BASE/internal/knowledge-gaps" <<'PY'
from pathlib import Path
import json, re, sys, urllib.request
env_path, url = sys.argv[1:]
token = None
for raw in Path(env_path).read_text(encoding="utf-8").splitlines():
    match = re.match(r"^\s*(?:export\s+)?QA_INTERNAL_REVIEW_TOKEN\s*=\s*(.*?)\s*$", raw)
    if match:
        token = match.group(1).strip("\"'")
if not token or len(token) < 24:
    raise SystemExit("parent Q&A review token is missing or invalid")
request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
with urllib.request.urlopen(request, timeout=5) as response:
    payload = json.load(response)
if response.status != 200 or payload.get("ok") is not True:
    raise SystemExit("parent Q&A internal review health failed")
data = payload.get("data", {})
if not isinstance(data.get("gaps"), list) or not isinstance(data.get("health"), dict):
    raise SystemExit("parent Q&A internal review response is incomplete")
PY
assert_retired_port 18790
assert_retired_port 18791
printf 'MINISV_HECATE_HEALTHY\n'
