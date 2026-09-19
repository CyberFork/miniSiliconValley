import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { buildDeck } from '../build-deck.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const specs = [
  { name:'module-thinking-deck', count:26, last:'module-review', legacy:'module-s16', old:2, terms:['变形玩具','乐高','方块','职责','输入','处理规则','输出','接口','正常','异常','模块地图','设计卡','走查记录'], recap:'p1' },
  { name:'ligun-deck', count:28, last:'ligun-review', legacy:'ligun-27', old:1, terms:['主棍','子棍','执行者','上下文与项目设计','目标','约束','避免','验收','执行','检查','修正','复查','微棍'], recap:'p2' }
];
for (const s of specs) {
  const dir=join(root,s.name), box={window:{}}; vm.createContext(box);
  for (const f of ['deck-data.js','presenter-notes.js']) vm.runInContext(await readFile(join(dir,f),'utf8'),box);
  const deck=box.window.MSV_MODULE_DECK, notes=box.window.MSV_MODULE_PRESENTER_NOTES;
  const slides=Array.from(deck.slides), ids=slides.map(x=>x.id);
  assert.equal(slides.length,s.count,s.name+' slide count');
  assert.equal(new Set(ids).size,ids.length,s.name+' unique ids');
  assert(ids.includes(s.legacy),s.name+' legacy tail retained');
  assert.equal(ids.at(-1),s.last,s.name+' recap last');
  assert.equal(slides.at(-2).id,s.legacy,s.name+' legacy immediately before recap');
  assert.equal(slides.at(-2).minutes,s.old,s.name+' legacy reduced minutes');
  assert.equal(slides.at(-1).minutes,s.name==='module-thinking-deck'?3:2,'recap minutes');
  assert.equal(slides.reduce((n,x)=>n+x.minutes,0),120,s.name+' total minutes');
  for (const slide of slides) { const note=notes[slide.id]; assert(note,'missing notes '+slide.id); assert.equal(Number.parseInt(note.minutes),slide.minutes,'notes/deck '+slide.id); }
  assert.equal(Object.keys(notes).length,s.count,s.name+' notes count');
  const recap=slides.at(-1); assert.match(recap.content,/class=["'][^"']*course-recap/,'recap class'); assert.match(recap.content,new RegExp(`data-recap=["']${s.recap}["']`));
  assert.equal((recap.content.match(/data-reveal/g)||[]).length,3,s.name+' exactly three reveals');
  for (const term of s.terms) assert(recap.content.includes(term),s.name+' recap term '+term);
  if(s.recap==='p2') {
    const row=recap.content.match(/class="recap-six">([\s\S]*?)<\/div>/)[1];
    assert.deepEqual([...row.matchAll(/<span>([^<]+)<\/span>/g)].map(m=>m[1]),['执行者','上下文与项目设计','目标','约束','避免','验收']);
  }

  const sourceCss=await readFile(join(root,'shared/recap.css'),'utf8');
  const result=await buildDeck(s.name);
  for (const surface of ['audience','teacher']) {
    const html=[join(dir,'dist',surface,surface==='audience'?'index.html':'presenter.html')];
    assert(html.length>0,s.name+' '+surface+' html');
    for (const p of html) { const t=await readFile(p,'utf8'); assert(t.includes('recap.css'),p+' recap css reference'); }
    const css=join(dir,'dist',surface,'recap.css'); assert.equal(await readFile(css,'utf8'),sourceCss,s.name+' '+surface+' css bytes');
  }
  for (const entry of [...result.audience,...result.teacher]) assert.equal(createHash('sha256').update(await readFile(join(dir,'dist',entry.path))).digest('hex'),entry.sha256);
}
console.log('recap structure, budgets, notes, reveals, terms, CSS references and build bytes PASS');
