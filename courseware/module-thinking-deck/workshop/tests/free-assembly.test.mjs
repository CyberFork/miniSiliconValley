import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyProject, recipe, saveDefinition, placeInstance, placeOnChassis,
  moveOnChassis, parseProject, mountPosition, mountNormal,
} from '../model.mjs';
import { initPhysics, DriveWorld } from '../physics.mjs';

function project() {
  let p = emptyProject('free-assembly');
  p = saveDefinition(p, { id: 'wheel', name: '轮子', responsibility: '滚动', behavior: 'wheel', blocks: recipe('wheel') });
  p = saveDefinition(p, { id: 'thruster', name: '推进器', responsibility: '推进', behavior: 'thruster', blocks: recipe('thruster') });
  return p;
}
const front = { position: [0, 0, 0.84], normal: [0, 0, 1] };
const side = { position: [1.74, 0, 0], normal: [1, 0, 0] };
const wheel = (p, id, socket, mount) => placeInstance(p, { id, definitionId: 'wheel', socket, ...mount });

test('free wheels auto-assign sockets while preserving one definition', () => {
  let p = project();
  p = placeOnChassis(p, { id: 'a', definitionId: 'wheel', ...front });
  p = placeOnChassis(p, { id: 'b', definitionId: 'wheel', ...side });
  assert.deepEqual(p.instances.map(i => i.socket), ['wheel-fl', 'wheel-fr']);
  assert.deepEqual(p.instances.map(i => ({ position: i.position, normal: i.normal })), [front, side]);
  assert.equal(p.definitions.length, 2);
  assert.equal(p.instances[0].definitionId, p.instances[1].definitionId);
  assert.deepEqual(p.definitions[0].blocks, recipe('wheel'));
});

test('moving one wheel leaves other instances and definitions unchanged', () => {
  let p = project();
  p = placeOnChassis(p, { id: 'a', definitionId: 'wheel', ...front });
  p = placeOnChassis(p, { id: 'b', definitionId: 'wheel', ...side });
  const before = structuredClone(p);
  const q = moveOnChassis(p, 'a', { position: [-1.74, 0, 0], normal: [-1, 0, 0] }.position, [-1, 0, 0]);
  assert.deepEqual(q.instances.find(i => i.id === 'a').position, [-1.74, 0, 0]);
  assert.deepEqual(q.instances.find(i => i.id === 'b'), before.instances.find(i => i.id === 'b'));
  assert.deepEqual(q.definitions, before.definitions);
});

test('JSON restore preserves explicitly selected mounts', () => {
  const p = placeOnChassis(project(), { id: 'a', definitionId: 'wheel', ...side });
  assert.deepEqual(parseProject(JSON.stringify(p)).instances[0].position, side.position);
  assert.deepEqual(parseProject(JSON.stringify(p)).instances[0].normal, side.normal);
});

test('invalid or off-surface mounts are rejected without mutating the source', () => {
  const p = placeOnChassis(project(), { id: 'a', definitionId: 'wheel', ...front });
  for (const bad of [
    { position: [NaN, 0, .84], normal: front.normal },
    { position: [Infinity, 0, .84], normal: front.normal },
    { position: [0, 0, 0], normal: front.normal },
    { position: [0, .3, .84], normal: front.normal },
    { position: [0, 0, .84], normal: [1, 1, 0] },
  ]) {
    const before = structuredClone(p);
    assert.throws(() => moveOnChassis(p, 'a', bad.position, bad.normal));
    assert.deepEqual(p, before);
    assert.throws(() => placeOnChassis(project(), { id: 'x', definitionId: 'wheel', ...bad }));
  }
});

test('legacy fixed-socket instances remain compatible', async () => {
  await initPhysics();
  let p = project();
  for (const socket of ['wheel-fl', 'wheel-fr', 'wheel-rl', 'wheel-rr']) p = wheel(p, socket, socket, {});
  assert.deepEqual(mountPosition(p.instances[0]), [1, -.35, -.92]);
  assert.deepEqual(mountNormal(p.instances[0]), [0, 0, 1]);
  p = placeInstance(p, { id: 'e', definitionId: 'thruster', socket: 'engine', rotation: 0 });
  const w = new DriveWorld(p); w.dispose();
});

test('DriveWorld wheel starts at chassis offset and cylinder axis follows mount normal', async () => {
  await initPhysics();
  let p = project();
  p = placeOnChassis(p, { id: 'a', definitionId: 'wheel', ...front });
  p = placeOnChassis(p, { id: 'b', definitionId: 'wheel', ...side });
  p = placeOnChassis(p, { id: 'c', definitionId: 'wheel', position: [-1.74, 0, 0], normal: [-1, 0, 0] });
  p = placeOnChassis(p, { id: 'd', definitionId: 'wheel', position: [0, 0, -0.84], normal: [0, 0, -1] });
  p = placeInstance(p, { id: 'e', definitionId: 'thruster', socket: 'engine' });
  const w = new DriveWorld(p);
  for (const wheelBody of w.wheels) {
    const instance = p.instances.find(i => i.id === wheelBody.id);
    const t = wheelBody.body.translation();
    const expected = mountPosition(instance);
    assert.ok(Math.abs(t.x - expected[0]) < 1e-5);
    assert.ok(Math.abs(t.y - (expected[1] + 2)) < 1e-5);
    assert.ok(Math.abs(t.z - expected[2]) < 1e-5);
  }
  w.dispose();
});
