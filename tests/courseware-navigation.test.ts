import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { coursewarePlayerHref } from "../app/lib/courseware-navigation";

test("static courseware hand-off preserves package launch mode and exact identity", () => {
  const href = coursewarePlayerHref({
    entryPath: "/courseware/product-mentor-foundations/r2/?view=overview&slide=0",
    revision: 2,
    digest: "a".repeat(64),
  });
  assert.equal(href, `/courseware/product-mentor-foundations/r2/?view=overview&slide=0&revision=2&digest=${"a".repeat(64)}`);
});

test("explicit deep links overlay defaults without producing a second question mark", () => {
  const href = coursewarePlayerHref({
    entryPath: "/courseware/product-mentor-foundations/r2/?view=overview&slide=0",
    revision: 2,
    digest: "b".repeat(64),
  }, 17, 3);
  assert.equal(href, `/courseware/product-mentor-foundations/r2/?view=overview&slide=17&revision=2&digest=${"b".repeat(64)}&step=3`);
  assert.equal(coursewarePlayerHref({ entryPath: null, revision: 0, digest: "c".repeat(64) }), null);
});

test("all authenticated static entry routes redirect before rendering the old launch gate", () => {
  for (const file of [
    "app/course/[slug]/page.tsx",
    "app/classroom/[classroomId]/courseware/[mentorRole]/page.tsx",
    "app/studio/courseware/[packageId]/page.tsx",
  ]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /coursewarePlayerHref/);
    assert.match(source, /redirect\(player\)/);
  }
  const frame = readFileSync(new URL("../app/course/[slug]/CoursewareFrame.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(frame, /进入全屏课件|在独立页面打开完整课件|staticLaunch/);
});
