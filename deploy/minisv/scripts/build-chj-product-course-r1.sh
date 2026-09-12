#!/bin/zsh
set -euo pipefail

# Product-manager CoursewarePackage r1. The colleague checkout is an opaque,
# pinned input: this script never edits it and refuses a dirty or mismatched
# tree. r0 continues to be reproducible through build-chj-course.sh.
EXPECTED_HEAD="d9d45f1396b54a7ac6b41715b31122d8ffc597ff"
EXPECTED_TREE="d26045a3eb1c249629092dcddeb82e7812ff0ff5"
COURSEWARE_BASE="/courseware/product-mentor-foundations/r1/"

[[ $# -eq 2 ]] || { echo "usage: $0 <chj9-11-checkout> <output>" >&2; exit 2; }
SOURCE=$(cd "$1" && pwd)
OUTPUT="$2"
SCRIPT_DIR=${0:A:h}

[[ "$(git -C "$SOURCE" rev-parse HEAD)" = "$EXPECTED_HEAD" ]] || { echo "chj9-11 checkout is not pinned to $EXPECTED_HEAD" >&2; exit 2; }
[[ "$(git -C "$SOURCE" rev-parse 'HEAD^{tree}')" = "$EXPECTED_TREE" ]] || { echo "chj9-11 source tree differs from $EXPECTED_TREE" >&2; exit 2; }
[[ -z "$(git -C "$SOURCE" status --porcelain)" ]] || { echo "chj9-11 checkout is not clean" >&2; exit 2; }

cd "$SOURCE"
npm run validate:data

# This upstream snapshot has one already-audited TypeScript literal mismatch
# (project-application-form vs project-application) and tracked cache backups
# that make its repository-wide lint fail. Do not patch a colleague-owned
# release merely to hide those facts. The production gate below instead
# requires the real build and the executable data/state/render suites; the
# exception and browser evidence are recorded in the deployment receipt.
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
printf 'CHJ_PRODUCT_MANAGER_R1_VERBATIM_BUILD_OK head=%s tree=%s output=%s\n' "$EXPECTED_HEAD" "$EXPECTED_TREE" "$OUTPUT"
