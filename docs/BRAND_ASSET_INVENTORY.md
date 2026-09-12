# 品牌资产盘点与路由基线

## 结论

`cowork/mini-silicon-valley-design` 当前没有可发布 Logo。仓库内唯一受控品牌资产是 `public/favicon.svg`，因此它是所有 Mini Silicon Valley 自有界面的官方共享 fallback。不得把未审计的外部 Logo、截图或临时图标加入发布包。

## 资产与边界

- 受控源：`public/favicon.svg`；发布时复制为站点根 `/favicon.svg`。
- 自有页面可使用统一品牌（主站、Studio、编辑器、Classroom、课件目录与播放外壳、家长问答、404、loading、manifest、OG）。
- `/course/` 是平台自有的受保护课件目录；`/courseware/*` 下的 P／D／M 已发布课件 bundle 才是原样交付的不可变字节，不注入品牌、不改 HTML/CSS/资源引用。
- `/framework/` 是本项目自有方法页面，可使用共享 favicon 与统一品牌样式。
- 密钥、令牌、生产 cookie、内部路径和认证材料不得写入文档、HTML、manifest、OG 或日志。

## 路由矩阵

- 公开站点：`/`、`/world/`、`/framework/`、`/parents/`、404 均使用 `/favicon.svg`。`/framework/` 的独立水合页在 `load` 之后由共享 runtime 把旧的“回到顶部”标记修复为根主页 Logo，不在水合前改写 React DOM。
- 账号与内部工作台：`/auth/*`、`/account/`、`/studio/*` 使用共享 `BrandHomeLink`；课程编辑器保留未保存离开确认。
- 课堂：`/classroom/`、真实课堂席位、主控、成员、共享投屏及加载／错误态均使用共享根主页 Logo。移动窄屏仅收起字标，不隐藏图形入口。
- 课件服务：`/course/` 目录、课件播放外壳与课堂课件占位态使用共享 Logo。其内嵌的 P／D／M 已发布课件 bundle 仍是不可变字节，不注入全站品牌代码。
- 退役入口：`/alpha/`、`/control/`、`/control/editor/` 现为 410，不伪装成可用品牌页；对应功能已归入 `/studio/` 和 `/classroom/`。

## 验收

```sh
shasum -a 256 public/favicon.svg
python3 -m unittest discover -s deploy/minisv/tests -p 'test_*.py'
npm run typecheck
npm run lint
npm run build
MSV_APP_URL=http://127.0.0.1:4178/ python3 tools/live-run/tests/verify_brand_browser.py
```

发布前逐路由检查 favicon、标题、OG 与不可变课件 bundle 字节哈希；发现课件 bundle 变化即阻断发布。还必须在真实浏览器中通过普通点击和 Enter 验证“当前标签页回到 `/`”，仅检查 `href` 不算完成。以上是验收命令，不代表本文件已执行或已部署。
