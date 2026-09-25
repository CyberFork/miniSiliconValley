#!/bin/zsh
set -euo pipefail

EXPECTED_HEAD="679213a61b835335016eac7649213983a0e48489"
EXPECTED_TREE="3a041c4714190cc026f6de8e06e15cec0e5f765d"

[[ $# -eq 2 ]] || { echo "usage: $0 <chj-checkout> <output>" >&2; exit 2; }
SOURCE=$(cd "$1" && pwd)
OUTPUT="$2"
SCRIPT_DIR=${0:A:h}

[[ "$(git -C "$SOURCE" rev-parse HEAD)" = "$EXPECTED_HEAD" ]] || { echo "chj checkout is not pinned to $EXPECTED_HEAD" >&2; exit 2; }
[[ "$(git -C "$SOURCE" rev-parse 'HEAD^{tree}')" = "$EXPECTED_TREE" ]] || { echo "chj source tree differs from $EXPECTED_TREE" >&2; exit 2; }
[[ -z "$(git -C "$SOURCE" status --porcelain)" ]] || { echo "chj checkout is not clean" >&2; exit 2; }

cd "$SOURCE"
npm run typecheck
npm run lint
MSV_PUBLIC_BASE=/courseware/product-mentor-foundations/ \
MSV_SITE_ORIGIN=https://minisv.vip \
MSV_CANONICAL_URL=https://minisv.vip/courseware/product-mentor-foundations/ \
npm run build

MSV_PUBLIC_BASE=/courseware/product-mentor-foundations/ \
MSV_SITE_ORIGIN=https://minisv.vip \
MSV_CANONICAL_URL=https://minisv.vip/courseware/product-mentor-foundations/ \
node "$SCRIPT_DIR/render-chj-course-static.mjs" "$SOURCE" "$OUTPUT"

[[ "$(git -C "$SOURCE" rev-parse HEAD)" = "$EXPECTED_HEAD" ]]
[[ "$(git -C "$SOURCE" rev-parse 'HEAD^{tree}')" = "$EXPECTED_TREE" ]]
[[ -z "$(git -C "$SOURCE" status --porcelain)" ]]
printf 'CHJ_VERBATIM_BUILD_OK head=%s tree=%s output=%s\n' "$EXPECTED_HEAD" "$EXPECTED_TREE" "$OUTPUT"
