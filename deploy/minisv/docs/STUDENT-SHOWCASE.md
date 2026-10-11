# 学生作品展 · 2026 年 9 月第一期

公开入口 `/showcase/2026-09/`，主页“学生作品”导航可达。

- 蔡玮恩：`/showcase/2026-09/cwe/`，游戏 `/play/`，路演 `/slides/`。
- 唐梓轩：`/showcase/2026-09/tzx/`，游戏 `/play/`，路演 `/slides/`。
- 不新增子域名、DNS、账户或上传后台。已有 `/u/{studentId}/` 不变；未获得账户映射，不修改学生资料。
- 公开分享无需登录。默认 noindex，公开分享不等于要求搜索引擎索引未成年人署名。

## 维护源与发布边界

可信外层及精选运行文件：`deploy/minisv/site/showcase/`。
`student-showcase-import.json` 记录原包哈希、100 个选定公开文件的哈希及必要兼容改动，不对公网提供。
`import-student-showcase.py` 只用于受控重新导入；正常构建直接使用仓库中的精选文件，不依赖个人 OneDrive 路径。

原包保持不动；公开蔡同学路演的“蔡玮思”改为“蔡玮恩”。唐同学路演位于蔡同学交付包中，但稿内明确署名唐梓轩。
不发布原 ZIP、开发文档、手写策划、Word/PDF、个人工具记录、其他学生的作品。没有新增原始代码/整包下载按钮。浏览器运行所必需的 JS 作为公开静态资源提供。

## 同域隔离

学生脚本使用 opaque-origin iframe：`allow-scripts allow-pointer-lock`，**没有 allow-same-origin**。
运行页面同时收到 HTTP CSP sandbox，因此直接打开 runtime URL 也无法读取官网 cookie、DOM 或 localStorage。禁止 connect、表单提交、嵌套 frame、顶层跳转；只允许本站作品静态资源，Three.js 自带本地库，无 CDN fallback。
CORS `*` 仅适用公开 runtime 图片/文件，满足 Three.js TextureLoader 的匿名图片读取；不能扩展到 API/账户/课件。教师课件权限保持不变。

可信 `host.js` 仅从指定 iframe 的 null origin 接受存档；严格限制学生专属键名、值类型及 200KB 长度，写入 `minisv.showcase.2026-09.{student}.` 命名空间，不读取或返回其他官网数据。
初始化通过校验消息来源的 ready/seed 握手传入该游戏自己的存档，先完成种子握手再按原顺序装入学生脚本，防止默认存档覆盖已有进度。所有重新加载都重新握手；独立打开 runtime 不提供持久存档，正式分享必须使用 `/play/`。

## 兼容说明

- 蔡：模拟队友不是互联网联机；导出/导入为手动存档同步，非云账户。修复原昵称按钮变量作用域；用页内对话框代替 sandbox 不可用的原生 prompt/confirm。
- 唐：公开试玩不请求麦克风。朗读使用明确标示的自读确认，不假称自动语音评分；拼写挑战保留。语音评分服务不在本次部署范围。
- 存档仅保存在当前浏览器；清理浏览数据会移除存档。
- 原学生原型的全部玩法平衡、通关和各浏览器/实体设备行为不由发布测试代签。

## 部署与回滚

沿用 `package_bundle.py` → `deploy-hecate.sh`。`stage-student-showcase.py` 只作用于当前 site 副本，新增 showcase，局部增加首页和公共导航链接，更新 release 元数据。旧课件、提示词、应用产物、数据库与账号均保留。

首次上线前运行 `python3 -m unittest discover -s deploy/minisv/tests -p 'test_*.py'`；浏览器验证桌面/触屏尺寸、两款游戏启动、PPT 翻页、存档重载和隔离。上线后匿名检查运行资源哈希和 public-smoke。

回滚到本轮前整组：
`zsh ~/Services/minisv/current/ops/scripts/rollback-hecate.sh 20260929-modular-prompts`

这会撤回作品展路由及导航，不删除学生原始文件或浏览器本地存档。
