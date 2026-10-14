# 学生作品展 · 2026 年 9 月第一期

公开入口 `/showcase/2026-09/`，主页“学生作品”导航可达。

- 蔡玮恩：`/showcase/2026-09/cwe/`，游戏 `/play/`，路演 `/slides/`。
- 唐梓轩：`/showcase/2026-09/tzx/`，游戏 `/play/`，路演 `/slides/`。
- 不新增子域名、DNS、账户或上传后台。已有 `/u/{studentId}/` 不变；未获得账户映射，不修改学生资料。
- 公开分享无需登录。默认 noindex，公开分享不等于要求搜索引擎索引未成年人署名。

## 维护源与发布边界

可信外层及精选运行文件：`deploy/minisv/site/showcase/`。
`student-showcase-import.json` 记录原包哈希、选定公开文件的哈希及必要兼容改动，不对公网提供。
`import-student-showcase.py` 只用于受控重新导入；正常构建直接使用仓库中的精选文件，不依赖个人 OneDrive 路径。

原包保持不动；公开蔡同学路演的“蔡玮思”改为“蔡玮恩”。唐同学路演位于蔡同学交付包中，但稿内明确署名唐梓轩。
不发布原 ZIP、开发文档、手写策划、Word/PDF、个人工具记录、未经确认的其他学生作品。没有新增原始代码/整包下载按钮。浏览器运行所必需的 JS 作为公开静态资源提供。

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

## 2026-10-14 增补

- 章睿棋：`/showcase/2026-09/zrq/`；试玩《末日生存》，沿用原《末日战争》HTML 路演及其图片。
- 段柯屹：`/showcase/2026-09/dky/`；只发布最新版 **v0.22.0**（源文件为不带版本号的 `回声断层_游戏原型.html`，不是 v0.21.0 备份）。该 HTML 内嵌运行资源，不上传 600 多 MB 开发资料。游戏以电脑键鼠操作为主，手机推荐观看路演。
- 段路演来自已有包内署名段柯屹的《回声断层_我的第一份商业计划书.pptx》，保留原稿内容，导出为 10 页图片放进带翻页按钮的网页查看器。原 PPTX 不公开下载，不发布开发日志、手写材料或历史游戏版本。
- 原包中段目录曾有章的重复 ZIP，核对 SHA 相同后排除；段实际使用用户随后指定的《段-回声断层_开发文件_2026-10-13.zip》。
- 本地按用户授权删除 13 个带旧版本号的游戏原型 HTML，保留 v0.22.0 与其素材；发布操作不删除原稿、开发资料或归档包。
- 新增存档白名单：`zrq → doomsday_endless_v1`，`dky → echofault.save.v1`。删除存档消息同样校验 iframe 来源及专属键。章的清档确认使用沙盒内弹窗；精灵图请求启用匿名 CORS，避免沙盒下画布读取失败退化为占位小人。
- 增量 staging 先核对上一发布完整 showcase 字节哈希（维护 manifest 的 `updateBaseline`），不接受未知线上修改；仅更新作品树和发布元数据，首页及原有导航无需重写。蔡、唐原作品运行字节保持不变。

本轮上线后整组回滚目标：`20261012-student-showcase`。实际发布状态与包摘要见 `docs/STUDENT_SHOWCASE_OCT14_RELEASE_RECEIPT.json`，未经记录不得视为已上线。
