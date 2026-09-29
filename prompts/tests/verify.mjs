import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { buildPromptCenter, studentWorkbookSource } from '../build.mjs';

const sourcePrompt = await readFile(join(studentWorkbookSource, 'student-prompt.txt'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(sourcePrompt),'0115cb417d432841867da325d8c822b461b14ad02030f48cb4d45abbdc8037bc','migration must not rewrite the approved prompt');
const output = await mkdtemp(join(tmpdir(), 'public-prompts-'));
try {
  const manifest = await buildPromptCenter(output);
  const expected = ['index.html', 'workbook.css', 'workbook.js', 'student-prompt.js', 'student-prompt.txt'];
  assert.deepEqual(Object.keys(manifest.files).sort(), expected.sort());
  for (const file of expected) assert.equal(manifest.files[file], hash(await readFile(join(output, file))), `${file} hash`);
  assert.equal(manifest.promptSha256, hash(sourcePrompt));

  const html = await readFile(join(output, 'index.html'), 'utf8');
  assert.match(html, /href="\/prompts\/"/);
  assert.match(html, /href="#game-development"/);
  assert.match(html, /id="planning"/);
  assert.equal((html.match(/<button\b/g) || []).length, 1);
  assert.match(html, /id="copy"/);

  const generated={window:{}}; vm.runInNewContext(await readFile(join(output,'student-prompt.js'),'utf8'),generated);
  assert.equal(generated.window.MSV_STUDENT_PROMPT,sourcePrompt.toString());
  const script = await readFile(join(output, 'workbook.js'), 'utf8');
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|innerHTML|outerHTML/);
  const nodes = {};
  class El { value = ''; textContent = ''; open = false; focused = false; selected = false; events = {}; addEventListener(n, f) { this.events[n] = f; } focus() { this.focused = true; } select() { this.selected = true; } setSelectionRange() { this.selected = true; } }
  for (const id of ['planning', 'preview', 'copy', 'status', 'preview-panel']) nodes[id] = new El();
  const prompt = sourcePrompt.toString();
  let copied = ''; let denied = false; let beforeUnload;
  const context = { window: { MSV_STUDENT_PROMPT: prompt }, document: { getElementById: id => nodes[id] }, navigator: { clipboard: { writeText: async value => { if (denied) throw Error('denied'); copied = value; } } }, addEventListener: (n, f) => { if (n === 'beforeunload') beforeUnload = f; }, console };
  vm.runInNewContext(script, context);
  const marker = '<img src=x onerror=globalThis.__pwned=1>';
  nodes.planning.value = marker; nodes.planning.events.input(); await nodes.copy.events.click();
  assert.equal(copied, nodes.preview.value); assert.equal(context.window.__pwned, undefined);
  denied = true; await nodes.copy.events.click(); assert(nodes['preview-panel'].open && nodes.preview.focused && nodes.preview.selected);
  let prevented = false; beforeUnload({ preventDefault: () => { prevented = true; } }); assert(prevented);
  const noPrompt = { ...context, window: {} }; vm.runInNewContext(script, noPrompt); assert(nodes.copy.disabled);
  console.log('PASS public prompt center: canonical bytes, manifest hashes, navigation/input/copy UI, VM clipboard fallback, safe text, no storage/upload, missing prompt disabled');
} finally { await rm(output, { recursive: true, force: true }); }
