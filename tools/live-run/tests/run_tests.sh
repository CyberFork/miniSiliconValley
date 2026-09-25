#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export PYTHONPYCACHEPREFIX="${TMPDIR:-/tmp}/msv-live-run-pycache"
python3 course.py --write-json
python3 -m py_compile course.py controller.py classroom_api.py launcher.py launch_grid.py tests/run_real_acceptance.py tests/verify_live_browser.py
node --check static/controller.js
node --check static/editor.js
node --check static/seat.js
node --check remote-console/server.mjs
node --check remote-console/static/console.js
node --check chrome-extension/grid-math.js
node --check chrome-extension/service-worker.js
PYTHONPATH=. python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/test_grid_math.mjs
node --test tests/test_remote_console.mjs
echo 'LIVE_RUN_TESTS_OK'
