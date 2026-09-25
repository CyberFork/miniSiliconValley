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

const s13 = deck.slides.find((slide) => slide.id === 'module-s13');
assert(s13, 'S13 slide is required');
const content = s13.content;
const cases = ['move', 'pickup', 'bag', 'finish', 'template'];
for (const name of cases) {
  assert.match(content, new RegExp(`data-interface-case=["']${name}["']`), `S13 case ${name}`);
  assert.match(content, new RegExp(`data-interface-panel=["']${name}["']`), `S13 panel ${name}`);
}
assert.match(content, /role=["']tablist["']/);
assert.ok((content.match(/role=["']tab["']/g) || []).length >= 5, 'S13 has five tabs');
assert.ok((content.match(/role=["']tabpanel["']/g) || []).length >= 5, 'S13 has five panels');
for (const label of ['模块名称', '唯一责任', '输入', '输出', '依赖', '负责人']) {
  assert.match(content, new RegExp(label), `interface card field ${label}`);
}
assert.match(content, /满两格.*装不下/, 'car case includes full-bag rejection');
assert.match(content, /钥匙|key/i, 'car case includes key condition');

const css = await read('deck.css');
const sceneCss = await read('p1-scenes.css').catch(() => '');
assert.match(sceneCss,/\.interface-case-tabs/);
assert.match(sceneCss,/\.interface-example-card\[hidden\]/);
for(const surface of ['teacher','audience'])assert.equal(await read(`dist/${surface}/p1-scenes.css`),sceneCss);
const sourceTools = await read('lesson-tools.js');
assert.match(sourceTools, /wireInterfaceCases/);
assert.match(sourceTools, /ArrowUp[\s\S]*Home[\s\S]*End/);
assert.match(sourceTools, /stopPropagation/);
for (const name of ['dist/teacher/lesson-tools.js', 'dist/audience/lesson-tools.js']) {
  const built = await read(name);
  assert.equal(built, sourceTools, `${name} must match source lesson-tools.js`);
}
for (const name of ['dist/teacher/deck.css', 'dist/audience/deck.css']) {
  assert.equal(await read(name), css, `${name} must match source deck.css`);
}

for (const runtimeName of ['deck-runtime.js', 'presenter-runtime.js']) {
  const runtime = await read(runtimeName);
  const begin = runtime.indexOf('  function normalize(');
  const end = runtime.indexOf('\n  function ', begin + 10);
  assert(begin >= 0 && end > begin, `${runtimeName}: normalize function missing`);
  const runtimeBox = { window:{}, model: deck, Date: { now: () => 0 }, maxReveal: () => 0, isRecap: () => false, recapMask: (v) => v };
  vm.createContext(runtimeBox);
  vm.runInContext(`${runtime.slice(begin, end)}; this.normalize = normalize;`, runtimeBox);
  const index = deck.slides.findIndex((slide) => slide.id === 'module-s13');
  for (const selected of cases) {
    const state = runtimeBox.normalize({ slide: index, activity: { interfaceCase: selected } });
    assert.equal(state.activity.interfaceCase, selected, `${runtimeName}: ${selected}`);
    assert.equal(runtimeBox.normalize(JSON.parse(JSON.stringify(state))).activity.interfaceCase, selected, `${runtimeName}: roundtrip ${selected}`);
  }
  for (const invalid of [undefined, '', 'unknown', 1, null]) {
    assert.equal(runtimeBox.normalize({ slide: index, activity: { interfaceCase: invalid } }).activity.interfaceCase, 'move', `${runtimeName}: invalid case`);
  }
  const other = index - 1;
  assert.equal(runtimeBox.normalize({ slide: other, activity: { interfaceCase: 'bag' } }).activity.interfaceCase, 'move', `${runtimeName}: non-S13 case`);
}
// Exercise the actual shared handler with a minimal DOM adapter.
const start=sourceTools.indexOf(' function wireInterfaceCases('),stop=sourceTools.indexOf(' function drawTimer(',start);
const handlerBox={};vm.createContext(handlerBox);vm.runInContext(sourceTools.slice(start,stop),handlerBox);
const makeTab=name=>({dataset:{interfaceCase:name},attrs:{},handlers:{},setAttribute(key,value){this.attrs[key]=value;},addEventListener(type,handler){this.handlers[type]=handler;}});
const tabs=cases.map(makeTab),panels=cases.map(name=>({dataset:{interfacePanel:name},hidden:false}));
const container={querySelectorAll:selector=>selector==='[data-interface-case]'?tabs:panels};
let choice;handlerBox.wireInterfaceCases(container,'bag',value=>choice=value);
assert.equal(tabs[2].attrs['aria-selected'],'true');assert.equal(tabs[2].tabIndex,0);
assert.equal(panels.filter(panel=>!panel.hidden).length,1);assert.equal(panels[2].hidden,false);
function keyAt(index,key){let prevented=false,stopped=false;tabs[index].handlers.keydown({key,preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});assert(prevented&&stopped);}
keyAt(2,'ArrowDown');assert.equal(choice,'finish');keyAt(0,'ArrowUp');assert.equal(choice,'template');
keyAt(2,'Home');assert.equal(choice,'move');keyAt(2,'End');assert.equal(choice,'template');
tabs[1].handlers.click({stopPropagation(){}});assert.equal(choice,'pickup');
const previewTabs=cases.map(makeTab);handlerBox.wireInterfaceCases({querySelectorAll:selector=>selector==='[data-interface-case]'?previewTabs:panels},'move',null);
assert(previewTabs.every(tab=>tab.tabIndex===-1&&!tab.handlers.click),'next-slide thumbnail is not interactive');
console.log('S13 interface cases structure, normalization, keyboard wiring and build parity PASS');
