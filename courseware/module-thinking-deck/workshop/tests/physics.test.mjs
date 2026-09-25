import test from 'node:test';import assert from 'node:assert/strict';
import {emptyProject,recipe,saveDefinition,placeInstance,rotateInstance} from '../model.mjs';import {initPhysics,DriveWorld,terrainHeight,CRASH_BLOCKS} from '../physics.mjs';
function car(){let p=emptyProject('physics');for(const behavior of ['wheel','thruster'])p=saveDefinition(p,{id:behavior,name:behavior,responsibility:'教学',behavior,blocks:recipe(behavior)});for(const socket of ['wheel-fl','wheel-fr','wheel-rl','wheel-rr','engine'])p=placeInstance(p,{id:socket,definitionId:socket==='engine'?'thruster':'wheel',socket,rotation:socket==='engine'?180:0});return p;}
await initPhysics();
const run=(w,n,c={})=>{for(let i=0;i<n;i++)w.advance(1/60,c);return w.snapshot()};
test('gravity, contact, propulsion, real rough course and repeatable reset',()=>{const w=new DriveWorld(car()),initial=w.snapshot();for(const body of [w.body,...w.wheels.map(x=>x.body)]){const p=body.translation();body.setTranslation({...p,z:p.z+4},true);}const settled=run(w,180);assert.ok(settled.chassis.p.y<initial.chassis.p.y-.5);assert.ok(settled.chassis.p.y>.5);const positions=[];for(let i=0;i<600;i++){w.advance(1/60,{thrust:true});positions.push(w.snapshot().chassis.p);}console.log('DRIVE_SAMPLE',positions[599],Math.min(...positions.map(p=>p.y)),Math.max(...positions.map(p=>p.y)));assert.ok(positions.some(p=>p.x>27),'must reach drop');assert.ok(positions.some(p=>p.y>1.8),'must climb actual ramp');assert.ok(positions.some(p=>p.x>27&&p.x<40&&p.y<1&&p.y>-.8),'must fall after drop');w.reset();assert.deepEqual(w.snapshot(),initial);w.dispose();});
test('release coasts, brake differs, reverse direction uses same project, bounded timestep',()=>{const p=car(),a=new DriveWorld(p),b=new DriveWorld(p),r=new DriveWorld(rotateInstance(p,'engine'));run(a,120);run(b,120);run(r,120);run(a,60,{thrust:true});run(b,60,{thrust:true});const reverse=run(r,60,{thrust:true});assert.ok(reverse.chassis.p.x<-.5);const coast=run(a,30),brake=run(b,30,{brake:true});assert.ok(coast.speed>.4);assert.ok(brake.speed<coast.speed);const before=a.steps;a.advance(100);assert.ok(a.steps-before<=12);a.pause();assert.equal(a.accumulator,0);for(const w of [a,b,r])w.dispose();assert.notEqual(terrainHeight(10),terrainHeight(0));});

test('engine rotation 180 pushes forward while exhaust points backward; rotation 0 reverses',()=>{const forward=new DriveWorld(car()),backward=new DriveWorld(rotateInstance(car(),'engine'));run(forward,120);run(backward,120);const a=run(forward,90,{thrust:true}),b=run(backward,90,{thrust:true});assert.ok(a.chassis.p.x>.5);assert.ok(b.chassis.p.x<-.5);forward.dispose();backward.dispose();});

test('left and right steering produce opposite lateral trajectories, then releasing steer stops input',()=>{const left=new DriveWorld(car()),right=new DriveWorld(car()),released=new DriveWorld(car()),held=new DriveWorld(car());for(const w of [left,right,released,held])run(w,120);const l=run(left,180,{thrust:true,steer:1}),r=run(right,180,{thrust:true,steer:-1});assert.ok(Math.sign(l.chassis.p.z)!==Math.sign(r.chassis.p.z));run(released,90,{thrust:true,steer:1});run(held,90,{thrust:true,steer:1});const afterRelease=run(released,90,{thrust:true,steer:0}),stillHeld=run(held,90,{thrust:true,steer:1});assert.ok(Math.abs(stillHeld.chassis.p.z-afterRelease.chassis.p.z)>.05);for(const w of [left,right,released,held])w.dispose();});

test('crash blocks remain stable before arrival and are displaced by actual Rapier contact',()=>{
 const w=new DriveWorld(car());run(w,120);
 const before=w.crash.map(x=>({...x.body.translation()}));run(w,120);
 assert.ok(before.every((p,i)=>Math.hypot(p.x-w.crash[i].body.translation().x,p.z-w.crash[i].body.translation().z)<.05),'blocks should be initially stable');
 const impactStart=w.crash.map(x=>({...x.body.translation()}));let touching=false;
 for(let n=0;n<900;n++){w.advance(1/60,{thrust:true});for(const body of [w.body,...w.wheels.map(x=>x.body)])for(const block of w.crash)w.world.contactPair(body.collider(0),block.body.collider(0),()=>{touching=true;});}
 assert.ok(touching,'car must make actual Rapier contact with dynamic crash blocks');
 assert.ok(w.crash.some((x,i)=>Math.hypot(x.body.translation().x-impactStart[i].x,x.body.translation().z-impactStart[i].z)>.15),'impact must displace at least one crash block');
 assert.equal(CRASH_BLOCKS.length,w.crash.length);w.dispose();
});
