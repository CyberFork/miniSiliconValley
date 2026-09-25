import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const base = new URL('../', import.meta.url);
const read = n => readFile(new URL(n, base), 'utf8');
const box = { window: {} }; vm.runInNewContext(await read('deck-data.js'), box);
const deck = box.window.MSV_MODULE_DECK; assert(deck);
assert.equal(deck.slides.length, 41); assert.equal(deck.timeline.at(-1).start + deck.timeline.at(-1).minutes, 240);
const ids = deck.slides.map(s => s.id), at = id => ids.indexOf(id);
assert(at('module-s14') < at('module-s12') && at('module-s12') < at('module-my-start'), 'S12 must follow S14 and precede module-my-start');
const s12 = deck.slides.find(s => s.id === 'module-s12'); assert(s12, 'S12 required');
const content = s12.content;
const cases = ['route','move','pickup','bag','finish','check'];
for (const name of cases) {
  assert.match(content, new RegExp(`data-worked-case=["']${name}["']`));
  assert.match(content, new RegExp(`data-worked-panel=["']${name}["']`));
}
assert.match(content, /data-module-3d=["']car-modules["']/);
assert.ok((content.match(/data-worked-case=/g)||[]).length >= 6);
// The worked example is fully answered, including the boundary and success conditions.
for (const term of ['路径|路线|route','移动|方向键|位置','拾取|道具','背包','两格|最多两件','满.*拒绝|装不下','道具.*留|保留','钥匙','终点','成功|通过']) assert.match(content, new RegExp(term, 'i'), `S12 answer missing: ${term}`);
const sourceTools = await read('lesson-tools.js');
assert.match(sourceTools, /function paintWorkedExample\s*\(/); assert.match(sourceTools, /function wireWorkedExample\s*\(/);
for(const key of ['ArrowUp','ArrowDown','Home','End']) assert(sourceTools.includes(key));
for (const n of ['dist/teacher/lesson-tools.js','dist/audience/lesson-tools.js']) assert.equal(await read(n), sourceTools, `${n} parity`);
for (const runtimeName of ['deck-runtime.js','presenter-runtime.js']) {
  const runtime = await read(runtimeName), begin = runtime.indexOf('  function normalize('), end = runtime.indexOf('\n  function ', begin + 10);
  assert(begin >= 0 && end > begin, `${runtimeName}: normalize missing`);
  const rb = { model: deck, Date:{now:()=>0}, maxReveal:()=>0, isRecap:()=>false, recapMask:v=>v }; vm.createContext(rb);
  vm.runInContext(`${runtime.slice(begin,end)}; this.normalize=normalize;`, rb);
  const index = at('module-s12');
  for (const selected of cases) assert.equal(rb.normalize({slide:index,activity:{workedCase:selected}}).activity.workedCase, selected);
  for (const invalid of [undefined,'','unknown',1,null]) assert.equal(rb.normalize({slide:index,activity:{workedCase:invalid}}).activity.workedCase,'route');
  assert.equal(rb.normalize({slide:index-1,activity:{workedCase:'bag'}}).activity.workedCase,'route');
}
// Minimal fake DOM: exercise the actual shared helper's paint, click, and keyboard behavior.
const start = sourceTools.indexOf(' function paintWorkedExample('), stop = sourceTools.indexOf(' function drawTimer(', start);
assert(start >= 0 && stop > start); const hb={}; vm.createContext(hb); vm.runInContext(sourceTools.slice(start,stop),hb);
const tabs=cases.map(name=>({dataset:{workedCase:name},attrs:{},handlers:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,f){this.handlers[k]=f}}));
const panels=cases.map(name=>({dataset:{workedPanel:name},hidden:true}));
const scene={dataset:{module3dMode:'old'},setAttribute(k,v){this.dataset.module3dMode=v;}}; const container={querySelectorAll:q=>q==='[data-worked-case]'?tabs:panels,querySelector:q=>q==='[data-module-3d="car-modules"]'?scene:null};
let choice; hb.wireWorkedExample(container,'bag',v=>{choice=v;hb.paintWorkedExample(container,v);}); assert.equal(tabs[3].attrs['aria-selected'],'true'); assert.equal(panels[3].hidden,false); assert.equal(scene.dataset.module3dMode,'focus-bag');
const key=(i,k)=>{let p=false,s=false;tabs[i].handlers.keydown({key:k,preventDefault(){p=true},stopPropagation(){s=true}});assert(p&&s)};
key(3,'ArrowDown'); assert.equal(choice,'finish'); key(0,'ArrowUp'); assert.equal(choice,'check'); key(2,'Home'); assert.equal(choice,'route'); key(2,'End'); assert.equal(choice,'check');
tabs[1].handlers.click({stopPropagation(){}}); assert.equal(choice,'move'); assert.equal(scene.dataset.module3dMode,'focus-move');
hb.paintWorkedExample(container,'route'); assert.equal(panels[0].hidden,false); assert.equal(scene.dataset.module3dMode,'joined');
hb.paintWorkedExample(container,'check'); assert.equal(scene.dataset.module3dMode,'bag-full');
console.log('S12 worked example structure, answers, normalization, helper behavior and build parity PASS');
