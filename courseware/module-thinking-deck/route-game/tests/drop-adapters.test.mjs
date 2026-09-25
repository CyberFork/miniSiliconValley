import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validItemPositions,createGameState,itemPosition,ITEMS} from '../state.mjs';
test('drop positions in saved/broadcast state are validated while old saves remain valid',()=>{
 assert(validItemPositions(undefined));assert(validItemPositions({}));assert(validItemPositions({coin:{x:12,y:2,z:-5}}));
 for(const bad of [null,[],{unknown:{x:0,y:0,z:0}},{coin:{x:NaN,y:0,z:0}},{coin:{x:0,y:0}}])assert.equal(validItemPositions(bad),false);
 assert.deepEqual(itemPosition(createGameState(),'key'),ITEMS[2].position);
});
test('both renderers and pickup rules use the same saved world positions',()=>{
 const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
 const workshop=readFileSync(new URL('../../workshop/gameplay.mjs',import.meta.url),'utf8');
 assert.match(app,/obj\.mesh\.position\.copy\(itemPosition\(game,item.id\)\)/);
 assert.match(workshop,/item\.position\.copy\(itemPosition\(this.state,id\)\)/);
 assert.match(app,/const p=snapshot\?\.chassis\?\.p;game=discardItem/);
 assert.match(workshop,/render\(snapshot,mode,owner\)\{this.snapshot=snapshot/);
 assert.match(workshop,/const p=this.snapshot\?\.chassis\?\.p;this.state=discardItem/,'read latest pose at click time, never the pose when bag button was created');
 for(const code of [app,workshop]){assert.match(code,/validItemPositions/);assert.match(code,/y:terrainHeight\(p.x\)\+\.35,z:p.z/,'land at current x/z on terrain');}
});
