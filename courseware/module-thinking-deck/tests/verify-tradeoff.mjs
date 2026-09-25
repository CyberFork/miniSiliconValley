import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),box={window:{}};
for(const name of ['deck-data.js','presenter-notes.js'])vm.runInNewContext(await readFile(new URL(name,root),'utf8'),box);
const deck=box.window.MSV_MODULE_DECK,notes=box.window.MSV_MODULE_PRESENTER_NOTES;
assert.equal(deck.slides.length,24);assert.equal(deck.slides.reduce((n,s)=>n+s.minutes,0),120);
assert(!deck.slides.some(s=>s.id==='module-s11'));assert(!notes['module-s11']);
const slide=deck.slides.find(s=>s.id==='module-tradeoff');
assert.equal((slide.content.match(/data-tradeoff-tab=/g)||[]).length,4);
assert.equal((slide.content.match(/data-module-3d=/g)||[]).length,1);
assert(slide.content.includes('role="tablist"'));assert(slide.content.includes('data-tradeoff-action'));
for(const file of ['deck-runtime.js','presenter-runtime.js']){
 const code=await readFile(new URL(file,root),'utf8');
 for(const key of ['tradeoffTab','tradeoffPlay',"['transform','automation','voxel','game']",'aria-selected','stopPropagation'])assert(code.includes(key),file+' '+key);
}
const three=await readFile(new URL('module-3d.js',root),'utf8');assert(three.includes('game: createGameModules'));
const s05=deck.slides.find(s=>s.id==='module-s05');for(const term of ['模块','功能','产品','data-module-3d'])assert(s05.content.includes(term));assert.equal(s05.minutes,6);
console.log('S05 relations, S11 removal, four-tab WHY live scenes, sync controls, 24 slides / 120 minutes PASS');
