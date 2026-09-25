---
type: todo
id: T-105
title: "收口Studio验收数据可见范围与课程账号准入"
status: completed
created: 2026-09-10
captured_by: project-inbox
priority: P1
priority_basis: audit-recommendation
parent: T-097
depends_on: [T-098]
related: [T-085, T-087, T-096]
---

# 收口 Studio 验收数据可见范围与课程账号准入

## 本轮证据等级

只读源码发现，**没有登录线上尝试越权、注册账号或读取真实学生数据**。匿名路由已验证受保护；不要把以下项说成已发生数据泄漏。

## 1. Studio全局数据范围

- api/studio/bootstrap/route.ts:18–36只要求mentor/admin，然后调用全局listStudioCourseVersions、listUiAcceptanceReceipts、listAcceptanceClassrooms。
- course-acceptance.ts:486–507列出全部test/production课堂，无actor/membership过滤；UI回执映射:544–560包含mentor/learner profileId、membership、Admin DM信息。
- 架构要求课堂按Membership/DM隔离，平台admin不自动穿透所有课堂；公开给所有Studio导师的生产课堂元数据范围没有明确例外策略。

建议：
- 将课程作者可见的课程内容/脱敏验收摘要与具体团队、成员和生产课堂详情拆开。
- 列表/查询在服务端按权限范围过滤，不只隐藏前端入口。
- 需要跨课程审核的负责人使用显式能力，不把任意mentor等同全局教务管理员。
- Bootstrap返回索引与摘要，按需加载exact正文/回执详情并分页，兼顾数据最小化和历史版本增长。

## 2. 账号准入（产品策略待确认）

- 当前auth/register页面及POST /api/auth/register仍存在，registerUser无需邀请参数；旧全站支持开放注册。
- 注册页已说明“独立体验账号”和“正式课堂由Admin DM预创建”两种用途；因此本项不是认定自注册能够绕过正式课堂Membership，而是澄清体验账号能否阅读全部Released课件。
- 当前/course允许任意真实learner只读Released，符合“学生也可看课件”的已确认需求。
- 但如果预配账号意味着“仅团队发放账号可进入课程库”，开放自注册会使“登录”不再等同“已分发/已获准”。

需向负责人确认：课程库是所有自注册用户可读，还是仅已批准学员/导师可读。建议正式课堂默认由DM预配，公开注册若保留则初始为待审批身份。**不能擅自取消现有账号、锁人或开放更多权限。**

## 3. 部署边界一致性

- 公网Nginx已将/api/classroom/置410，本轮GET确认，不重复报告为公网双状态机。
- 较新源代码仍保留旧创建/写API；本地直达Worker或其他部署方式未必经过该Nginx。
- 建议服务端也对已退休入口失败关闭，或明确仅迁移工具可用；保留历史数据读取不等于保留第二个写入口。
- 保持Primary/Delegated Admin DM边界，不改为导师可无限递归授权。

## 验收

- [x] mentor A不能从bootstrap/回执查询读取无权限课堂B的成员详情；授权教务能按权限看到必要摘要。
- [x] 非本课堂Admin DM不能靠平台角色读取课堂私密信息。
- [x] 公开注册的最终政策写入文档、UI、API和测试，learner正式课件访问需求仍满足。
- [x] Candidate预览、Released学员阅读、Test身份模拟分别校验，不通过放开/course绕过。
- [x] 旧API在正式网关和应用入口都符合退休策略；新旧状态机不并行写同一课堂。
- [x] 做跨租户/跨团队回归使用本地合成账号，不主动访问真实生产学员数据。

## 完成记录（2026-09-11）

- Studio bootstrap 的 Test／Production 课堂与 UI 回执索引已在服务端按 active Membership／Admin DM grant 过滤；平台管理员只接收不含成员 ID、seed、checks、client matrix 和 audit 的必要摘要。
- 开放注册政策固定为 `open-learner-v1`：只创建 active learner，可读 Released 课件，不自动加入 Classroom，不获得 Studio、Candidate 或 Test 身份模拟权限。
- Classroom Factory 增加完整用户名／昵称的 exact 查找；不提供全局模糊目录，查到账号后仍需明确分配 Membership。
- 旧 `/api/classroom/*` 七个既有入口在应用层永久返回 410，POST 会先安全排空请求体；现行写入只允许 `/api/platform/classrooms`。
- 定向 145 项课程平台测试、241 项全量源码测试、minisv 编译、自托管账号／准入 smoke、旧 API E2E、课程平台 E2E、P／D 导师 E2E 全部通过。测试均使用临时 D1 与合成账号；没有访问生产学员数据，也没有代签人工验收。
