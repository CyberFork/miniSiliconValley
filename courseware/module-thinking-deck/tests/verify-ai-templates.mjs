import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {coachSpec, promptPacks} from '../scripts/prompt-packs.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sourceDir = path.join(root, 'ai-materials', 'templates');
const outDir = path.join(root, 'dist', 'audience', 'ai-materials', 'templates');
const coachOut = path.join(root, 'dist', 'audience', 'ai-materials', 'coach');
const read = p => fs.readFileSync(p, 'utf8');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const spec = await coachSpec(sourceDir);
const packs = await promptPacks(sourceDir);

assert.ok(fs.existsSync(outDir), 'generated templates directory exists');
const catalog = JSON.parse(read(path.join(outDir, 'catalog.json')));
assert.ok(Array.isArray(catalog) && catalog.length > 0, 'catalog is non-empty');
assert.equal(catalog[0].id, 'plan-coach-compatible');
assert.equal(catalog[0].kind, 'instruction');
for (const item of catalog) {
  assert.ok(item.filename, 'catalog item has filename');
  assert.ok(fs.existsSync(path.join(outDir, item.filename)), `catalog ref exists: ${item.filename}`);
}
assert.ok(catalog.some(x => x.id === 'skill-start'));
assert.ok(catalog.some(x => x.id === 'car-planning'));

const generated = fs.readdirSync(outDir).filter(x => x.endsWith('.md'));
const all = generated.map(x => read(path.join(outDir, x))).join('\n');
assert.doesNotMatch(all, /校园寻宝|预约|第一层\.docx|最终版.*docx|OneDrive|\/Users\//);
assert.doesNotMatch(all, /^\|.*\|$/m, 'generated Markdown contains no tables');
const six = ['执行者','上下文与项目设计','目标','约束','避免','验收'];
const compatible = read(path.join(outDir, 'plan-coach-compatible.md'));
const positions = six.map(h => compatible.indexOf(`### ${h}`));
assert.ok(positions.every(p => p >= 0) && positions.every((p,i) => i === 0 || p > positions[i-1]), 'six headings ordered');
assert.match(compatible, /只生成②|停止在方案|不开发|不部署/);
assert.match(compatible, /人.*确认|确认.*主棍/);
assert.match(compatible, /不要求学生填写、逐根批准或逐行检查/);
for(const term of ['主棍：人写、人验收','子棍：AI 写、人验收','执行棍：AI 写、AI 验收对齐子棍','只输出当前阶段允许的内容','不留“同上”'])assert(compatible.includes(term));
assert.equal(compatible.match(/技能版本：([^\n]+)/)?.[1], spec.version);
assert.equal(compatible.match(/内容标识：([^\n]+)/)?.[1], spec.digest);
assert.equal(compatible, packs['plan-coach-compatible.md'].text);

const manifestPath = path.join(coachOut, 'CONTENT-MANIFEST.json');
assert.ok(fs.existsSync(manifestPath), 'CONTENT-MANIFEST exists');
const manifest = JSON.parse(read(manifestPath));
assert.equal(manifest.version, spec.version);
assert.equal(manifest.digest, spec.digest);
assert.deepEqual(manifest.files, spec.files);
const zipPath = path.join(coachOut, 'ligun-game-coach-plan-only.zip');
assert.ok(fs.existsSync(zipPath), 'coach zip exists');
const entries = execFileSync('unzip', ['-Z1', zipPath], {encoding:'utf8'}).trim().split('\n');
assert.equal(entries.length, 7, 'zip has six files plus CONTENT-MANIFEST');
assert.ok(entries.includes('ligun-game-coach/CONTENT-MANIFEST.json'));
for (const f of manifest.files) {
  const entry = `ligun-game-coach/${f.path}`;
  assert.ok(entries.includes(entry), `zip entry ${entry}`);
  const data = execFileSync('unzip', ['-p', zipPath, entry]);
  assert.equal(sha(data), f.sha256, `${f.path} hash`);
}
console.log('PASS verify-ai-templates');
