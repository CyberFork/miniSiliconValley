# 品牌资产盘点与路由基线

## 结论

`cowork/mini-silicon-valley-design` 当前没有可发布 Logo。仓库内唯一受控品牌资产是 `public/favicon.svg`，因此它是所有 Mini Silicon Valley 自有界面的官方共享 fallback。不得把未审计的外部 Logo、截图或临时图标加入发布包。

## 资产与边界

- 受控源：`public/favicon.svg`；发布时复制为站点根 `/favicon.svg`。
- 自有页面可使用统一品牌（主站、控制台、编辑器、Alpha、Classroom、QA、404、loading、manifest、OG）。
- `/course/` 是同事原样交付：必须字节不变，不注入品牌、不改 HTML/CSS/资源引用。
- `/framework/` 是本项目自有方法页面，可使用共享 favicon 与统一品牌样式。
- 密钥、令牌、生产 cookie、内部路径和认证材料不得写入文档、HTML、manifest、OG 或日志。

## 路由矩阵

| 路由/产物 | 品牌策略 | 例外 |
|---|---|---|
| `/` 主站 | 使用 `/favicon.svg` 与统一品牌 | 无 Logo 时不得留空白临时占位 |
| `/control/`、`/control/editor/` | 使用共享 favicon/品牌 | 写入口仅限 `/control/editor/` |
| `/alpha/`、`/classroom/` | 使用共享 favicon/品牌 | 内容快照仍受课程发布链约束 |
| `/qa/`、`/404`、loading、manifest、OG | 使用共享 favicon/品牌 | OG 不得泄露内部元数据 |
| `/framework/` | 可统一品牌 | 属于本项目自有页面 |
| `/course/` | 原样交付 | 字节级不变，禁止注入品牌 |

## 验收

```sh
shasum -a 256 public/favicon.svg
python3 -m unittest discover -s deploy/minisv/tests -p 'test_*.py'
npm run typecheck
npm run lint
npm run build
MSV_APP_URL=http://127.0.0.1:4178/ python3 tools/live-run/tests/verify_brand_browser.py
```

发布前逐路由检查 favicon、标题、OG 与 `/course/` 字节哈希；发现 `/course/` 变化即阻断发布。以上是验收命令，不代表本文件已执行或已部署。
