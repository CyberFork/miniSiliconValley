# T-100 实施说明：课件预览、发布历史与多文件资源包

## 1. 数据模型与版本语义

课件版本由 `packageId + revision + digest` 精确标识。每次保存单文件 HTML 或完成资源包上传都会产生不可变版本；版本内容、digest 不能更新或删除。`courseware_release_pointers` 是一个 package 的“当前默认发布版本”指针，`courseware_releases` 是追加式发布历史，二者不是同一概念：发布新版本只移动 pointer，不会使旧的已发布 revision 失效。列表中 `current` 表示命中 pointer，`historical` 表示曾写入发布历史但已不是 pointer。

不带 revision 的 `/course/[slug]` 读取当前 pointer；带 revision 时按 revision 加 digest（若提供）读取 exact 版本。课堂绑定保存 exact 三元组，因此升级默认版本不会改写已经绑定的课堂。数据库迁移还以外键、exact 校验触发器和 immutable 触发器约束版本、发布记录及课堂绑定；当前没有物理删除或自动回收已发布版本的实现。

## 2. 预览与访问权限

| 场景 | 入口与权限 |
| --- | --- |
| Candidate（未发布） | 仅已登录的课件作者（导师或管理员）通过 `/studio/courseware/[packageId]/?revision=...&digest=...` exact 预览；普通学员、匿名访问不得读取。 |
| 当前 Released | 生产 `/course/[slug]/?revision=...&digest=...` 可读；课程目录默认链接指向当前 pointer。 |
| 历史 Released | 仍可用 exact revision + digest 从生产课程入口读取；适用于已绑定旧版本的课堂。 |
| 普通学员/匿名读取 Candidate | 不允许；生产目录可见性要求版本已发布且 availability 为 `playable`。 |

Studio 列表为可播放课件提供“最新 revision 的内部 exact 预览”，版本历史中 Candidate 链接仍走 Studio，已发布版本链接走生产 exact 页面。作者鉴权由 `requireCoursewareAuthor` 执行（平台 admin 或 mentor）。

内置 system profile 的 inline field kit 是占位课件，`availability` 为 `placeholder`，不会伪装成正式课程；Studio 对这类条目显示“尚无真实课件”，不生成失效预览链接。内置 static bundle 和作者上传的真实内容为 `playable`。当前占位 O 仍是工具包语义，不代表已提供真实 PPT；真实 O 课件的导入/发布仍需作者完成。

## 3. 目录资源包协议

资源包不是 zip/tar 上传，而是客户端先提交文件清单，再逐文件、逐分块上传原始字节，最后 finalize：

1. `POST /api/studio/courseware/bundles` 创建 upload，声明 slug、标题、导师角色、入口 HTML、文件数及每个文件的路径、长度、SHA-256 和 MIME。
2. `POST /api/studio/courseware/bundles/[uploadId]/chunks` 上传 Base64 分块；服务端校验分块序号、长度及 SHA-256，支持重复分块幂等。
3. `POST /api/studio/courseware/bundles/[uploadId]/finalize` 重新拼接并校验每个文件，生成 manifest、tree digest 和不可变 revision。

服务端限制：最多 256 个文件、总计 48 MiB、单文件 8 MiB；分块 180 KiB。路径必须是 1—240 字符的相对 POSIX 路径，不得有绝对路径、反斜杠、空段、`.`、`..` 或隐藏目录/文件；禁止压缩包、可执行文件、动态库、证书/私钥、环境配置等扩展名，并按扩展名 allow-list 校验 MIME。入口必须是清单中的 HTML 文件。协议不接受服务器端解压，因此不引入符号链接或压缩炸弹解压路径；仍由服务端执行容量、路径、类型和字节摘要校验。

资源包上传仅限导师/管理员，且普通导师只能操作自己拥有的上传。上传 24 小时过期。已完成上传的文件和分块由数据库触发器保护不可变。重复 tree digest 会复用既有版本结果。代码构建的既有 static bundle 不能被网页上传覆盖；inline HTML 与多文件 bundle 也不能互相改换 content kind，需新建合适的 package。

## 4. 部署与资源访问

生产页面位于 `/course/[slug]`，作者内部 exact 预览位于 `/studio/courseware/[packageId]`。Studio 管理 API 为 `/api/studio/courseware`、`/api/studio/courseware/release` 及上述 bundles 三个端点。`/api/auth/courseware-access` 提供受保护的课件访问凭证/信息；静态 bundle 文件由 `/courseware-assets/[packageId]/[revision]/[digest]/[...path]` 按 exact 身份提供。部署必须同时应用 `drizzle/0009_courseware_release_history_and_bundles.sql`，并保留既有静态包的固定来源与 URL；新版本不得覆盖旧版本资源。

## 5. 保留、回收与已知 TODO

已实现的是 append-only 发布历史、exact 引用约束、旧版本继续可读，以及上传中间态的过期时间。数据库没有删除已发布版本、bundle 文件或课堂仍引用资源的回收任务；也没有把“归档/撤销”实现为自动回收。因此部署升级和发布新版本不能清理旧资源，未来若增加回收必须先检查 `courseware_releases` 与 `room_courseware_bindings` 的 exact 引用，并采用显式策略。

## 6. 验证命令

```bash
npm run typecheck
npm run lint
npm run test:course-platform
npm run build:minisv-app
git diff --check
```

`test:course-platform` 已包含 `tests/courseware-versioning.test.ts`，覆盖发布历史、默认指针、资源包原始字节往返、上传幂等、安全拒绝及迁移 fail-closed 约束。运行环境若缺少依赖，应记录为环境问题，而不能宣称通过。
