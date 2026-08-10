# 测试与验收（TESTING）

## 一键生产闸

```bash
npm ci
npm test
```

`npm test` 顺序执行：

1. `npm run typecheck`：TypeScript strict 类型检查。
2. `npm run lint`：ESLint，`--max-warnings=0`。
3. `npm run build`：Vinext/Vite 生产构建。
4. 核心质量闸执行 19 项确定性测试。

Work 子路径部署质量闸：

```bash
npm run test:work
```

它在完整核心检查之外生成 `/msv/` 静态构建，并执行 2 项部署契约测试，总计 21 项。

可分开执行：

```bash
npm run validate:data
npm run test:unit
npm run test:render
```

## 自动测试矩阵

### `tests/data-validate.test.ts`

- 8/34/74/51/75/66/203/8 数据计数与最低门槛。
- Catalog 与 Mission 零错误、零警告。
- 每个事件有来源，每个来源为 HTTPS。
- 8 个 Mission 与 8 个历史事件严格双向对应。

### `tests/state.test.ts`

- 玩家操作不修改 Original Timeline 或关卡定义。
- 重玩同关替换而非累加结果，无法刷资源。
- 资源被截断到 0–9。
- 导出/导入往返一致。
- 拒绝未知 Schema 与根节点/嵌套危险键。
- 非法领域回退，文本、历史节点、证据和结果数组去重/限长。

### `tests/render.test.ts`

- 从 `dist/server/index.js` 真实服务端渲染首页，检查标题、世界地图和无 Starter 占位内容。
- 4 个 WebP 资源存在且画布尺寸一致，保证跨时代交叉切换不跳位。
- 核心源码无 TODO、旧 Starter 或已拒绝的模板化假历史短语。

### `tests/interaction-contract.test.ts`

- 年份始终限制在 1891—2026；地图缩放始终限制在 1—2.4。
- 四代地图在任意年份只混合相邻图层，透明度总和恒为 1。
- 自动检查桌面/平板/手机断点、弹窗视口约束、减少动态与打印样式。
- 自动锁定时间轴、键盘、搜索、拖动、双指缩放、滚轮、档案和关卡返回契约。
- 自动锁定 Modal 焦点/关闭语义和六阶段学习闭环，防止关键交互在重构时静默消失。

### `tests/work-static.test.ts`

- `dist/work/msv/demo.html`、客户端 chunks、favicon 与 4 幅地图必须完整存在。
- HTML 的脚本、样式、图片和图标只能引用 `/msv/` 子路径，Canonical 必须指向 Work 演示地址。
- `demo-manifest.json` 中每个文件的字节数和 SHA-256 必须与产物一致。

## 响应式与无障碍验收

代码级闸检查：

- `390px / 520px / 720px / 900px / 1180px` 布局断点。
- 弹窗宽度不超过 `calc(100vw - 32px)`，所有 Grid 子项 `min-width: 0`，避免窄屏横溢出。
- Modal 的 Escape、背景关闭、焦点陷阱、关闭后焦点恢复。
- 年份键盘操作、地图触摸拖动/双指缩放、按钮可访问名称。
- `prefers-reduced-motion` 及打印样式。

Sites 构建规范不要求用浏览器截图作为发布前置；因此默认质量闸不依赖图形环境或网络，保持 CI 可重复。

## 当前基线（2026-08-10）

```text
TypeScript    PASS
ESLint        PASS (0 warnings)
Build         PASS
Core tests    19 / 19 PASS
Work tests    21 / 21 PASS
Data report   0 errors / 0 warnings
```
