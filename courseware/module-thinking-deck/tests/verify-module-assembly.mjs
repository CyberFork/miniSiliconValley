import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const base = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, base), 'utf8');
const deckSource = await read('deck-data.js');
const box = { window: {} };
vm.runInNewContext(deckSource, box);
const deck = box.window.MSV_MODULE_DECK;
assert(deck, 'deck data did not initialise');
assert.equal(deck.slides.length, 39, 'deck must contain 39 slides');
assert.equal(deck.timeline.at(-1).start + deck.timeline.at(-1).minutes, 240, 'timeline must total 240 minutes');

const s14 = deck.slides.find((slide) => slide.id === 'module-s14');
assert(s14, 'S14 slide is required');
assert.match(s14.content, /data-module-3d=["']car-modules["']/);
for (const mode of ['split', 'joined']) assert.match(s14.content, new RegExp(`data-assembly-mode=["']${mode}["']`));
assert.ok((s14.content.match(/data-assembly-mode=/g) || []).length >= 2, 'S14 has split/joined controls');
const notesBox={window:{}};vm.runInNewContext(await read('presenter-notes.js'),notesBox);assert.match(notesBox.window.MSV_MODULE_PRESENTER_NOTES['module-s14'].goal,/S13/);

const layoutSource = await read('module-assembly-layout.js');
const {MODULE_ASSEMBLY_LAYOUT:layout,MODULE_ASSEMBLY_SIZE:size}=await import(new URL('module-assembly-layout.js',base));
assert.deepEqual(size, [2.2, 0.22, 1.9], 'assembly base size');
for (const state of ['split', 'joined']) {
  assert(layout[state] && typeof layout[state] === 'object', `${state} layout`);
  for (const part of ['move', 'pickup', 'bag', 'finish']) {
    const p = layout[state][part];
    assert(Array.isArray(p) && p.length === 3, `${state}.${part} coordinate`);
    assert(p.every((v) => Number.isFinite(v)), `${state}.${part} finite coordinate`);
  }
}
const split = ['move', 'pickup', 'bag', 'finish'].map((part) => layout.split[part]);
for (let i = 0; i < split.length; i++) for (let j = i + 1; j < split.length; j++) {
  const [x1,,z1] = split[i], [x2,,z2] = split[j];
  assert(Math.abs(x1 - x2) >= size[0] || Math.abs(z1 - z2) >= size[2], `split modules overlap: ${i},${j}`);
}
for (const part of ['move', 'pickup', 'bag', 'finish']) assert.notDeepEqual(layout.split[part], layout.joined[part], `${part} split/joined differ`);

for (const runtimeName of ['deck-runtime.js', 'presenter-runtime.js']) {
  const runtime = await read(runtimeName);
  const begin = runtime.indexOf('  function normalize(');
  const end = runtime.indexOf('\n  function ', begin + 10);
  assert(begin >= 0 && end > begin, `${runtimeName}: normalize function missing`);
  const runtimeBox = { window:{}, model: deck, Date: { now: () => 0 }, maxReveal: () => 0, isRecap: () => false, recapMask: (v) => v };
  vm.createContext(runtimeBox);
  vm.runInContext(`${runtime.slice(begin, end)}; this.normalize = normalize;`, runtimeBox);
  const index = deck.slides.findIndex((slide) => slide.id === 'module-s14');
  for (const mode of ['split', 'joined']) assert.equal(runtimeBox.normalize({ slide: index, activity: { assemblyMode: mode } }).activity.assemblyMode, mode, `${runtimeName}: ${mode}`);
  for (const invalid of [undefined, '', 'unknown', 1, null]) assert.equal(runtimeBox.normalize({ slide: index, activity: { assemblyMode: invalid } }).activity.assemblyMode, 'split', `${runtimeName}: invalid mode`);
  assert.equal(runtimeBox.normalize({ slide: index - 1, activity: { assemblyMode: 'joined' } }).activity.assemblyMode, 'split', `${runtimeName}: non-S14 mode`);
}

for (const name of ['dist/teacher/module-assembly-layout.js', 'dist/audience/module-assembly-layout.js']) assert.equal(await read(name), layoutSource, `${name} must match source module-assembly-layout.js`);
// Exercise actual scene factory and transforms with real Three.js, no GPU needed.
const THREE=await import(new URL('vendor/three.module.min.js',base));
const source3d=await read('module-3d.js'),added=[];
const host={clientWidth:1100,clientHeight:370,dataset:{},getAttribute:()=> 'split',append:node=>added.push(node)};
const factoryBox={THREE,MODULE_ASSEMBLY_LAYOUT:layout,MODULE_ASSEMBLY_SIZE:size,PALETTE:{blue:0x2154d7,yellow:0xf2c84b,mint:0x63d7b0,orange:0xef7657,ink:0x152a36},Date:{now:()=>2000},matchMedia:()=>({matches:false}),document:{createElement:()=>({style:{},dataset:{},remove(){this.removed=true;}})},material:color=>new THREE.MeshStandardMaterial({color}),box:(name,color,dimensions)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...dimensions),new THREE.MeshStandardMaterial({color}));mesh.name=name;return mesh;},createCommonScene:(_host,position)=>{const camera=new THREE.PerspectiveCamera(33,1100/370,.1,100);camera.position.set(...position);camera.lookAt(0,.3,0);return {scene:new THREE.Scene(),camera};}};
vm.createContext(factoryBox);
vm.runInContext(source3d.slice(source3d.indexOf('function setTransform('),source3d.indexOf('function createCommonScene(')),factoryBox);
vm.runInContext(source3d.slice(source3d.indexOf('function createCarModuleAssembly('),source3d.indexOf('function mountScene(')),factoryBox);
const instance=factoryBox.createCarModuleAssembly(host),parts=['move','pickup','bag','finish'];
for(const part of parts)assert.deepEqual(instance.scene.getObjectByName(part).position.toArray(),layout.split[part]);
const cameraBefore=instance.camera.position.toArray();instance.setMode('joined');for(let i=0;i<100;i++)instance.update();
for(const part of parts)assert(instance.scene.getObjectByName(part).position.distanceTo(new THREE.Vector3(...layout.joined[part]))<.001,part+' actually reassembles');
assert.deepEqual(instance.camera.position.toArray(),cameraBefore,'mode changes must not reset camera');
instance.setMode('split');for(let i=0;i<100;i++)instance.update();
for(const part of parts)assert(instance.scene.getObjectByName(part).position.distanceTo(new THREE.Vector3(...layout.split[part]))<.001,part+' actually separates again');
assert.equal(added.length,4);assert(added.every(label=>!label.hidden),'default split framing keeps labels visible');
instance.camera.aspect=711/403;instance.camera.updateProjectionMatrix();
instance.setMode('joined');for(let i=0;i<100;i++)instance.update();
assert(added.every(label=>!label.hidden),'S12 narrower viewport keeps all joined labels in frame');
// S12 reuses this scene with a focused module, and a concrete full-bag fault.
for(const part of parts){
 instance.setMode('focus-'+part);for(let i=0;i<100;i++)instance.update();
 for(const id of parts)assert.equal(instance.scene.getObjectByName(id).scale.x>.1,id===part);
 assert(instance.scene.getObjectByName(part).position.distanceTo(new THREE.Vector3(0,-.5,0))<.001);
 assert.equal(added.find(label=>label.dataset.module===part).hidden,false,'focused module label in frame');
 assert(instance.scene.getObjectByName(part).scale.distanceTo(new THREE.Vector3(1.8,1.8,1.8))<.001);
}
instance.setMode('bag-full');for(let i=0;i<100;i++)instance.update();
for(const part of parts)assert(instance.scene.getObjectByName(part).visible);
for(const name of ['占格金币','占格工具','待拾取道具'])assert(instance.scene.getObjectByName(name).visible,name);
assert.equal(instance.scene.getObjectByName('已收钥匙').visible,false,'full bag cannot claim to contain key');
assert.equal(instance.scene.getObjectByName('终点门').material.color.getHex(),0xef7657,'full-bag path has not won');
assert.equal(instance.scene.getObjectByName('接口传递').visible,false,'do not animate successful delivery when rejected');
instance.setMode('joined');instance.update();
assert.equal(instance.scene.getObjectByName('占格工具').visible,false,'S12 fault does not leak into S14');
assert.deepEqual(instance.camera.position.toArray(),cameraBefore,'focused answers preserve orbit position');
instance.sceneCleanup();assert(added.every(label=>label.removed));
console.log('S14 module assembly layout, deck controls, normalization and build parity PASS');
