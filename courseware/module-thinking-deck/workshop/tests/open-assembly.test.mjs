import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProject, saveDefinition, recipe, chassisSize, chassisParts,
  placeOnChassis, removeInstance, parseProject, validateProject } from '../model.mjs';
import { initPhysics, DriveWorld } from '../physics.mjs';

function project() {
  let p = emptyProject('open-assembly');
  for (const behavior of ['wheel', 'thruster', 'chassis'])
    p = saveDefinition(p, { id: behavior, name: behavior, responsibility: 'test', behavior, blocks: recipe(behavior) });
  return p;
}
function add(p, id, definitionId, position, normal) {
  return placeOnChassis(p, { id, definitionId, position, normal });
}

test('open assembly supports unlimited-ish wheels, multiple engines, roundtrip, and extensions', () => {
  let p = project();
  assert.deepEqual(chassisSize(p.definitions.find(d => d.behavior === 'chassis')).map(x => Number(x.toFixed(6))), [1.2, .4, 1.2]);
  assert.deepEqual(chassisParts(p).map(x => x.size), [[3, .4, 1.2]]);
  for (const x of [-1, -.5, 0, .5, 1]) for (const z of [-.84, .84])
    p = add(p, `wheel-${x}-${z}`, 'wheel', [x, 0, z], [0, 0, z > 0 ? 1 : -1]);
  p = add(p, 'engine-a', 'thruster', [.4, .44, 0], [0, 1, 0]);
  p = add(p, 'engine-b', 'thruster', [-.4, .44, 0], [0, 1, 0]);
  assert.equal(p.instances.length, 12);
  const json = JSON.stringify(p);
  assert.deepEqual(parseProject(json, 'open-assembly'), p);
  const before = structuredClone(p);
  let extended = add(p, 'body-a', 'chassis', [2.1, 0, 0], [1, 0, 0]);
  extended = add(extended, 'body-b', 'chassis', [3.3, 0, 0], [1, 0, 0]);
  extended = add(extended, 'wheel-extension', 'wheel', [3.3, 0, .84], [0, 0, 1]);
  assert.equal(chassisParts(extended).length, 3);
  assert.equal(extended.instances.length, 15);
  assert.deepEqual(p, before, 'placement must not mutate source project');
  assert.throws(() => add(p, 'floating', 'chassis', [2.1, 2, 0], [1, 0, 0]));
  assert.throws(() => add(p, 'overlap', 'chassis', [1.4, 0, 0], [1, 0, 0]));
  assert.throws(() => validateProject(removeInstance(extended, 'body-b')),
    /support|车身|wheel|连接|悬空/i);
});

test('extended chassis adds collider geometry and mass', async () => {
  await initPhysics();
  let base = project();
  base = add(base, 'body-a', 'chassis', [2.1, 0, 0], [1, 0, 0]);
  const extended = new DriveWorld(base);
  let longer = add(base, 'body-b', 'chassis', [3.3, 0, 0], [1, 0, 0]);
  longer = add(longer, 'wheel-extension', 'wheel', [3.3, 0, .84], [0, 0, 1]);
  const longerWorld = new DriveWorld(longer);
  assert.ok(longerWorld.world.colliders.len() > extended.world.colliders.len());
  assert.ok(longerWorld.body.mass() > extended.body.mass());
  extended.dispose(); longerWorld.dispose();
});

test('empty and partial cars remain finite; engines accumulate and wheels are optional', async () => {
  await initPhysics();
  const empty = emptyProject('empty');
  const world = new DriveWorld(empty, { differential: true });
  const s = world.advance(1 / 30, { forward: true, thrust: true });
  assert.ok(Object.values(s.velocity).every(Number.isFinite));
  assert.equal(s.wheels.length, 0);
  assert.equal(s.thrust, false, 'no engines means no thrust');
  world.dispose();

  let one = project();
  one = add(one, 'engine-a', 'thruster', [.4, .44, 0], [0, 1, 0]);
  let two = add(one, 'engine-b', 'thruster', [-.4, .44, 0], [0, 1, 0]);
  const w1 = new DriveWorld(one, { differential: true });
  const w2 = new DriveWorld(two, { differential: true });
  const a = w1.advance(.25, { thrust: true }).velocity.x;
  const b = w2.advance(.25, { thrust: true }).velocity.x;
  assert.ok(Math.abs(b) > Math.abs(a), 'two symmetric engines accelerate more than one');
  assert.ok(w2.world.bodies.len() > 0);
  w1.dispose(); w2.dispose();
});
