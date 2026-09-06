# MSV 导航门户发布回执

发布完成时间：2026-09-04 06:58（Asia/Shanghai）

## 发布目标

- 正式总入口：<https://work.cyberforker.com/msv/>
- 稳定主入口：`/msv/world`、`/msv/classroom`、`/msv/framework`、`/msv/parents`、`/msv/workshop`、`/msv/alpha`
- 稳定账号入口：`/msv/login`、`/msv/register`、`/msv/recover`、`/msv/account`

## 静态 Release

- Active：`releases/20260903T225755Z-msv-portal-c113a45ec33b`
- Previous：`releases/20260903T225450Z-msv-portal-d2b05d7593ab`
- 本轮开始前基线：`releases/20260903T134550Z-golfnine-plan-7170bc93b09a`
- 发布方法：复制共享 current release，只覆盖门户三文件和三个页面 manifest，再用 `mv -h` 原子切换符号链接。
- 未删除或覆盖 `launch.html`、GolfNine 及其他共享产品。

门户产物 SHA-256：

- `index.html`：`2115a241776436573f495c816d370d27b625c1b33fe40ac3b8e0af5672ba7602`
- `portal.css`：`f9b5e6586533ad972290b7811e731dcca00e10003abf0c071c85ee70dab08600`
- `sitemap.json`：`90ac56263bb726105cc26ba60c4e600350940d3c576c980bc4e6b1971069f814`

## 网关

- Nginx 配置 SHA-256：`fe21a1be7aa4c27419ba09812b0c1bcee9fe7f1632c2b66c5ccb89a8cca4748f`
- 最终配置前备份：`~/Services/work-sync/gateway/default.conf.bak-20260903T225838Z-portal-final`
- 本轮开始前备份：`~/Services/work-sync/gateway/default.conf.bak-20260903T224552Z-msv-portal-1681e4938e68`
- `nginx -t`：通过。
- `work-sync-gateway`：`running / healthy`。

## 验收结果

- 门户契约测试：3/3 通过。
- 已部署静态产物与 manifest 测试：3/3 通过。
- 合计专项测试：6/6 通过。
- 公网冒烟：`MSV_PORTAL_LIVE_PASS origin=https://work.cyberforker.com stable=7 utilities=4 pages=18 query=preserved`。
- `/msv` 正确规范化到 `/msv/`，且保留 query。
- 九个语义/账号别名使用非永久 `302`，保留 `team`、`returnTo` 等 query。
- `/msv/alpha` 的 `run` query 保留。
- 旧 `launch.html`、`demo.html`、`123456.html`、`qa.html`、动态应用、登录页和 Alpha 页面均回归为 `200`。
- 三个页面 manifest 已改为各自正确的 canonical target。

## 回滚

静态内容可将 `~/Services/work-sync/site/current` 原子切回 Previous；若需完全撤销本轮门户，切回本轮开始前基线。网关配置先从对应备份原样写回，等待容器挂载哈希一致，执行 `nginx -t` 成功后再 reload。

完整路径架构见 [MSV_SITE_MAP.md](./MSV_SITE_MAP.md)。
