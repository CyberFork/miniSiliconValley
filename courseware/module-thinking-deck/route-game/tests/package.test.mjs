import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
test('P1 packages the same game and physics for both screens, never teacher notes in audience',async()=>{
 const manifest=JSON.parse(await readFile(new URL('dist/BUILD-MANIFEST.json',root),'utf8'));
 for(const file of ['route-game/app.mjs','route-game/state.mjs','route-game/controls.mjs','route-game/effects.mjs','route-game/game.css','route-game/index.html','workshop/model.mjs','workshop/physics.mjs','workshop/render.mjs','workshop/drive-input.mjs']){
  const a=await readFile(new URL('dist/audience/'+file,root));
  const t=await readFile(new URL('dist/teacher/'+file,root));
  assert.deepEqual(a,t,file);
 }
 assert.ok(manifest.audience.every(file=>!file.path.includes('presenter-notes')&&!file.path.includes('workshop/teacher')));
 await assert.rejects(access(new URL('dist/audience/workshop/app.mjs',root)));
 for(const runtime of ['presenter-runtime.js','deck-runtime.js']){
  const source=await readFile(new URL(runtime,root),'utf8');
  assert.match(source,/data-car-game/);assert.match(source,/route-game\/index\.html/);
 }
});
