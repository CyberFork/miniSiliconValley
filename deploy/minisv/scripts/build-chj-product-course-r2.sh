#!/bin/zsh
set -euo pipefail

# Product-mentor CoursewarePackage r2. The colleague checkout is a pinned,
# read-only input. r0/r1 stay byte-identical at their historical URLs.
EXPECTED_HEAD="806d804932e4cd4ae2796d84578d39197d7ea4ce"
EXPECTED_TREE="bde3426ee770272dc3263064a16d60659fffff9b"
COURSEWARE_BASE="/courseware/product-mentor-foundations/r2/"

[[ $# -eq 2 ]] || { echo "usage: $0 <chj9-11-checkout> <output>" >&2; exit 2; }
SOURCE=$(cd "$1" && pwd)
OUTPUT="$2"
SCRIPT_DIR=${0:A:h}

[[ "$(git -C "$SOURCE" rev-parse HEAD)" = "$EXPECTED_HEAD" ]] || { echo "chj9-11 checkout is not pinned to $EXPECTED_HEAD" >&2; exit 2; }
[[ "$(git -C "$SOURCE" rev-parse 'HEAD^{tree}')" = "$EXPECTED_TREE" ]] || { echo "chj9-11 source tree differs from $EXPECTED_TREE" >&2; exit 2; }
[[ -z "$(git -C "$SOURCE" status --porcelain)" ]] || { echo "chj9-11 checkout is not clean" >&2; exit 2; }
[[ -f "$SOURCE/public/assets/course-outline-world-map-v2.webp" ]] || { echo "optimized outline map is missing" >&2; exit 2; }
[[ $(wc -c < "$SOURCE/public/assets/course-outline-world-map-v2.webp") -lt $(wc -c < "$SOURCE/public/assets/course-outline-world-map-v2.png") ]] || { echo "optimized outline map is not smaller than PNG source" >&2; exit 2; }

cd "$SOURCE"
npm run typecheck
npm run validate:data
node --import tsx --test --test-name-pattern="course outline" tests/interaction-contract.test.ts

MSV_PUBLIC_BASE="$COURSEWARE_BASE" \
MSV_SITE_ORIGIN=https://minisv.vip \
MSV_CANONICAL_URL="https://minisv.vip${COURSEWARE_BASE}" \
npm run build

node --import tsx --test \
  tests/data-validate.test.ts \
  tests/mission-progress.test.ts \
  tests/render.test.ts \
  tests/state.test.ts

MSV_PUBLIC_BASE="$COURSEWARE_BASE" \
MSV_SITE_ORIGIN=https://minisv.vip \
MSV_CANONICAL_URL="https://minisv.vip${COURSEWARE_BASE}" \
node "$SCRIPT_DIR/render-chj-course-static.mjs" "$SOURCE" "$OUTPUT"

[[ "$(git -C "$SOURCE" rev-parse HEAD)" = "$EXPECTED_HEAD" ]]
[[ "$(git -C "$SOURCE" rev-parse 'HEAD^{tree}')" = "$EXPECTED_TREE" ]]
[[ -z "$(git -C "$SOURCE" status --porcelain)" ]]
printf 'CHJ_PRODUCT_MENTOR_R2_BUILD_OK head=%s tree=%s output=%s\n' "$EXPECTED_HEAD" "$EXPECTED_TREE" "$OUTPUT"
