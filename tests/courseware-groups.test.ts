import assert from "node:assert/strict";
import test from "node:test";

import { groupCoursewareByMentor } from "../app/lib/courseware-groups";

type Courseware = {
  packageId: string;
  mentorRole: "P" | "D" | "M" | "O";
  title?: string;
};

test("groups courseware into the fixed mentor groups without changing item identity", () => {
  const product = { packageId: "product", mentorRole: "P", title: "Product" } as const;
  const developmentAfter = { packageId: "cw-development-mentor-ligun", mentorRole: "D", title: "Ligun" } as const;
  const market = { packageId: "market", mentorRole: "M", title: "Market" } as const;
  const operations = { packageId: "operations", mentorRole: "O", title: "Operations" } as const;
  const developmentBefore = { packageId: "cw-development-mentor-module-thinking", mentorRole: "D", title: "Module thinking" } as const;
  const input = [product, developmentAfter, market, operations, developmentBefore] satisfies readonly Courseware[];

  const groups = groupCoursewareByMentor(input);

  assert.deepEqual(groups.map(({ role, label }) => ({ role, label })), [
    { role: "P", label: "产品导师" },
    { role: "D", label: "开发导师" },
    { role: "M", label: "市场导师" },
    { role: "O", label: "运营导师" },
  ]);
  assert.deepEqual(groups.map(({ items }) => items.map((item) => item.packageId)), [
    ["product"],
    ["cw-development-mentor-module-thinking", "cw-development-mentor-ligun"],
    ["market"],
    ["operations"],
  ]);
  assert.strictEqual(groups[0].items[0], product);
  assert.strictEqual(groups[1].items[0], developmentBefore);
  assert.strictEqual(groups[1].items[1], developmentAfter);
  assert.strictEqual(groups[2].items[0], market);
  assert.strictEqual(groups[3].items[0], operations);
});

test("keeps empty mentor groups for empty and partial input", () => {
  const onlyDevelopment = {
    packageId: "development-other",
    mentorRole: "D",
    title: "Other development",
  } satisfies Courseware;

  const groups = groupCoursewareByMentor([onlyDevelopment]);

  assert.equal(groups.length, 4);
  assert.deepEqual(groups[0].items, []);
  assert.deepEqual(groups[1].items, [onlyDevelopment]);
  assert.deepEqual(groups[2].items, []);
  assert.deepEqual(groups[3].items, []);
});

test("preserves non-development relative order and does not mutate input", () => {
  const input: Courseware[] = [
    { packageId: "o-1", mentorRole: "O" },
    { packageId: "p-1", mentorRole: "P" },
    { packageId: "o-2", mentorRole: "O" },
    { packageId: "m-1", mentorRole: "M" },
    { packageId: "p-2", mentorRole: "P" },
  ];
  const before = input.slice();

  const groups = groupCoursewareByMentor(input);

  assert.deepEqual(input, before);
  assert.deepEqual(groups[0].items.map((item) => item.packageId), ["p-1", "p-2"]);
  assert.deepEqual(groups[2].items.map((item) => item.packageId), ["m-1"]);
  assert.deepEqual(groups[3].items.map((item) => item.packageId), ["o-1", "o-2"]);
});

test("empty input and new D packages are retained, without guessing role from title", () => {
  assert.deepEqual(groupCoursewareByMentor([]).map((group) => group.items), [[], [], [], []]);
  const items = Object.freeze([
    Object.freeze({ packageId: "new-d-1", mentorRole: "D" as const, title: "new" }),
    Object.freeze({ packageId: "cw-development-mentor-ligun", mentorRole: "D" as const }),
    Object.freeze({ packageId: "new-d-2", mentorRole: "D" as const }),
    Object.freeze({ packageId: "cw-development-mentor-module-thinking", mentorRole: "D" as const }),
    Object.freeze({ packageId: "p-title-d", mentorRole: "P" as const, title: "开发导师" }),
  ]);
  const groups = groupCoursewareByMentor(items);
  assert.deepEqual(groups[1].items.map((item) => item.packageId), [
    "cw-development-mentor-module-thinking", "cw-development-mentor-ligun", "new-d-1", "new-d-2",
  ]);
  assert.equal(groups[0].items[0], items[4]);
  assert.equal(new Set(groups.flatMap((group) => group.items)).size, items.length);
});
