import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = new URL("../", import.meta.url);
const read = (name) => readFile(new URL(name, base), "utf8");
const { TRANSFORM_DURATION_MS, sampleTransformPhase } = await import(
  new URL("transform-sequence.js", base),
);

assert.equal(TRANSFORM_DURATION_MS, 5000, "transform duration is 5000ms");

const phase = (elapsedMs) => sampleTransformPhase(elapsedMs);
assert.deepEqual(phase(-100), { phase: "explode", progress: 0 }, "negative time clamps to zero");
assert.deepEqual(phase(0), { phase: "explode", progress: 0 });
assert.deepEqual(phase(2000), { phase: "assemble", progress: 0 }, "assemble starts at 2000ms");
assert.deepEqual(phase(5000), { phase: "complete", progress: 1 }, "complete starts at 5000ms");
assert.deepEqual(phase(9000), { phase: "complete", progress: 1 }, "late samples stay complete");

for (const elapsedMs of [-1, 0, 1, 999, 1000, 1999, 2000, 2001, 3499, 3500, 4999, 5000, 5001]) {
  const sample = phase(elapsedMs);
  assert.ok(["explode", "assemble", "complete"].includes(sample.phase), `${elapsedMs}: valid phase`);
  assert.ok(sample.progress >= 0 && sample.progress <= 1, `${elapsedMs}: progress in range`);
}
assert.equal(phase(1000).progress, 0.5, "explode uses smoothstep");
assert.equal(phase(3500).progress, 0.5, "assemble uses smoothstep");
assert.ok(phase(999).progress < phase(1000).progress);
assert.ok(phase(1000).progress < phase(1999).progress);
assert.ok(phase(2001).progress < phase(3500).progress);
assert.ok(phase(3500).progress < phase(4999).progress);

const source = await read("transform-sequence.js");
for (const output of ["dist/teacher/transform-sequence.js", "dist/audience/transform-sequence.js"]) {
  assert.equal(await read(output), source, `${output} must match source transform-sequence.js`);
}

const module3d = await read("module-3d.js");
assert.match(module3d, /from\s+["']\.\/transform-sequence\.js["']/,
  "module-3d.js imports transform-sequence.js");
assert.match(module3d, /\.getAttribute\(\s*["']data-transform-start["']\s*\)/,
  "module-3d.js reads data-transform-start with getAttribute");

console.log("Transform sequence timing, build parity, and module-3d wiring passed.");

// Run the actual toy factory with real Three.js transforms (no GPU or browser mocks).
const THREE=await import(new URL('../vendor/three.module.min.js',import.meta.url));
const vm=await import('node:vm');
let now=10000;const attrs={'data-module-3d-mode':'car','data-transform-start':'0'};
const host={dataset:{},getAttribute:name=>attrs[name]};
const b={THREE,TRANSFORM_DURATION_MS,sampleTransformPhase,Date:{now:()=>now},matchMedia:()=>({matches:false}),PALETTE:{blue:0x2154d7,paleBlue:0xbdd2ff,mint:0x63d7b0,orange:0xef7657,yellow:0xf2c84b},createCommonScene:()=>({scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera()}),box:(name,color,size)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial({color}));mesh.name=name;return mesh;},cylinder:(name,color,r,h)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h),new THREE.MeshBasicMaterial({color}));mesh.name=name;return mesh;}};
vm.createContext(b);
vm.runInContext(module3d.slice(module3d.indexOf('function setTransform('),module3d.indexOf('function createCommonScene(')),b);
vm.runInContext(module3d.slice(module3d.indexOf('function createTransformToy('),module3d.indexOf('function createAutomationLab(')),b);
const toy=b.createTransformToy(host),wheel=toy.scene.getObjectByName('wheel-a');toy.update();
const original=wheel.position.clone(),camera=toy.camera.position.clone();
attrs['data-transform-start']=String(now);toy.setMode('plane');toy.update();assert(wheel.position.equals(original),'starts from existing car, no initial flash');
now+=1000;toy.update();assert(wheel.position.x<original.x&&wheel.position.x>-4,'halfway out');
now+=1000;toy.update();assert(wheel.position.distanceTo(new THREE.Vector3(-4,-.4,0))<1e-9,'exploded at 2s');
now+=1500;toy.update();assert(wheel.position.x>-4&&wheel.position.x<-1.05,'recombining, not teleporting');
now+=1500;toy.update();assert(wheel.position.distanceTo(new THREE.Vector3(-1.05,-1.25,.5))<1e-9,'exact plane target at 5s');assert.equal(host.dataset.transformPhase,'complete');
attrs['data-transform-start']=String(now);toy.setMode('car');now+=1000;toy.update();const interrupted=wheel.position.clone();
attrs['data-transform-start']=String(now);toy.setMode('plane');toy.update();assert(wheel.position.equals(interrupted),'rapid reverse starts at current interpolated pose');
assert(toy.camera.position.equals(camera),'animation does not reset user camera');
now+=5000;toy.update();assert(wheel.position.distanceTo(new THREE.Vector3(-1.05,-1.25,.5))<1e-9);
console.log('Actual Three.js 5-second explosion/reassembly, intermediate positions and interrupted reversal PASS');
