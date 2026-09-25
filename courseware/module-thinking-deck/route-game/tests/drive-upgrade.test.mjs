import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProject, recipe, saveDefinition, placeInstance } from '../../workshop/model.mjs';
import { initPhysics, DriveWorld, TERRAIN_HALF_WIDTH, terrainMesh } from '../../workshop/physics.mjs';
function car(){let p=emptyProject('upgrade');for(const behavior of ['wheel','thruster'])p=saveDefinition(p,{id:behavior,name:behavior,responsibility:'test',behavior,blocks:recipe(behavior)});for(const socket of ['wheel-fl','wheel-fr','wheel-rl','wheel-rr','engine'])p=placeInstance(p,{id:socket,definitionId:socket==='engine'?'thruster':'wheel',socket,rotation:socket==='engine'?180:0});return p;}
const run=(w,n,c)=>{for(let i=0;i<n;i++)w.advance(1/60,c);return w.snapshot()};
await initPhysics();
test('route map is 42 wide, has 32 side blocks, and glass remains 20',()=>{const w=new DriveWorld(car(),{differential:true,glassFinish:true});const s=w.snapshot();assert.equal(TERRAIN_HALF_WIDTH,21);const z=Array.from(terrainMesh().vertices).filter((_,i)=>i%3===2);assert.equal(Math.max(...z)-Math.min(...z),42);assert.equal(s.obstacles.length,32);assert.equal(s.glass.length,20);w.dispose();});
test('up is not thrust, Space releases immediately, and thrust level scales speed',()=>{const w=new DriveWorld(car(),{differential:true,glassFinish:true});const up=run(w,30,{forward:true});assert.equal(up.thrust,false);const fired=run(w,30,{thrust:true,thrustLevel:3});assert.equal(fired.thrust,true);const stopped=w.advance(1/60,{});assert.equal(stopped.thrust,false);const speeds=[1,3,5].map(level=>{const x=new DriveWorld(car(),{differential:true,glassFinish:true});const s=run(x,18,{thrust:true,thrustLevel:level});x.dispose();return s.speed});assert(speeds[1]>speeds[0]&&speeds[2]>speeds[1]);w.dispose();});
test('side blocks are dynamic bodies that move after impulse',()=>{const w=new DriveWorld(car(),{differential:true,glassFinish:true});const before=w.snapshot().obstacles.map(o=>o.p);for(const o of w.obstacles)o.body.applyImpulse({x:1,y:1,z:0},true);run(w,30,{});const after=w.snapshot().obstacles;assert(after.some((o,i)=>Math.hypot(o.p.x-before[i].x,o.p.y-before[i].y,o.p.z-before[i].z)>.05));w.dispose();});
test('real car can knock down both side stacks on the widened ground',()=>{
 for(const side of [-1,1]){
  const w=new DriveWorld(car(),{differential:true,glassFinish:true});
  for(const body of [w.body,...w.wheels.map(w=>w.body)]){const p=body.translation();body.setTranslation({...p,z:p.z+side*12},true);}
  run(w,180,{});const before=w.snapshot().obstacles;let touched=false;
  for(let i=0;i<480;i++){w.advance(1/60,{thrust:true,thrustLevel:3});for(const obstacle of w.obstacles)for(const body of [w.body,...w.wheels.map(w=>w.body)])w.world.contactPair(body.collider(0),obstacle.body.collider(0),()=>{touched=true;});}
  const after=w.snapshot().obstacles;assert(touched,'actual vehicle contacts a side stack');assert(after.filter((o,i)=>Math.hypot(o.p.x-before[i].p.x,o.p.z-before[i].p.z)>.4).length>=4,'side stack collapses after impact');w.dispose();
 }
});

test('both side stacks remain upright on level bases before impact',()=>{const w=new DriveWorld(car(),{differential:true,glassFinish:true});const before=w.snapshot().obstacles;run(w,600,{});const after=w.snapshot().obstacles;for(let i=0;i<after.length;i++){assert(Math.hypot(after[i].p.x-before[i].p.x,after[i].p.z-before[i].p.z)<.12,'no unprompted sliding');assert(Math.abs(after[i].q.w)>.98,'no unprompted collapse');}w.dispose();});
