# Mini Silicon Valley 生产站点地图

> 生产原点：`https://minisv.vip`
> 源站：Hecate；公网入口：Cloudflare Tunnel；`cyberforker.com` 主站不在本项目发布范围内。

## 人员入口

- `/`：唯一总导航，所有产品页都可通过左上角品牌标返回这里。
- `/world/`：互动科技史地图与历史关卡，匿名可读。
- `/course/`：同事 `CyberFork/minisv` 固定提交的课程大纲，构建产物原样挂载；主工程不得注入或重写。
- `/framework/`：本项目自有的课程方法与“一世界、两轨线、三引擎、四导师、五步骤、六分钟”说明。
- `/parents/`：家长问答页；浏览器只调用同源 `/api/qa`。
- `/classroom/`：正式协作课堂；未登录会进入登录流程，登录后按 RBAC 和课堂 membership 投影。
- `/alpha/`：4 导师＋4 学员的内部联测席位入口；只允许测试数据。
- `/control/`：LIVE RUN SCRIPT 主控；需要一方登录且具备 `mentor` 或 `admin` 权限。
- `/control/editor/`：Course Package 编辑器；保存生成不可变 Candidate，不能直接改写 Released。
- `/workshop/`：课程讨论工坊；“已确认基线”只读展示 Released 快照，提案不能直接回写课程真值。

## 账号入口

- `/login/` → `/auth/login`：用户名＋密码登录。
- `/register/` → `/auth/register`：开放注册 Young Builder。
- `/recover/` → `/auth/recover`：找回说明；导师为有权限的普通账号生成单次重置链接。
- `/auth/reset`：带 fragment token 的密码重置页面。
- `/account/`：昵称、密码、设备会话与有权限的账户协助。

`admin` 与 `mentor` 不通过公开注册获得；导师由课堂创建者或管理员指派，不使用 `TEAM-XXXXXXXX` 申请学员席位。

## 服务与安全边界

- `/api/auth/*`、`/api/classroom/*`：正式课堂 API；由一方 `HttpOnly; Secure; SameSite=Lax` 会话和服务端 RBAC 保护。
- `/api/qa`：家长问答 API，独立限频；密钥只存在 Hecate 受控环境。
- `/api/internal/*`：只供 Hecate loopback 上的 Course Registry 发布桥调用；公网固定返回 404。
- `/alpha/api/*`：能力令牌限定的测试席位 API；不接受应用 Cookie 或 Authorization 透传。
- `/control/api/*`：导师主控／制课 API；控制器自行校验第一方会话和角色。
- `/healthz`：网关健康状态。
- `/release.json`：当前原子发布身份、来源提交与产物摘要。
- `/sitemap.json`：机器可读页面清单。

## 规范化与兼容

无尾斜杠的人类页面使用 307／308 跳转到规范目录。历史实现路径 `/demo.html`、`/123456`、`/qa.html`、`/launch.html` 与 `/msv/*` 只保留到新语义路径的兼容跳转；新页面、文档和品牌入口不得继续产生这些旧 URL。

未知路径由统一品牌 404 页面处理。所有页面必须带 CSP、HSTS、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy` 与 `X-MiniSV-Origin: hecate`，且不得泄漏内部服务密钥、账号数据或绝对服务器路径。
