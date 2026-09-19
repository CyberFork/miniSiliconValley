import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {buildDeck} from '../build-deck.mjs';
import {createGame,runChecks,MAP} from '../../ligun-deck/demo/game.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const headings=['执行者','上下文与项目设计','目标','约束','避免','验收'];
async function files(dir){const out=[];for(const name of await readdir(dir)){const p=join(dir,name);out.push(...((await stat(p)).isDirectory()?await files(p):[p]));}return out;}
const results=[];
for(const [name,count,times] of [['module-thinking-deck',25,[5,40,10,20,40,5]],['ligun-deck',27,[8,27,10,40,22,13]]]){
 const deckRoot=join(root,name),box={window:{}};vm.createContext(box);
 for(const file of ['deck-data.js','presenter-notes.js'])vm.runInContext(await readFile(join(deckRoot,file),'utf8'),box);
 const deck=box.window.MSV_MODULE_DECK,notes=box.window.MSV_MODULE_PRESENTER_NOTES;
 assert.equal(deck.slides.length,count);
 const phaseMinutes=new Map();
 for(const slide of deck.slides){
  assert(slide.phase&&slide.minutes>0);const note=notes[slide.id];assert(note,'notes '+slide.id);
  assert.equal(Number.parseInt(note.minutes),slide.minutes,'note/deck minutes '+slide.id);
  for(const field of ['goal','script','acceptable','misconception','reward','acceptance','materials'])assert(note[field]?.length,field+' '+slide.id);
  phaseMinutes.set(slide.phase,(phaseMinutes.get(slide.phase)||0)+slide.minutes);
 }
 assert.deepEqual([...phaseMinutes.values()],times);
 assert.equal([...phaseMinutes.values()].reduce((a,b)=>a+b),120);
 assert.equal(Object.keys(notes).length,count);
 const first=await buildDeck(name),second=await buildDeck(name);assert.equal(first.digest,second.digest,'deterministic build');
 assert.equal(second.releaseStatus,'deployment-ready');assert.equal(second.manualAcceptance,'not-signed-by-user');
 for(const file of [...second.audience,...second.teacher])assert.equal(createHash('sha256').update(await readFile(join(deckRoot,'dist',file.path))).digest('hex'),file.sha256);
 for(const path of await files(join(deckRoot,'dist/audience'))){
  assert(!/presenter|teacher/.test(path.split('/audience/')[1]),'teacher filename leak');
  if(!/\.(html|js|json|css)$/.test(path))continue;
  const text=await readFile(path,'utf8');
  for(const phrase of ['presenter-notes.js','MSV_MODULE_PRESENTER_NOTES','可接受回答','硅谷币提示','常见误区'])assert(!text.includes(phrase),phrase+' '+path);
 }
 for(const surface of ['audience','teacher'])for(const path of await files(join(deckRoot,'dist',surface))){
  if(!path.endsWith('.html'))continue;const text=await readFile(path,'utf8');
  for(const match of text.matchAll(/(?:src|href)="([^"#]+)"/g)){
   const href=match[1].split('?')[0];if(/^(https?:|data:)/.test(href))continue;
   // Resource links are deliberately rewritten by lesson-tools against audience URL.
   if(surface==='teacher'&&['workbook/index.html','printables/index.html'].includes(href))continue;
   assert((await stat(resolve(dirname(path),href))).isFile(),path+' -> '+href);
  }
 }
 results.push({name,count,minutes:120,digest:second.digest});
}
const templateRoot=join(root,'ligun-deck/templates');
const catalog=JSON.parse(await readFile(join(templateRoot,'catalog.json'),'utf8'));
assert.equal(catalog.length,11);assert(catalog.every(d=>!d.text),'catalog metadata must derive text from MD');
for(const doc of catalog){
 const text=await readFile(join(templateRoot,doc.filename),'utf8');
 if(['alignment-prompt','feedback-rework'].includes(doc.id))continue;
 assert.deepEqual([...text.matchAll(/^## (.+)$/gm)].map(m=>m[1]),headings,doc.id);
 if(doc.kind==='example')assert(!text.includes('【填写】'),'sample is incomplete '+doc.id);
}
for(const name of ['map','movement','clues','inventory','obstacles','outcome']){
 const text=await readFile(join(templateRoot,`campus-${name}.md`),'utf8');
 for(const label of ['职责：','输入：','处理规则：','输出：','接口：','正常／异常表现：'])assert(text.includes(label),name+' '+label);
}
assert.equal(runChecks(false).filter(r=>r.pass).length,7);
assert.equal(runChecks(true).filter(r=>!r.pass).length,2,'preset broken demo must expose its actual errors');
const game=createGame();assert.deepEqual(game.collect('A').collectedIds,['A']);assert.equal(game.collect('A').count,1);assert.equal(game.collect('Z').ok,false);assert.equal(game.collect('').count,1);
assert.deepEqual(game.move('left').position,MAP.start);assert.deepEqual(game.move('invalid').position,MAP.start);
const snapshot=game.snapshot();snapshot.collectedIds.push('B');assert.equal(game.snapshot().count,1,'snapshots cannot mutate state');
console.log('T-132/T-133 structure, budgets, templates, physical split, local links, deterministic hashes and game checks PASS');console.log(JSON.stringify(results,null,2));
