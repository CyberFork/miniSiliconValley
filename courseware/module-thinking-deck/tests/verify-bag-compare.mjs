import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const { sampleBagComparison } = await import('../bag-compare.js');

const sample = (mode, elapsed) => sampleBagComparison(mode, elapsed);

test('bag comparison exposes stable fields and starts from the regular bag', () => {
  for (const mode of ['wrong', 'correct']) {
    const value = sample(mode, 0);
    for (const key of ['carX', 'keyProgress', 'coinProgress', 'phase', 'bag', 'message']) assert.ok(key in value, `missing ${key}`);
    assert.deepEqual(value.bag, ['coin', 'tool']);
    assert.equal(value.carX, -3);
    assert.equal(value.keyProgress, 0);
    assert.equal(value.coinProgress, 0);
    assert.equal(value.phase, 'approach');
  }
});

test('timeline approaches smoothly, progresses only in the wrong comparison, and does not loop', () => {
  const wrong0 = sample('wrong', 0);
  const wrongMid = sample('wrong', 750);
  const wrongApproachEnd = sample('wrong', 2000);
  const wrongComplete = sample('wrong', 6000);
  assert.equal(wrongApproachEnd.carX, -0.5);
  assert.ok(wrongMid.carX > wrong0.carX && wrongMid.carX < wrongApproachEnd.carX, 'car should move smoothly during approach');
  assert.ok(wrongMid.carX < -1, 'midpoint should remain between approach endpoints');
  assert.equal(sample('wrong', -100).carX, -3, 'negative elapsed is clamped');
  assert.equal(sample('wrong', 9000).carX, wrongComplete.carX, 'timeline is not looping');
  assert.equal(wrongComplete.keyProgress, 1);
  assert.equal(wrongComplete.coinProgress, 1);
  assert.deepEqual(wrongComplete.bag, ['key', 'tool']);
  assert.notEqual(wrongComplete.message, sample('correct', 6000).message);

  assert.equal(sample('correct', 3000).keyProgress, 0);
  assert.equal(sample('correct', 3000).coinProgress, 0);
  assert.deepEqual(sample('correct', 6000).bag, ['coin', 'tool']);
  assert.equal(sample('correct', 6000).keyProgress, 0);
  assert.equal(sample('correct', 6000).coinProgress, 0);
  assert.equal(sample('unexpected', 6000).bag.join(','), 'coin,tool', 'invalid mode is safe/correct');
});

test('wrong comparison is explicit teaching feedback and does not touch route-game state', () => {
  const before = globalThis.localStorage;
  const wrong = sample('wrong', 6000);
  assert.match(String(wrong.message), /故意|教学|错误|wrong/i);
  assert.equal(globalThis.localStorage, before);
  assert.equal(Object.prototype.hasOwnProperty.call(globalThis, 'routeGameState'), false);
});

test('HTML wires the bag-demo actions and preserves the existing frame ids', () => {
  const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'deck-data.js'),'utf8'),context);
  const html=context.window.MSV_MODULE_DECK.slides.find(slide=>slide.id==='module-my-check').content;
  for (const action of ['open', 'wrong', 'correct', 'replay', 'close']) {
    assert.match(html, new RegExp(`data-bag-demo-action=["']${action}["']`));
  }
  assert.match(html, /data-module-3d=["']bag-compare["']/);
  for (let i = 1; i <= 30; i++) assert.equal([...html.matchAll(new RegExp(`data-msv-field="f${String(i).padStart(4, '0')}"`,'g'))].length,1);
});

test('both screens synchronize mode/start time without rebuilding the live scene',()=>{
 for(const name of ['deck-runtime.js','presenter-runtime.js']){
  const code=fs.readFileSync(path.join(root,name),'utf8');
  for(const token of ['const bagDemo =','startedAt:','selectBagDemo','wireBagDemo','paintBagDemo','data-webgl-ready="true"'])assert.ok(code.includes(token),`${name}: ${token}`);
 }
 const scene=fs.readFileSync(path.join(root,'module-3d.js'),'utf8');
 assert.ok(scene.includes('"bag-compare": createBagComparison'));
 assert.ok(scene.includes('sampleBagComparison(mode,'));
 const css=fs.readFileSync(path.join(root,'p1-scenes.css'),'utf8');
 assert.match(css,/\.bag-demo-status\{[^}]*z-index:3/);
 assert.match(css,/\.bag-demo-status\{[^}]*color:#182e43/);
});
