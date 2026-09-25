import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../vendor/three.module.min.js';
import { ITEMS, itemLabel } from '../state.mjs';
import { createWorldItem } from '../effects.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, '..', p), 'utf8');

test('world item metadata has stable ids, names, positions, and emoji icons', () => {
  assert.deepEqual(ITEMS.map(({ id }) => id), ['coin', 'tool', 'key']);
  assert.deepEqual(ITEMS.map(({ name }) => name), ['金币', '工具', '钥匙']);
  assert.deepEqual(ITEMS.map(({ icon }) => icon), ['🪙', '🔧', '🔑']);
  for (const item of ITEMS) assert.deepEqual(Object.keys(item.position).sort(), ['x', 'y', 'z']);
});

test('itemLabel uses icon and has a Chinese fallback for unknown ids', () => {
  assert.equal(itemLabel('coin'), '🪙 金币');
  assert.equal(itemLabel('key'), '🔑 钥匙');
  assert.equal(itemLabel('missing'), '道具');
});

test('both renderers use shared world-item factory and itemLabel, not legacy cubes', () => {
  const app = read('app.mjs');
  const workshop = fs.readFileSync(path.join(here, '..', '..', 'workshop', 'gameplay.mjs'), 'utf8');
  for (const source of [app, workshop]) {
    assert.match(source, /createWorldItem/);
    assert.match(source, /itemLabel\(/);
    assert.doesNotMatch(source, /new THREE\.BoxGeometry\(\.5,\.5,\.5\)/);
  }
});

test('createWorldItem returns a group containing an icon sprite and draws the emoji', () => {
  const calls = [];
  globalThis.document = {
    createElement(type) {
      assert.equal(type, 'canvas');
      return { width: 0, height: 0, getContext() { return {
        font: '', textAlign: '', textBaseline: '', fillStyle: '',
        clearRect(...args) { calls.push(['clearRect', ...args]); },
        fillText(...args) { calls.push(['fillText', ...args]); },
      }; } };
    },
  };
  const item = ITEMS[0];
  const world = createWorldItem(item);
  assert.ok(world instanceof THREE.Group);
  assert.ok(world.children.some((child) => child instanceof THREE.Sprite), 'factory should add a sprite icon');
  assert.ok(calls.some(([op, ...args]) => op === 'fillText' && args.includes(item.icon)), 'emoji should be rendered to canvas');
  delete globalThis.document;
});
