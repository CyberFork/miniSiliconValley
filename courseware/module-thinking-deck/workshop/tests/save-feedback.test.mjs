import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  emptyProject,
  parseProject,
  placeInstance,
  recipe,
  saveDefinition,
} from '../model.mjs';

const wheel = (overrides = {}) => ({
  id: 'wheel-main',
  name: '探索轮',
  responsibility: '负责移动与承载',
  behavior: 'wheel',
  blocks: recipe('wheel'),
  ...overrides,
});

test('保存合法五块橡胶十字，且不改变工作台方块', () => {
  const project = emptyProject('save-test');
  project.blocks = recipe('wheel');
  const before = structuredClone(project.blocks);
  const saved = saveDefinition(project, wheel());

  assert.deepEqual(project.blocks, before);
  assert.deepEqual(saved.blocks, before);
  assert.equal(saved.definitions.length, 1);
  assert.deepEqual(saved.definitions[0].blocks, [
    { x: 1, y: 1, z: 0, material: 'rubber' },
    { x: 2, y: 1, z: 0, material: 'rubber' },
    { x: 0, y: 1, z: 0, material: 'rubber' },
    { x: 1, y: 2, z: 0, material: 'rubber' },
    { x: 1, y: 0, z: 0, material: 'rubber' },
  ]);
});

test('空选择和不合法配方失败，并保留原作品不变', () => {
  const project = emptyProject('save-test');
  project.blocks = recipe('wheel');
  const before = structuredClone(project);
  for (const input of [wheel({ blocks: [] }), wheel({ blocks: recipe('wheel').slice(0, 4) })]) {
    assert.throws(() => saveDefinition(project, input));
    assert.deepEqual(project, before);
  }
});

test('三种平面、含偏移的标准五格橡胶十字均可保存并保留方向', () => {
  const planes = [
    // XY plane (the original recipe), translated away from the origin.
    [[3, 2, 1], [4, 2, 1], [2, 2, 1], [3, 3, 1], [3, 1, 1]],
    // YZ plane: X is constant.
    [[2, 2, 3], [2, 3, 3], [2, 1, 3], [2, 2, 4], [2, 2, 2]],
    // XZ plane: Y is constant.
    [[2, 3, 2], [3, 3, 2], [1, 3, 2], [2, 3, 3], [2, 3, 1]],
  ];
  for (const coords of planes) {
    const blocks = coords.map(([x, y, z]) => ({ x, y, z, material: 'rubber' }));
    const saved = saveDefinition(emptyProject('save-test'), wheel({ blocks }));
    const min = ['x', 'y', 'z'].map((axis) => Math.min(...blocks.map((block) => block[axis])));
    assert.deepEqual(saved.definitions[0].blocks, blocks.map((block) => ({
      ...block,
      x: block.x - min[0], y: block.y - min[1], z: block.z - min[2],
    })));
  }
});

test('L形、折叠三维形状和五块不同 z 的伪十字均被拒绝', () => {
  const invalid = [
    [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [2, 0, 0]], // L / malformed cross
    [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]], // folded in 3D
    [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 1], [0, -1, 0]], // five blocks, varying z
  ];
  for (const coords of invalid) {
    const blocks = coords.map(([x, y, z]) => ({ x, y, z, material: 'rubber' }));
    assert.throws(() => saveDefinition(emptyProject('save-test'), wheel({ blocks })));
  }
});

test('中文名称与职责可保存，刷新 JSON 后定义可恢复', () => {
  const project = emptyProject('save-test');
  const saved = saveDefinition(project, wheel({
    name: '星际探险轮',
    responsibility: '支撑团队探索未知星球',
  }));
  const refreshed = parseProject(JSON.stringify(saved), 'save-test');
  assert.deepEqual(refreshed.definitions, saved.definitions);
  assert.equal(refreshed.definitions[0].name, '星际探险轮');
  assert.equal(refreshed.definitions[0].responsibility, '支撑团队探索未知星球');
});

test('同一定义可复用并装到两个轮接口', () => {
  let project = saveDefinition(emptyProject('save-test'), wheel());
  project = placeInstance(project, {
    id: 'front-left', definitionId: 'wheel-main', socket: 'wheel-fl', rotation: 0,
  });
  project = placeInstance(project, {
    id: 'front-right', definitionId: 'wheel-main', socket: 'wheel-fr', rotation: 180,
  });
  assert.deepEqual(project.instances.map(({ definitionId, socket }) => ({ definitionId, socket })), [
    { definitionId: 'wheel-main', socket: 'wheel-fl' },
    { definitionId: 'wheel-main', socket: 'wheel-fr' },
  ]);
  assert.equal(project.definitions.length, 1);
});

test('保存表单 UI 契约包含反馈区域、描述关联和 novalidate', async () => {
  for (const file of ['teacher/presenter.html', 'audience/index.html']) {
    const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(html, /id=["']module-feedback["']/);
    assert.match(html, /aria-describedby=["'][^"']*module-feedback[^"']*["']/);
    assert.match(html, /<form\b[^>]*novalidate(?:\s|=|>)/i);
  }
});
