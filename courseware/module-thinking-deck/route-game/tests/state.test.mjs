import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITEMS, FINISH, CAPACITY, REQUIRED_ITEM, createGameState, stepGame, discardItem, itemPosition } from '../state.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const at = (p) => ({ x: p.x, y: p.y, z: p.z });

 test('exports the three world items and finish constants', () => {
  assert.equal(CAPACITY, 2);
  assert.equal(REQUIRED_ITEM, 'key');
  assert.deepEqual(ITEMS.map(({ id }) => id), ['coin', 'tool', 'key']);
  for (const item of ITEMS) assert.deepEqual(Object.keys(item.position).sort(), ['x', 'y', 'z']);
  assert.deepEqual(Object.keys(FINISH).sort(), ['x', 'y', 'z']);
});

test('createGameState starts empty and reset-like', () => {
 const state = createGameState();
 assert.deepEqual(state.bag, []); assert.deepEqual(state.collected, []);
 assert.equal(state.won, false); assert.equal(state.stage, 0); assert.deepEqual(state.events, []);
});

test('stepGame picks nearby items once, respects height tolerance, and is immutable', () => {
 const initial = createGameState();
 const first = stepGame(initial, { ...at(ITEMS[0].position), y: ITEMS[0].position.y + 2 });
 assert.deepEqual(initial.bag, []); assert.deepEqual(first.bag, ['coin']);
 const repeat = stepGame(first, at(ITEMS[0].position));
 assert.deepEqual(repeat.bag, ['coin']); assert.deepEqual(repeat.collected, ['coin']);
});

test('full bag rejects an item without consuming it, then discard respawns it', () => {
 let state = createGameState();
 state = stepGame(state, at(ITEMS[0].position));
 state = stepGame(state, at(ITEMS[1].position));
 const full = stepGame(state, at(ITEMS[2].position));
 assert.deepEqual(full.bag, ['coin', 'tool']);
 assert.equal(full.collected.includes('key'), false);
 assert.match(full.message, /满|两格已满/);
 const dropped = discardItem(full, 'coin', { x: 3, y: 1, z: 2 });
 assert.deepEqual(dropped.bag, ['tool']); assert.equal(dropped.collected.includes('coin'), false);
 const picked = stepGame(dropped, at(ITEMS[2].position));
 assert.deepEqual(picked.bag, ['tool', 'key']);
});

test('discarding absent item preserves state; winning requires key at finish', () => {
 let state = stepGame(createGameState(), at(ITEMS[0].position));
 const before = structuredClone(state);
 assert.deepEqual(discardItem(state, 'missing', { x: 3, y: 1, z: 2 }), before);
 const noKey = stepGame(state, at(FINISH));
 assert.equal(noKey.won, false);
 state = stepGame(discardItem(state, 'coin', { x: 3, y: 1, z: 2 }), at(ITEMS[2].position));
 const won = stepGame(state, at(FINISH));
 assert.equal(won.won, true);
});

test('state updates are immutable and event history is capped at six', () => {
 let state = createGameState();
 for (let i = 0; i < 10; i++) state = stepGame(state, { x: i * 1.1, y: 1, z: 0 });
 assert.ok(state.events.length <= 6);
 const snapshot = createGameState();
 const next = stepGame(snapshot, at(ITEMS[0].position));
 assert.notStrictEqual(next, snapshot); assert.deepEqual(snapshot, createGameState());
});

test('game frame statically sources the state module and has no teacher notes', () => {
 const html = fs.readFileSync(path.join(here, '..', 'index.html'), 'utf8');
 const app = fs.readFileSync(path.join(here, '..', 'app.mjs'), 'utf8');
 assert.match(html, /src="loading.js"/);
 assert.match(fs.readFileSync(path.join(here, '..', 'loading.js'), 'utf8'), /import\('\.\/app\.mjs'\)/);
 assert.match(app, /state\.mjs/);
 assert.doesNotMatch(html + app, /teacher[- _]?notes|教师笔记/i);
});

 test('dropping an item while in its pickup radius requires leaving before recollection', () => {
 let state=stepGame(createGameState(),at(ITEMS[0].position));
 state=discardItem(state,'coin',{x:3,y:1,z:2});
 state=stepGame(state,at(ITEMS[0].position));
 assert.deepEqual(state.bag,[]);
 state=stepGame(state,{x:-4,y:1,z:0});
 state=stepGame(state,{x:3,y:1,z:2});
 assert.deepEqual(state.bag,['coin']);
});

test('overlapping key and finish checks do not flood the teaching event log',()=>{
 let state=stepGame(stepGame(createGameState(),ITEMS[0].position),ITEMS[1].position);
 for(let i=0;i<100;i++)state=stepGame(state,{x:8,y:1,z:0});
 assert.equal(new Set(state.events).size,state.events.length);
 assert.ok(state.events.some(event=>event.includes('收到金币')));
});
