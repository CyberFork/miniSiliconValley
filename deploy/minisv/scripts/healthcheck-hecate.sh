#!/bin/sh
set -eu
BASE=${MINISV_BASE_URL:-http://127.0.0.1:18780}
HOST=${MINISV_HOST_HEADER:-minisv.vip}
CURL=${CURL:-/usr/bin/curl}
APP_BASE=${MINISV_APP_BASE_URL:-http://127.0.0.1:18787}
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
probe /courseware/product-mentor-foundations/ 200
probe /framework/ 200
probe /parents/ 200
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
assert_retired_port 18790
assert_retired_port 18791
printf 'MINISV_HECATE_HEALTHY\n'
