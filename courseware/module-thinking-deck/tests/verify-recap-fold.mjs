import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const base = new URL('../',import.meta.url);
const data = await readFile(new URL('deck-data.js',base),'utf8');
const deckBox={window:{}};vm.runInNewContext(data,deckBox);
const model=deckBox.window.MSV_MODULE_DECK;
for(const file of ['presenter-runtime.js','deck-runtime.js']) {
  const source=await readFile(new URL(file,base),'utf8');
  const begin=source.indexOf('  function isRecap('),end=source.indexOf('\n  function ',source.indexOf('  function normalize(')+5);
  const box={window:{},model,Date,state:null,maxReveal:index=>(model.slides[index].content.match(/data-reveal/g)||[]).length};
  vm.createContext(box);vm.runInContext(source.slice(begin,end),box);
  const index=model.slides.findIndex(s=>s.id==='module-review');
  for(let mask=0;mask<8;mask++) {
    const state=box.normalize({slide:index,reveal:0,activity:{recapOpen:mask}});
    assert.equal(state.activity.recapOpen,mask);
    assert.equal(state.reveal,mask.toString(2).replaceAll('0','').length);
    assert.equal(box.normalize(JSON.parse(JSON.stringify(state))).activity.recapOpen,mask,'refresh/transport roundtrip');
  }
  assert.equal(box.normalize({slide:index,reveal:2}).activity.recapOpen,3,'legacy sequential reveals');
  assert.equal(box.normalize({slide:index,reveal:3,activity:{recapOpen:100}}).activity.recapOpen,7,'invalid mask');
  box.state=box.normalize({slide:index,activity:{recapOpen:5}});
  assert.equal(box.normalize(box.revealState(1)).activity.recapOpen,7,'next opens missing WHY');
  assert.equal(box.normalize(box.revealState(-1)).activity.recapOpen,1,'back closes last open HOW');
  assert.equal(box.normalize({...box.state,reveal:0,activity:{...box.state.activity,recapOpen:0}}).reveal,0,'reset');
  assert.equal(box.normalize({slide:0,reveal:0,activity:{recapOpen:7}}).activity.recapOpen,0,'other slide isolation');
  assert.match(source,/panel.hidden = !open/);
  assert.match(source,/aria-expanded/);
  assert.match(source,/setState\(revealState\(1\)/);
  assert.match(source,/setState\(revealState\(-1\)/);
  assert.match(source,/mask \^ \(1 << index\)/,'independent toggle');
  console.log(`${file}: 8 masks, hydration, legacy states, next/back/reset, isolation PASS`);
}
const recap=model.slides.find(s=>s.id==='module-review').content;
assert.equal((recap.match(/data-recap-toggle=/g)||[]).length,3);
assert.equal((recap.match(/data-recap-panel=/g)||[]).length,3);
assert.equal((recap.match(/data-reveal/g)||[]).length,3);
assert(recap.includes('传送带') && recap.includes('方块小车') && recap.includes('游戏背包'));
console.log('P1 recap independent folds PASS');
