# 公开立棍提示词中心

唯一页面：`https://minisv.vip/prompts/`，无需课程账号。

## 组合方式

- `modules/base.txt`：通用立棍底座，主棍六项、模块地图、子棍六项、人工确认、进度与完整文档交付，始终必选。
- `modules/game.txt`：游戏领域补充，默认开启。保留原学生受众、策划与 UI 承接、设备／打开方式／画面／操作／多人／存档及游戏交接要求。
- `modules/paths.txt`：路径对齐增强，默认关闭。先对齐主要路径，归纳模块，再沿路径检查职责、接口与 UI／服务反馈；不新增进度层级或技术审批。
- `modules/start.txt`：共用启动句，只在已选内容之后启动一次对话。
- `composer/compose.js`：Node 构建与浏览器共用同一纯组合函数，固定顺序为底座→领域→增强→启动。最终标题和阶段用语由游戏开关参数化，不拼入两个竞争的标题。
- `composer/index.html`、`workbook.js`、`workbook.css`：统一选择、输入与复制页面。取消游戏即通用项目，不新增表单、账户、站内 AI 或上传。

预设地址：`/prompts/` 默认游戏；`/prompts/?game=0` 通用；`?paths=1` 启用路径增强。旧 `/prompts/general/` 与其 `index.html` 跳转到统一页面的通用预设。切换不清空输入；URL 只包含选项，不包含项目文字。

本页只拼接提示词，不声称已生成项目方案。外部 AI 才负责问答和文档；文档完成后停止，实际实施另行授权。输入仅在浏览器内存处理，不上传、不保存，刷新前需复制。

## 维护与兼容

`node prompts/build.mjs OUTPUT_DIRECTORY` 独立生成公开中心、通用兼容资源与 SHA-256 manifest。manifest 包含模块摘要和四种组合摘要；`student-prompt.txt` 是该入口的默认组合，不含用户输入。

`game-development/` 与 `general-project/` 保留上一版文本和页面作为迁移对照。它们**不再是公开中心维护源**，不要在这些目录修改新功能。`buildStudentWorkbook` 仍使用冻结的游戏旧源，保证历史 r29 课件构建字节不变；普通公开中心使用 `buildPromptCenter`。课件旧 workbook 页面及稳定入口继续转向公开中心。

通用底座除标题参数外，原文字完整保留，由 `verify-general.mjs` 验证。游戏领域保留检查见 `MODULAR_PARITY.md`。文本重构与静态测试不能保证不同 AI 的实际回答完全一致，真实问答仍由用户验证。

## 验证

- `node prompts/tests/verify.mjs`：统一页面默认值、四种复制、输入保留、降级和缺失数据。
- `node prompts/tests/verify-general.mjs`：通用底座迁移无遗漏。
- `node prompts/tests/verify-modular.mjs`：四种组合、条件纳入、规范断言与生成哈希。
- 现有课件 `verify-student-prompt.mjs`、`verify-workbook.mjs` 保持通过。

发布沿用既有统一打包／部署／回滚；无需增加课件 revision，不修改历史课件或保存文字，不放开教师资料。这里只公开提示词使用入口，不改变 GitHub 仓库可见性和许可证。
