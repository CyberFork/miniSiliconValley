#!/bin/sh
set -eu
BASE=${MINISV_BASE_URL:-http://127.0.0.1:18780}
HOST=${MINISV_HOST_HEADER:-minisv.vip}
CURL=${CURL:-/usr/bin/curl}
probe() {
  path=$1 expected=$2
  status=$($CURL -sS -o /dev/null -w '%{http_code}' -H "Host: $HOST" "$BASE$path")
  [ "$status" = "$expected" ] || { echo "FAIL $path expected=$expected actual=$status" >&2; return 1; }
  printf 'OK %s %s\n' "$path" "$status"
}
probe /healthz 200
probe / 200
probe /world/ 200
probe /course/ 200
probe /framework/ 200
probe /parents/ 200
probe /workshop/ 200
probe /workshop/confirmed-baseline.json 200
probe /favicon.svg 200
probe /this-worldline-does-not-exist 404
probe /classroom/ 307
probe /alpha/ 200
probe /alpha/seat.html 200
probe /alpha/seat.js 200
probe /alpha/course-preview.js 200
probe /alpha/course-preview.css 200
probe /control/ 303
# Public console must never proxy controller secrets.
probe /alpha/api/bootstrap 404
probe /alpha/api/script 404
printf 'MINISV_HECATE_HEALTHY\n'
