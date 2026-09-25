import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProject, recipe, saveDefinition, placeInstance } from '../../workshop/model.mjs';
import { initPhysics, DriveWorld } from '../../workshop/physics.mjs';
import { createGameState, stepGame, discardItem } from '../state.mjs';

function car() {
 let p = emptyProject('route-game-physics');
 for (const behavior of ['wheel', 'thruster']) p = saveDefinition(p, { id: behavior, name: behavior, responsibility: 'physics test', behavior, blocks: recipe(behavior) });
 for (const socket of ['wheel-fl', 'wheel-fr', 'wheel-rl', 'wheel-rr', 'engine']) p = placeInstance(p, { id: socket, definitionId: socket === 'engine' ? 'thruster' : 'wheel', socket, rotation: socket === 'engine' ? 180 : 0 });
 return p;
}
const drive = (world, state, frames, controls = { thrust: true }) => {
 let next = state;
 for (let i = 0; i < frames; i++) {
  const pose = world.advance(1 / 60, controls).chassis.p;
  next = stepGame(next, { x: pose.x, y: pose.y, z: pose.z });
 }
 return next;
};

await initPhysics();

test('real four-wheel DriveWorld reaches route items, capacity, discard, and finish', () => {
 const world = new DriveWorld(car(),{differential:true,glassFinish:true});
 let state = createGameState();
 // Let the vehicle settle on Rapier terrain before applying engine thrust.
 state = drive(world, state, 180, { brake: true });
 for(let i=0;i<600&&state.bag.length<2;i++)state=drive(world,state,1);
 assert.deepEqual(state.bag, ['coin', 'tool'], 'actual drive should collect coin and tool');
 let blocked=state;
 for(let i=0;i<600&&!blocked.message.includes('两格已满');i++)blocked=drive(world,blocked,1);
 assert.deepEqual(blocked.bag, ['coin', 'tool'], 'full bag must reject key');
 assert.equal(blocked.collected.includes('key'), false);
 assert.ok(blocked.events.some(event => event.includes('两格已满')), 'must really collide with the key while full');
 const dropped = discardItem(blocked, 'coin', world.snapshot().chassis.p);
 assert.equal(dropped.bag.includes('coin'), false);
 // Item is now at the car, but cannot be picked back up until it leaves.
 const afterDrop = drive(world, dropped, 1, { brake: true });
 assert.equal(afterDrop.bag.includes('coin'), false);
 const withKey = drive(world, afterDrop, 120);
 assert.ok(withKey.bag.includes('key'), 'actual drive should collect key after discard');
 const won = drive(world, withKey, 180);
 assert.equal(won.won, true, 'actual drive with key should reach finish');
 world.dispose();
});

test('differential wheels pivot left/right, reverse travels backwards, no chassis yaw assist',()=>{
 for(const steer of [1,-1]){
  const world=new DriveWorld(car(),{differential:true,glassFinish:true});
  for(let i=0;i<120;i++)world.advance(1/60);
  const before=world.snapshot();for(let i=0;i<180;i++)world.advance(1/60,{steer});const after=world.snapshot();
  assert(after.chassis.q.y*steer>.6,'opposite wheel drive must produce a visible real yaw');
  assert(after.driveTargets.left*steer<0&&after.driveTargets.right*steer>0,'inner and outer wheels run in opposite directions');
  assert(Math.hypot(after.chassis.p.x-before.chassis.p.x,after.chassis.p.z-before.chassis.p.z)<1,'pivot stays near its starting place');
  world.dispose();
 }
 const world=new DriveWorld(car(),{differential:true});for(let i=0;i<120;i++)world.advance(1/60);const start=world.snapshot().chassis.p.x;
 for(let i=0;i<120;i++)world.advance(1/60,{reverse:true});assert(world.snapshot().chassis.p.x<start-2);assert.equal(world.snapshot().thrust,false);world.dispose();
});
test('glass stack rests until impact then real car scatters its dynamic colliders',()=>{
 const world=new DriveWorld(car(),{differential:true,glassFinish:true});for(let i=0;i<240;i++)world.advance(1/60);const before=world.snapshot();
 assert.equal(before.glass.length,20);assert.equal(world.wall,undefined,'old indestructible wall is absent in route game');
 assert(before.glass.every(g=>Math.abs(g.p.x-9.3)<.12),'stack must not fall without an impact');
 for(let i=0;i<480;i++)world.advance(1/60,{thrust:true});const after=world.snapshot();
 assert(after.glass.filter((g,i)=>Math.hypot(g.p.x-before.glass[i].p.x,g.p.z-before.glass[i].p.z)>.4).length>=10,'actual impact knocks down most of the glass');
 assert(after.chassis.p.x>11,'the finish barrier is not an invisible fixed wall');assert(after.thrust);
 world.pause();assert.equal(world.snapshot().thrust,false);world.dispose();
});
