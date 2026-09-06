import assert from "node:assert/strict";
// grid-math.js is loaded as an ES module in projects with `type: module`,
// while retaining a CommonJS export for extension consumers.
const loaded = await import("../chrome-extension/grid-math.js");
const { tileWorkArea, validateTiles } = loaded.default ?? loaded.MsvGridMath ?? globalThis.MsvGridMath;

for (const area of [
  { left: 0, top: 33, width: 1728, height: 1084 },
  { left: 52, top: 33, width: 1676, height: 1084 },
  { left: 80, top: 25, width: 1905, height: 1175 },
  { left: -1920, top: 0, width: 1920, height: 1080 },
  { left: 0, top: 25, width: 1985, height: 1201 },
]) {
  const tiles = tileWorkArea(area, 4, 2);
  assert.equal(tiles.length, 8);
  assert.equal(validateTiles(area, tiles, 4, 2), true);
  assert.equal(tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0), area.width * area.height);
  assert.equal(tiles[0].left, area.left);
  assert.equal(tiles[0].top, area.top);
  assert.equal(tiles.at(-1).left + tiles.at(-1).width, area.left + area.width);
  assert.equal(tiles.at(-1).top + tiles.at(-1).height, area.top + area.height);
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const left = tiles[row * 4 + column];
      const right = tiles[row * 4 + column + 1];
      assert.equal(left.left + left.width, right.left);
    }
  }
  for (let column = 0; column < 4; column += 1) {
    assert.equal(tiles[column].top + tiles[column].height, tiles[4 + column].top);
  }
  assert.ok(Math.max(...tiles.map((tile) => tile.width)) - Math.min(...tiles.map((tile) => tile.width)) <= 1);
  assert.ok(Math.max(...tiles.map((tile) => tile.height)) - Math.min(...tiles.map((tile) => tile.height)) <= 1);
}

console.log("GRID_MATH_OK layouts=5 seats=8 no_overlap=true safe_work_area_cover=true");
