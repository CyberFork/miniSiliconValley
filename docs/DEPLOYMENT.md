# 部署说明（DEPLOYMENT）

## 平台

- 本项目使用 Next/Vinext，并由 OpenAI Sites 托管。
- 正式公开入口：`https://mini-silicon-valley-rpg.cyberforker.chatgpt.site`
- `.openai/hosting.json` 保存 Sites 项目标识及可选资源绑定；项目不使用 D1 或 R2。
- 学员进度只保存在浏览器 `localStorage`，部署端不存储学员档案。

## 发布前门禁

在项目根目录执行：

```bash
npm ci
npm run validate:data
npm test
git diff --check
```

只有四项全部通过，且 Git 工作树不含密钥、临时导出档案或调试文件，才可发布。

## Sites 正式发布流程

1. 首次发布时创建一个 Sites 项目，并把返回的 `project_id` 原样写入 `.openai/hosting.json`；之后不得重复创建项目。
2. 将通过门禁的完整源码提交到 Git，记录提交 SHA。
3. 使用 Sites 返回的一次性凭证，以单条命令的 HTTP 授权头推送；不得把令牌写入 remote URL、Git config、日志或文件。
4. 使用 Sites 插件自带的 `scripts/package-site.sh` 从已验证提交制作归档。
5. 用同一个提交 SHA 和归档保存 Sites 版本并发起部署。
6. 轮询部署状态至成功；本课程经需求方明确要求公开访问，因此完成后将访问级别设为 public。
7. 对正式 URL 进行在线回归：入口、标题、四幅地图资源与核心交互脚本均应返回成功状态。

## 回滚

- 应用故障：在 Sites 中重新部署最近一个已通过门禁的版本。
- 数据故障：回退到相应 Git 提交，重新运行 `npm test`，保存新版本后部署。
- 浏览器档案异常：在“我的档案”中先导出检查点，再选择恢复或重置；服务端无需数据迁移。

## 故障排查

- 地图缺失：核对 `public/assets/map-1939.webp`、`map-1968.webp`、`map-1998.webp`、`silicon-valley-base-map.webp` 是否进入发布归档。
- 页面可访问但交互失效：查看构建产物中的客户端 chunk 是否为 200，并复跑 `npm test`。
- 历史节点异常：执行 `npm run validate:data`，检查 ID、关系、来源与坐标引用。
- 部署认证失败：重新获取 Sites 一次性凭证；不要把旧凭证固化为 Git remote。
