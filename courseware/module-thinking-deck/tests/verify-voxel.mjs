import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const designs = await import(path.join(here, "..", "voxel-designs.js"));
const { VOXEL_BASE_EDGE, VOXEL_EDGE, createCoarseVoxelDesigns, refineVoxelDesigns, createVoxelDesigns } = designs;
assert.equal(VOXEL_BASE_EDGE, 0.44);
assert.equal(VOXEL_EDGE, 0.22);

const materials = ["rubber", "iron", "plastic", "glass", "metal"];
const car = createCoarseVoxelDesigns();
assert.deepEqual(Object.keys(car).sort(), ["car", "scope"]);

function bounds(list, edge) {
  const out = {};
  for (const row of list) for (let axis = 0; axis < 3; axis++) {
    const v = row.position[axis] - edge / 2;
    const w = row.position[axis] + edge / 2;
    const key = `${axis}:min`;
    out[key] = Math.min(out[key] ?? Infinity, v);
    out[`${axis}:max`] = Math.max(out[`${axis}:max`] ?? -Infinity, w);
  }
  return out;
}

for (const name of ["car", "scope"]) {
  const coarse = car[name];
  for (const material of materials) {
    assert.ok(Array.isArray(coarse[material]), `${name}.${material} is an array`);
    const before = JSON.stringify(coarse);
    const refined = refineVoxelDesigns({ [name]: coarse })[name];
    assert.equal(refined[material].length, coarse[material].length * 8, `${name}.${material} 8x refinement`);
    assert.equal(JSON.stringify(coarse), before, `${name} input is unchanged`);
    const expectedBounds = bounds(coarse[material], VOXEL_BASE_EDGE);
    const actualBounds = bounds(refined[material], VOXEL_EDGE);
    for (const key of Object.keys(expectedBounds)) {
      assert.ok(Math.abs(actualBounds[key] - expectedBounds[key]) <= 1e-9, `${name}.${material} bounds ${key}`);
    }
    for (let i = 0; i < coarse[material].length; i++) {
      const children = refined[material].filter((x) => x.sourceIndex === i);
      assert.equal(children.length, 8);
      const seen = new Set();
      for (const child of children) {
        assert.equal(child.component, coarse[material][i].component);
        assert.ok(child.subIndex >= 0 && child.subIndex < 8);
        const delta = child.position.map((v, axis) => (v - coarse[material][i].position[axis]).toFixed(9));
        assert.ok(delta.every((v) => v === "0.110000000" || v === "-0.110000000"));
        const key = child.position.join(",");
        assert.ok(!seen.has(key), "child centers are unique");
        seen.add(key);
      }
    }
  }
}

const refined = createVoxelDesigns();
assert.equal(refined.car.rubber.length + refined.car.iron.length + refined.car.plastic.length + refined.car.glass.length + refined.car.metal.length, 488);
assert.equal(refined.scope.rubber.length + refined.scope.iron.length + refined.scope.plastic.length + refined.scope.glass.length + refined.scope.metal.length, 456);
assert.deepEqual(JSON.stringify(refined), JSON.stringify(createVoxelDesigns()), "voxel generation is deterministic");

const module3d = fs.readFileSync(path.join(here, "..", "module-3d.js"), "utf8");
assert.match(module3d, /InstancedMesh/, "3D module uses InstancedMesh batching");
console.log("verify-voxel: all checks passed");
