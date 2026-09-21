#!/bin/sh
cd "$(dirname "$0")"
echo "Open http://127.0.0.1:18135/workshop/teacher/presenter.html?session=mc-review"
python3 -m http.server 18135 --bind 127.0.0.1
