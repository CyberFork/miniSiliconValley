import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { buildPromptCenter } from '../build.mjs';

const root = join(new URL('..', import.meta.url).pathname);
const text = async name => readFile(join(root, 'modules', `${name}.txt`), 'utf8');
const modules = { base: await text('base'), game: await text('game'), paths: await text('paths'), start: await text('start') };
const composerSource = await readFile(join(root, 'composer', 'compose.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(composerSource, context);
const compose = context.window.MSV_PROMPT_COMPOSER.compose;
const six = '执行者→上下文与项目设计→目标→约束→避免→验收';

const game = compose(modules, { game: true, paths: false });
const general = compose(modules, { game: false, paths: false });
const gamePaths = compose(modules, { game: true, paths: true });
const generalPaths = compose(modules, { game: false, paths: true });
for (const [name, value] of Object.entries({ game, general, gamePaths, generalPaths })) {
  const title = name.startsWith('game') ? '基于立棍方法的开发文档' : '基于立棍方法的项目实施文档';
  assert.equal(value.includes(modules.base.replaceAll('{{DOCUMENT_TITLE}}', title).replaceAll('{{DOCUMENT_KIND}}',name.startsWith('game')?'开发文档':'项目实施文档').trim()), true, `${name}: base`);
  assert.equal(value.includes(modules.start.trim()), true, `${name}: start`);
  assert.equal(value.includes(six), true, `${name}: six items`);
  assert.equal(value.includes('主棍：已明确 n/6 项'), true, `${name}: progress`);
  assert.equal(value.includes('不能把我的文档确认说成游戏已通过测试') || value.includes('文档确认不等于成品已经完成或通过实测'), true, `${name}: document boundary`);
}
assert(game.includes(modules.game.trim()));
assert(!general.includes(modules.game.trim()));
assert(gamePaths.includes(modules.paths.trim()));
assert(!game.includes(modules.paths.trim()));
assert(generalPaths.includes(modules.paths.trim()));
for (const term of ['运行设备', '打开方式', '2D', '3D', '用户路径', 'UI', '背包']) assert(game.includes(term), `game semantic: ${term}`);
for (const term of ['路径到模块', '路径反向检查', '不要让我设计接口参数', '不要求我审核函数签名', '不增加第七项', '不显示子棍内部六项进度']) assert(gamePaths.includes(term), `paths semantic: ${term}`);
for(const key of ['base','start'])assert.throws(()=>compose({...modules,[key]:''}),/Missing prompt module/);
assert.equal(compose(modules),game);
assert(!general.includes('游戏领域补充'));
assert(!general.includes('Minecraft'));
assert(!game.includes('{{DOCUMENT_'));
for (const key of ['game', 'paths']) assert.throws(() => compose({ ...modules, [key]: '' }, { game: key === 'game', paths: key === 'paths' }), /Missing prompt module/);

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const output = await mkdtemp(join(tmpdir(), 'modular-prompts-'));
try {
  const manifest = await buildPromptCenter(output);
  const files = ['index.html', 'workbook.css', 'workbook.js', 'compose.js', 'student-prompt.js', 'student-prompt.txt'];
  for (const file of files) assert.equal(manifest.files[file], hash(await readFile(join(output, file))), `root hash: ${file}`);
  const generalManifest = JSON.parse(await readFile(join(output, 'general', 'manifest.json'), 'utf8'));
  for (const file of files) assert.equal(generalManifest.files[file], hash(await readFile(join(output, 'general', file))), `general hash: ${file}`);
  for (const dir of [output, join(output, 'general')]) {
    const js = await readFile(join(dir, 'student-prompt.js'), 'utf8');
    const txt = await readFile(join(dir, 'student-prompt.txt'), 'utf8');
    const generated = { window: {} };
    vm.runInNewContext(composerSource, generated);
    vm.runInNewContext(js, generated);
    assert.equal(generated.window.MSV_STUDENT_PROMPT, txt, `${dir}: JS/TXT`);
  }
  console.log('PASS modular prompt composition, module gating, semantic markers, missing-module rejection, generated hashes and JS/TXT parity');
} finally { await rm(output, { recursive: true, force: true }); }
