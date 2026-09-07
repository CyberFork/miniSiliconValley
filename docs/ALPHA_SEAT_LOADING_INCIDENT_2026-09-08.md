# Alpha 席位持续“正在连接课堂”事故复盘

日期：2026-09-08  
范围：`https://minisv.vip/alpha/` 的 4 导师＋4 学员席位页  
读者：产品、课程、开发与运维团队

## 结论

这不是账号、课堂数据、Run 状态或网络轮询故障。席位 HTML 已经打开，但它新增依赖的两个共享预览资源没有被远端席位服务发布：

- `/alpha/course-preview.js` 返回 404；
- `/alpha/course-preview.css` 返回 404。

`seat.js` 在第一次请求课堂状态前读取缺失的 `MsvCoursePreview`，初始化直接终止。页面留下 HTML 中的静态占位文案“正在连接课堂…”，因此看起来像一直在联网，实际上根本没有开始连接。

热修发布期间还暴露了第二个独立问题：部署脚本把 Cloudflare Tunnel 当作普通应用进程，每次发布都强制 `bootout/bootstrap`。macOS `launchd` 在连续发布时返回 EIO 5，健康 Tunnel 被停止后未能重新装载，公网短暂返回 530。两个问题的故障链不同，不能混为一个“网络问题”。

## 用户影响

- 受影响：从 Alpha 席位台领取并打开的导师、学员窗口。
- 表现：页面永久显示“正在连接课堂…”，没有可执行动作，也没有错误说明。
- 未受影响：课程 JSON、Released 课程、Classroom 账户、活动 Run、Block 进度、手牌、RP、个人钱包和团队资金。
- 席位租约：故障页没有发起 `/api/state` 心跳，旧租约会按既定超时释放；恢复后需要刷新或从 Alpha 席位台重新领取。

## 故障链

### A. 席位页面卡死

1. 课程工作台抽取了共享的 `course-preview.js`／`course-preview.css`，真实席位页开始引用它们。
2. `remote-console/server.mjs` 使用手写静态文件白名单，仍只发布旧的 `seat.html`、`seat.css`、`seat.js` 和 `card-view.js`。
3. 浏览器成功取得 HTML，却对两个新增资源收到 JSON 404。
4. 旧版 `seat.js` 没有启动前依赖守卫，在轮询与错误界面注册前抛错。
5. 静态占位文案没有超时或失败态，所以故障被伪装成“仍在连接”。

### B. 热修发布造成公网 530

1. 应用热修本身发布成功，本机 controller、remote console 和 gateway 都健康。
2. 部署脚本无条件重启运行正常、配置未变化的 Cloudflare Tunnel。
3. `launchctl bootstrap` 在快速 `bootout` 后持续返回 `Input/output error (5)`。
4. Tunnel 未装载，Cloudflare 无可用 connector，公网返回 1033／HTTP 530。
5. 人工重新装载并以 `127.0.0.1:18792/metrics` 验收后恢复。

## 为什么原测试没有发现

1. 旧浏览器测试由自建 fixture 直接暴露源码目录，没有穿过生产使用的 remote-console 静态路由。
2. 旧公网 smoke 只检查 `/alpha/`，没有检查 `seat.html` 的完整依赖闭包。
3. 测试把“HTML 返回 200”等同于“席位可运行”，没有真实领取席位并等待运行界面渲染。
4. 没有断言浏览器资源请求零 4xx／5xx、控制台零 error。
5. 发布只判断 `launchctl bootstrap` 命令结果，没有把 Tunnel metrics ready 作为每次启动尝试的完成条件。

## 已实施修复

### 席位运行时

- 用 `SEAT_STATIC_FILES` 明确定义并发布完整席位资源集合，包含共享预览 JS/CSS。
- `seat.js` 增加启动依赖守卫。依赖不完整时显示“席位资源加载失败”和恢复动作，不再永久显示连接占位。
- 由 Nginx gateway 统一拥有公网安全响应头，隐藏上游重复 CSP；共享预览需要的内联 CSS 变量由明确的 `style-src` 规则支持。

### 自动化门禁

- remote-console 集成测试解析真实 `seat.html`，逐项请求每个相对脚本和样式，并检查状态、MIME 与非空内容。
- Hecate healthcheck 和公网 smoke 覆盖 `seat.html`、`seat.js`、`course-preview.js`、`course-preview.css`。
- 生产浏览器验收脚本临时领取一个空闲席位，在 390×844 视口等待真实席位 surface，断言：
  - 不再出现“正在连接课堂”；
  - 不出现显式错误态；
  - 所有资源零 4xx／5xx；
  - 浏览器控制台零 error；
  - 无论成功失败都释放临时席位，且不输出租约能力值。

### 发布与 Tunnel

- 普通应用发布不再重启健康且有效输入未变化的 Tunnel。
- 发布脚本比较 Tunnel credentials、渲染后的 config 和 launchd plist；只有输入变化或 metrics 不健康时才重启。
- Tunnel 恢复采用有界重试；每次启动都必须同时满足 launchd 已装载及 metrics 可读，不能只相信 bootstrap 返回码。
- 本地 controller、remote console、gateway 先就绪，最后才检查或恢复公网入口。

## 防复发规则

1. **HTML 依赖闭包是发布单元**：给页面增加相对资源时，必须同步更新真实服务路由；禁止只在测试 fixture 中补路由。
2. **可运行优先于可访问**：页面 200 不是成功。关键流程必须由真实浏览器完成一次最小业务闭环。
3. **加载态必须可终止**：任何“正在……”界面都必须进入成功、明确失败或超时恢复态。
4. **生产边界必须进测试**：至少一层集成测试使用与生产相同的 Node/Nginx 路由，而不是源码目录服务器。
5. **长连接基础设施与应用解耦**：无配置变化时不碰 Tunnel；变更时使用显式差异检测、就绪探针与回滚信息。
6. **发布后做三层验收**：loopback healthcheck → 公网无密 smoke → 公网真实浏览器业务验收。
7. **状态按语义校验**：部署前后比较 Run 的归一化业务内容，不比较 JSON 序列化字节，避免字段顺序造成假警报。

## 标准验收命令

```bash
# Hecate 本机
~/Services/minisv/current/ops/scripts/healthcheck-hecate.sh

# 任意具备公网访问的验收机
python3 deploy/minisv/scripts/public-smoke.py --base https://minisv.vip
python3 tools/live-run/tests/verify_alpha_public_seat.py \
  --base https://minisv.vip/alpha/
```

预期终态：`MINISV_HECATE_HEALTHY`、`MINISV_PUBLIC_SMOKE_OK` 和 `ALPHA_PUBLIC_SEAT_OK` 同时出现。

## 最终发布回执

最终不可变 release、源提交、Tunnel PID 保持情况、课程产物摘要和部署前后 Run 语义对比，在完成生产复验后记录于本节。

