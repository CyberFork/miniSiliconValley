import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {stampAssets} from '../version-assets.mjs';
const root=new URL('../',import.meta.url);
test('HTML and complete first-party module graph share a content version; stamping is stable',async()=>{
 const v=await stampAssets();assert.equal(await stampAssets(),v);
 for(const file of ['teacher/presenter.html','audience/index.html','app.mjs','render.mjs','physics.mjs']){
  const text=await readFile(new URL(file,root),'utf8');
  for(const match of text.matchAll(/['"](\.\.?\/(?:app|drive-input|model|physics|render)\.mjs[^'"]*|\.\.\/workshop\.css[^'"]*)['"]/g))assert.match(match[1],new RegExp('\\?v='+v+'$'),file+' '+match[1]);
 }
 const app=await readFile(new URL('app.mjs',root),'utf8');assert(!app.includes("$('layer')"));assert(!app.includes("$('tool')"));
});
