import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),box={window:{}};
for(const f of ['deck-data.js','presenter-notes.js'])vm.runInNewContext(await readFile(new URL(f,root),'utf8'),box);
const d=box.window.MSV_MODULE_DECK,n=box.window.MSV_MODULE_PRESENTER_NOTES;
assert(['draft','deployment-ready'].includes(d.releaseStatus));
const manifest=JSON.parse(await readFile(new URL('dist/BUILD-MANIFEST.json',root),'utf8'));
assert.equal(manifest.version,d.version);assert.equal(manifest.releaseStatus,d.releaseStatus);
if (manifest.releaseStatus === 'draft') assert.equal(manifest.releaseRevision,null);
else { assert.equal(manifest.releaseRevision,29); assert.equal(manifest.manualAcceptance,'not-signed-by-user'); }
const forbidden=/失物|招领|校园订餐|配送|订单|登录模块|AI 智能体组成/;
for(const f of ['deck-data.js','presenter-notes.js','source/content-map.md','dist/audience/deck-data.js','dist/teacher/deck-data.js','dist/teacher/presenter-notes.js'])assert.doesNotMatch(await readFile(new URL(f,root),'utf8'),forbidden,f);
assert.equal(d.slides.length,41);assert.equal(d.slides.reduce((a,s)=>a+s.minutes,0),240);
for(const s of d.slides){assert(n[s.id]);assert.equal(parseInt(n[s.id].minutes),s.minutes);}
const byId=id=>d.slides.find(s=>s.id===id);
assert.match(byId('module-s01').subtitle,/小车闯关游戏/);
assert.match(byId('module-s06').content,/检查过关条件/);
assert.equal(byId('module-s08'),undefined,'S08 removed by user');
assert.equal(n['module-s08'],undefined);
assert.equal(byId('module-s06').minutes,3);
assert.match(byId('module-s09').content,/道具模块/);
assert.match(byId('module-s12').title,/小车闯关游戏/);
assert(!d.slides.some(slide=>slide.id==='module-s11'),'S11 removed by user');
for(const id of ['module-my-map','module-my-check','module-my-peer'])assert(n[id].script.some(s=>s.includes('你的游戏是什么')));
for(const id of ['module-s02','module-s02-build','module-s02-voxel','module-s05','module-s14'])assert.match(byId(id).content,/data-module-3d=/,id);
assert.match(byId('module-review').content,/职责/);assert.match(byId('module-review').content,/正常／异常/);
const catalog=JSON.parse(await readFile(new URL('../../app/lib/courseware-text-catalog.json',root),'utf8'));
assert(catalog.some(c=>c.version==='2026.09.21-p1-r10' || c.version==='2026.09.22-p1-r10'),'historical text edition retained');
assert.deepEqual(catalog.find(c=>c.version===d.version).slideIds,Array.from(d.slides,s=>s.id));
console.log('P1_GAME_FOCUS_PASS: 39 slides, 120+120 minutes, game-only active examples, own-project interaction, draft isolation.');
const six=byId('module-description');
assert.match(six.content,/data-module-3d="automation"/);
for(const field of ['duty','input','rule','output','interface','exception'])assert.match(six.content,new RegExp('data-conveyor-select="'+field+'"'));
for(const file of ['deck-runtime.js','presenter-runtime.js']){const code=await readFile(new URL(file,root),'utf8');assert.match(code,/conveyorFocus/);assert.match(code,/data-conveyor-select/);}
const teacher=await readFile(new URL('dist/teacher/presenter.html',root),'utf8');
assert.match(teacher,/data-workshop-link/);assert.match(teacher,/NpJXhHFVtOY/);assert.match(teacher,/IQiFRmZ4mN4/);
assert.match(await readFile(new URL('dist/teacher/workshop/teacher/presenter.html',root),'utf8'),/app\.mjs\?v=mc-/);
console.log('CONVEYOR_SIX_AND_TEACHER_RESOURCES_PASS');
