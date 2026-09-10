---
type: todo
id: T-070
title: "部署远端内部测试控制台与八窗口环境"
status: completed
created: 2026-09-03
updated: 2026-09-04
completed: 2026-09-04
captured_by: project-inbox
tags:
  - todo
  - mini-silicon-valley
  - remote-testing
  - internal-console
  - deployment
---

# 部署远端内部测试控制台与八窗口环境

> **2026-09-08 架构更新：**本任务记录的是已完成的早期 Alpha 多窗口验证能力。目标架构不再保留八个弹出窗口；内部调试迁入 Course Studio 页内 Preview，真实端到端测试使用同源的 Test Classroom。统一以 T-085 和 `docs/COURSE_PLATFORM_ARCHITECTURE.md` 为准。

## 原始记录

TODO：我在思考当前的方式只是在本地测试，后续我们要进行测试，还是需要部署到远端的。然后远端的话就需要团队内部都可以打开一个控制台，然后再通过控制台打开各自的窗口（8个中的1个或者2个，无鉴权的），好进行内部测试。

## 简要整理

当前测试主要发生在本地，后续需要建立可供团队共同使用的远端内部测试环境。团队成员先进入一个统一控制台，再从控制台打开八个独立测试窗口中的一个或两个进行协同测试；测试窗口暂不设置应用内鉴权。

## 目标形态

1. 将当前本地测试能力部署为独立的远端测试环境，不与正式生产数据和入口混用。
2. 提供团队内部统一测试控制台，集中显示八个测试窗口的入口和当前状态。
3. 每位团队成员可以从八个窗口中选择并打开一个或两个窗口。
4. 测试窗口不要求注册、登录或角色鉴权，打开后即可开始内部测试。
5. 八个窗口之间需要保持明确标识，便于沟通、问题复现和测试记录归属。

## 待设计内容

- 远端测试环境的域名、路径、部署服务和发布／回滚方式。
- “无鉴权”具体适用于控制台、测试窗口还是两者；如何限定为团队内部使用，避免被公网随意发现或滥用。
- 八个窗口对应八个独立会话、八组测试数据，还是同一系统的八个观察视角。
- 一名成员占用一个或两个窗口时的选择、标记、释放和冲突处理方式。
- 各窗口的数据隔离、初始化、重置、过期清理与测试后恢复机制。
- 控制台需要展示的状态：空闲、使用中、最后操作时间、重置入口及异常状态等。
- 多人同时操作时的实时同步、日志、错误收集和复现信息。
- 远端测试环境与正式环境之间的配置、密钥、数据和网络边界。

## 原计划下一步

先盘点当前本地测试的启动方式、窗口含义、状态数据和依赖服务，明确“八个窗口”的隔离模型及无鉴权访问边界，再形成远端测试环境和控制台的最小可行架构方案。

## 验收标准

- 团队成员能通过统一地址打开内部测试控制台。
- 控制台清楚列出八个带编号的测试窗口。
- 任一成员能够打开其中一个或两个窗口并独立完成测试操作。
- 测试窗口无需应用内登录，且不会接触正式环境的账号、密钥或业务数据。
- 窗口占用、冲突、重置和异常状态可被识别和处理。
- 支持远端重新部署、服务重启和测试数据重置，并有最小回滚路径。
- 至少完成一次多人并行测试，确认八窗口之间不会发生非预期串线。

## 关键控制点

远端内部访问边界；无鉴权范围；八窗口隔离模型；一人一至两个窗口的分配方式；测试数据与正式数据隔离；状态重置；多人并行；日志与问题复现；部署与回滚。

## 来源上下文

当前对话；Mini Silicon Valley 项目远端协同测试设想。

## 完成结果

T-070 已于 2026-09-04 完整落地并完成真实环境验收：

- 团队统一入口：`https://work.cyberforker.com/msv/alpha`；Windows LAN URL `http://192.168.50.243:18766/` 保留为后端诊断地址，不是团队入口。Windows active release：`alpha-20260903T222117Z`。
- 拓扑为 Cloudflare → hecate-work Nginx → Windows `192.168.50.243:18766` → Windows loopback SSH reverse tunnel → Mac controller `127.0.0.1:18765`。Mac controller/隧道在线时控制台才显示 connected。
- `/msv/alpha` 无应用账号鉴权，固定路径全网可达；链接泄露即可访问并消耗席位。当前未配置 Cloudflare Access，不能将此入口视为身份认证。
- 八席是同一场 LIVE RUN 的服务器投影视角：W00—W03 为导师，W04—W07 为学员；八席 lease、服务端单席投影和 `/api/bootstrap`、`/api/script`、`/api/control` 404 边界保持不变。
- 控制台支持昵称、领取／释放、5 分钟回收、每浏览器最多 2 席、409 冲突和确认式全局清场；学员只能读取自己的私密卡、RP 与钱包。
- 席位 capability 位于 URL fragment 并转为请求头，不出现在 Cloudflare、Nginx 或 Node 请求 URL；Alpha 访问日志关闭，写操作单独限流。
- 发布使用不可变 release 目录、active／previous 指针、健康检查和 rollback；Windows 计划任务 `MSV-Live-Run-Console` 托管服务，Mac 隧道由 launchd 自动重连。
- 公网真实验收为 4 个并发浏览器各领 2 席，八席同时占用，4 个学员各 3 张且共 12 张私密卡无串线；Edge 桌面与 390px 视窗通过，验收后席位回到 0 占用、课程回到 B01 ready。

实现与运维文档：[`tools/live-run/remote-console/README.md`](../../../tools/live-run/remote-console/README.md)。Work Nginx 片段：[`deploy/work-alpha-http-map.conf`](../../../deploy/work-alpha-http-map.conf) 与 [`deploy/work-alpha-location.conf`](../../../deploy/work-alpha-location.conf)。

脱敏证据：

- [`REMOTE_CONSOLE_ACCEPTANCE_RECEIPT.json`](../../../tools/live-run/docs/REMOTE_CONSOLE_ACCEPTANCE_RECEIPT.json)
- [`REMOTE_CONSOLE_BROWSER_RECEIPT.json`](../../../tools/live-run/docs/REMOTE_CONSOLE_BROWSER_RECEIPT.json)
- [`REMOTE_CONSOLE_RELEASE_RECEIPT.json`](../../../tools/live-run/docs/REMOTE_CONSOLE_RELEASE_RECEIPT.json)
- [`ALPHA_DEPLOYMENT_RECEIPT.json`](../../../tools/live-run/docs/ALPHA_DEPLOYMENT_RECEIPT.json)
- [`ALPHA_REMOTE_ACCEPTANCE_RECEIPT.json`](../../../tools/live-run/docs/ALPHA_REMOTE_ACCEPTANCE_RECEIPT.json)
- [`ALPHA_BROWSER_ACCEPTANCE_RECEIPT.json`](../../../tools/live-run/docs/ALPHA_BROWSER_ACCEPTANCE_RECEIPT.json)
