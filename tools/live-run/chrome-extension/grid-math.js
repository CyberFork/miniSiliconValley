(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MsvGridMath = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  function integer(value, label) {
    if (!Number.isFinite(value)) throw new TypeError(label + " must be finite");
    return Math.trunc(value);
  }

  function tileWorkArea(workArea, columns = 4, rows = 2) {
    const left = integer(workArea.left, "left");
    const top = integer(workArea.top, "top");
    const width = integer(workArea.width, "width");
    const height = integer(workArea.height, "height");
    columns = integer(columns, "columns");
    rows = integer(rows, "rows");
    if (width <= 0 || height <= 0 || columns <= 0 || rows <= 0) {
      throw new RangeError("work area and grid dimensions must be positive");
    }
    const xCuts = Array.from({ length: columns + 1 }, (_, index) => left + Math.round(width * index / columns));
    const yCuts = Array.from({ length: rows + 1 }, (_, index) => top + Math.round(height * index / rows));
    const result = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        result.push({
          left: xCuts[column],
          top: yCuts[row],
          width: xCuts[column + 1] - xCuts[column],
          height: yCuts[row + 1] - yCuts[row],
          row,
          column,
        });
      }
    }
    return result;
  }

  function validateTiles(workArea, tiles, columns = 4, rows = 2) {
    if (tiles.length !== columns * rows) return false;
    const expectedArea = workArea.width * workArea.height;
    const actualArea = tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0);
    if (actualArea !== expectedArea) return false;
    for (const tile of tiles) {
      if (tile.left < workArea.left || tile.top < workArea.top) return false;
      if (tile.left + tile.width > workArea.left + workArea.width) return false;
      if (tile.top + tile.height > workArea.top + workArea.height) return false;
    }
    for (let first = 0; first < tiles.length; first += 1) {
      for (let second = first + 1; second < tiles.length; second += 1) {
        const a = tiles[first];
        const b = tiles[second];
        const overlap = Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left))
          * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
        if (overlap !== 0) return false;
      }
    }
    return true;
  }

  return { tileWorkArea, validateTiles };
});
