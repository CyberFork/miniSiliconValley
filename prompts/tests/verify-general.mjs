import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { buildPromptCenter } from '../build.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const root = await mkdtemp(join(tmpdir(), 'general-prompts-'));
try {
  const manifest = await buildPromptCenter(root);
  const dir = join(root, 'general');
  const files = ['index.html', 'workbook.js', 'workbook.css', 'student-prompt.js', 'student-prompt.txt', 'manifest.json'];
  for (const file of files) assert.ok(await readFile(join(dir, file)), `general/${file} exists`);
  const gm = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  const hashed = ['index.html', 'workbook.js', 'workbook.css', 'student-prompt.js', 'student-prompt.txt'];
  for (const file of hashed) assert.equal(gm.files[file], hash(await readFile(join(dir, file))), `general/${file} hash`);
  assert.equal(gm.promptSha256, hash(await readFile(join(dir, 'student-prompt.txt'))));
  assert.equal(manifest.general.promptSha256, gm.promptSha256);

  const text = (await readFile(join(dir, 'student-prompt.txt'), 'utf8'));
  const generated = { window: {} };
  vm.runInNewContext(await readFile(join(dir, 'student-prompt.js'), 'utf8'), generated);
  assert.equal(generated.window.MSV_STUDENT_PROMPT, text);
  const html = await readFile(join(dir, 'index.html'), 'utf8');
  for (const id of ['planning', 'copy', 'preview', 'preview-panel', 'status']) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.match(html, /href=["']\/prompts\/["']/);
  assert.match((await readFile(join(root, 'index.html'), 'utf8')), /href=["']\/prompts\/general\/?["']/);

  const script = await readFile(join(dir, 'workbook.js'), 'utf8');
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|innerHTML|outerHTML/);
  const nodes = {};
  class El { value = ''; textContent = ''; open = false; disabled = false; focused = false; selected = false; events = {}; addEventListener(n, f) { this.events[n] = f; } focus() { this.focused = true; } select() { this.selected = true; } setSelectionRange() { this.selected = true; } }
  for (const id of ['planning', 'preview', 'copy', 'status', 'preview-panel']) nodes[id] = new El();
  let copied = ''; let denied = false; let beforeUnload;
  const context = { window: { MSV_STUDENT_PROMPT: text }, document: { getElementById: id => nodes[id] }, navigator: { clipboard: { writeText: async value => { if (denied) throw Error('denied'); copied = value; } } }, addEventListener: (n, f) => { if (n === 'beforeunload') beforeUnload = f; }, console };
  vm.runInNewContext(script, context);
  nodes.planning.value = '<img src=x onerror=globalThis.__pwned=1>'; nodes.planning.events.input(); await nodes.copy.events.click();
  assert.match(copied, /我的项目说明：/); assert.equal(context.window.__pwned, undefined);
  denied = true; await nodes.copy.events.click(); assert(nodes['preview-panel'].open && nodes.preview.focused && nodes.preview.selected);
  let prevented = false; beforeUnload({ preventDefault: () => { prevented = true; } }); assert(prevented);
  nodes.planning.value = ''; nodes.planning.events.input(); assert.match(nodes.preview.value, /项目想法/);

  for (const term of ['执行者→上下文与项目设计→目标→约束→避免→验收','主棍：已明确 n/6 项','子棍：正在核对第 n 个模块，共 m 个（n/m）','不显示子棍内部六项进度','不添加二级进度','不能默认采用推荐','2–3 个','推荐','暂不提供／以后补充','同一个 Markdown 代码框','完整文档交付后就停止','不自动进入项目实施','未确认前，不要派生子棍','每次只展示一个模块','不默认一定要做网站、APP 或软件','不要求我逐根审批执行棍']) assert(text.includes(term), term);
  assert.equal(text,await readFile(new URL('../general-project/student-prompt.txt',import.meta.url),'utf8'));
  assert.equal((html.match(/<button\b/g)||[]).length,1);
  assert.equal(copied,text.trim()+'\n\n---\n\n我的项目说明：\n<img src=x onerror=globalThis.__pwned=1>\n');
  assert(generated.window.MSV_STUDENT_PROMPT!==await readFile(new URL('../game-development/student-prompt.txt',import.meta.url),'utf8'));
  for (const word of ['Minecraft', '玩家', '玩法', '2D', '3D']) assert.doesNotMatch(text, new RegExp(word, 'i'));
  vm.runInNewContext(script,{...context,window:{}}); assert.equal(nodes.copy.disabled,true);
  console.log('PASS general prompt center: hashes, navigation, VM copy/fallback, safe input, no storage/upload, prompt contract');
} finally { await rm(root, { recursive: true, force: true }); }
