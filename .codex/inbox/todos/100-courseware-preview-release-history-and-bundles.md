---
type: todo
id: T-100
title: "闭合课件内部预览、历史发布与多文件资源更新"
status: done
created: 2026-09-10
captured_by: project-inbox
priority: P1
priority_basis: audit-recommendation
parent: T-097
depends_on: [T-098]
related: [T-085, T-092, T-096]
completed: 2026-09-10
---

# 闭合课件内部预览、历史发布与多文件资源更新

## 已确认问题

1. StudioApp.tsx:335–380提示“先打开exact预览”，链接却进入/course/{slug}/?revision=latest。course/[slug]/page.tsx:57–61统一使用isCoursewareLibraryVisible，只允许Released；刚保存的Candidate/内部fallback被404，作者没有对应的内部预览通道。
2. courseware-store.ts:299–336用“等于当前release pointer”计算released；isCoursewareLibraryVisible(:190)据此拒绝旧版本。发布r1后，曾发布的r0正文虽保留，旧exact播放入口却不可用。已用真实函数和内存库复现；这违反“旧课堂继续使用锁定课件”的可用性要求。
3. O默认仍为system fallback；默认绑定逻辑:339–355可选它，但正式/course gate会隐藏它。必须区分未上传占位/内部工具包/真实已发布课件，不能给导师一个必定404的“打开课件”入口。
4. Studio上传仅支持512KiB单HTML；既有P约114MB、D约8MB多文件包要靠代码构建。更新静态包目前要求新package/URL，不具备导师自主上传新版资源包的完整闭环。
5. 静态包身份硬编码在courseware-store.ts和package_release.py，旧版本资源能否跨整站发布持续保留须验证，不能只保留数据库digest。

## 实现顺序

### A. 先修阻断：内部预览与历史可读
- 独立受权限保护的Studio exact课件预览，真实作者/授权导师可看Candidate；Production目录继续只公开已发布内容，不为解决预览而放开草稿给学员。
- 分离“曾正式发布的不可变revision”与“默认最新版pointer”，保存发布历史/状态。
- /course默认指向最新Released；带exact revision的旧Released仍可读。删除、撤销和归档是显式策略，不随发布新版本隐式撤销。
- Classroom导师链接必须绑定其exact版本；Test中的Candidate使用内部预览或有范围限制的实例预览，不能绕过学员正式目录限制。
- fallback显示“未提供真实课件/内部占位”，按已确认策略给可用入口或禁用入口；不自行制作O课件填空。

### B. 再补资源作者闭环
- 设计HTML+本地assets的版本化bundle上传/导入，保持原始字节、manifest和内容树摘要。
- 路径穿越、符号链接、压缩炸弹、容量、执行脚本来源/隔离等必须由服务端校验。
- 课件任意时刻通过链接打开；不引入必须Block→Slide映射或自动翻页。
- 目录元数据展示“课件ID/rN/digest”；与课程JSON的courseDataId清晰分开。
- 旧资源版本不可被新版部署覆盖；需要显式留存/回收策略，不能删除仍被Classroom引用的资源。

## 验收

- [x] 保存未发布HTML→作者立即预览成功，普通学员/匿名不能读取。
- [x] r0发布并绑定课堂→保存/发布r1→老课堂仍能播放r0，新目录默认r1。
- [x] 新旧资源字节与各自digest均匹配，刷新/整站升级后不漂移。
- [x] P/D/M可登录播放；O缺少真实PPT时明确告知，不显示失效链接。
- [x] 静态资源匿名仍受保护，登录返回保留revision/slide/step。
- [x] 未修改已确认的P原始包，不用HTML改写或AI补内容绕过作者审核。

## 完成回执（2026-09-10）

- 新增 append-only `courseware_releases`，当前默认 pointer 与历史发布彻底分离；历史 exact revision 继续可读。
- 新增受权限保护的 Studio Candidate exact 预览与课堂绑定 exact 课件入口；Production 继续只接受真实 Released 课件。
- 新增目录式多文件资源包上传、分块校验、manifest/tree digest、不可变版本与 exact 资源服务；不接受压缩包，因此服务器无解压、符号链接或压缩炸弹路径。
- O 的 system inline kit 被显式标为 placeholder；Test 可验证结构，Production 服务端拒绝，界面不再伪造可播放链接。
- 数据库迁移、schema 生成物、Nginx 路由、Studio 管理界面、测试与实施文档同步完成。
- 自动验证：`typecheck`、`lint`、98 项 `test:course-platform`、`build:minisv-app`、`git diff --check` 通过。部署与登录后线上烟测随本批 Todo 的统一发布执行。
