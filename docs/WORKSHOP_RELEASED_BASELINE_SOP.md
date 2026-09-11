# 早期 Workshop 历史归档与浏览器记录导出 SOP

> 状态：T-109 起，旧 Workshop 已冻结为**受保护的只读历史归档**。它不再参与编辑、讨论、回写、验收或发布。现行课程生产见 [Course Platform SOP](COURSE_PLATFORM_SOP.md)。

## 1. 现在的单一真值

```text
/studio/editor/ 的 CourseDefinition Working Copy
→ 不可变 Candidate
→ 多角色视图验收
→ 真实 Test Classroom UI 验收
→ Released
→ Production Classroom
```

`/workshop/` 不是上述链路的一环，也不是第二个课程编辑器。归档页只做两件事：

1. 展示随 release 打包、已脱敏的最后确认 Released 基线摘要。
2. 在使用者主动打开页面时，只读检查并导出**当前浏览器**遗留的 Workshop localStorage 记录。

## 2. 访问与安全边界

- 入口：`Studio → 资料与历史 → 早期课程工作坊`。
- URL 暂时保留为 `/workshop/`，用于旧书签和审计连续性。
- 匿名访问跳转登录；learner 返回 403；mentor/admin 才可查看。
- 页面和响应均为 `noindex`、`private, no-store`。
- `/workshop/_source/*` 固定返回 404。旧工具逐字节源码只随不可变 release 保存，用于运维回滚和取证，不从 Web 暴露。
- 归档脚本没有 `localStorage.setItem/removeItem/clear`，没有课程写 API，也不会上传浏览器记录。

## 3. Released 脱敏基线

`deploy/minisv/workshop/confirmed-baseline.json` 继续作为历史展示摘要。打包时 `package_release.py` 会校验：

- `snapshotVersion=1`、`scope=public-redacted-summary`、来源通道为 `released`；
- exact `courseId/revision/digest/status`；
- 已确认的五步、13 个 Block、5 个卡组摘要与聚合摘要；
- 快照完整性 digest；
- 不含导师讲稿、席位私密任务、钱包、资金、租约、密钥或内部路径。

快照只能说明当时打包的 Released 摘要，不能代替现行 Registry、人工回执或课堂数据。

## 4. 浏览器遗留记录的现实边界

localStorage 属于浏览器、设备和 origin。服务器无法自动收集别的电脑、别的浏览器配置或已经被用户清理的记录。因此“发布了归档页”不等于“已经备份所有人的 Workshop 讨论”。

归档页只检查以下十个已知键：

```text
msv.curriculumWorkshop.v1
msv.curriculumWorkshop.v2
msv.curriculumWorkshop.backup.v2
msv.curriculumWorkshop.checkpoint.v2
msv.workshop.confirmed-baseline.v1
msv.workshop.confirmed-baseline.backup.v1
msv.workshop.baseline.proposals.v1
msv.workshop.baseline.decisions.v1
msv.workshop.baseline.audit.v1
msv.workshop.baseline.actor.v1
```

### 每台实际使用过的浏览器都要执行

1. 使用 mentor/admin 账号在那台设备、那个浏览器配置中打开 `/workshop/`。
2. 查看“本浏览器历史记录”摘要；没有记录时不要把它解释为其他设备也没有。
3. 展开关键键核对原始内容。屏幕预览最多 120,000 字符，仅用于避免页面失控；导出仍包含完整原始值。
4. 点击“导出本浏览器记录 JSON”。可重复导出，操作不会删除或修改任何键。
5. 将文件保存到团队批准的受控位置，记录设备、浏览器配置、导出者和时间；不要通过公共聊天发送包含未脱敏讨论的文件。
6. 由团队人工比对和合并多浏览器导出。归档页不会自动判断冲突，也不会把记录写回 CourseDefinition。

导出结构包含 `exportType`、时间、origin、readOnly、每个键的 `rawValue/bytes` 和缺失键；它是原始浏览器记录封装，不是已批准课程内容。

## 5. 发布与回滚

打包阶段按以下顺序处理 Workshop：

1. 将旧 Workshop 的 HTML、CSS、JS、assets 和 manifest 移入 release 内的 `_source/`。
2. 在加入 `SOURCE-MANIFEST.json` 前计算旧源码树的 SHA-256、文件数和字节数；manifest 明确记录其覆盖范围。
3. 在可服务路径只放只读 `archive.html/css/js`、schema 和脱敏基线。
4. Gateway 拒绝任何 `_source` 请求，并通过独立 Studio 归档鉴权保护 `/workshop/`。

整站回滚会原子切换回上一份不可变 release；运行数据、账号和浏览器 localStorage 不属于 release，也不会随之回滚。恢复旧可写 Workshop 必须作为新的架构变更评审，不能通过暴露 `_source` 或改一个导航链接完成。

## 6. 机器验收

```sh
npm run test:t109:browser
python3 -m unittest -q deploy.minisv.tests.test_course_release
python3 -m unittest -q deploy.minisv.tests.test_gateway_contract
python3 deploy/minisv/scripts/public-smoke.py --base-url https://minisv.vip
```

机器验收必须证明：

- 归档页能读基线，能看见十个键状态，完整导出后原键逐字节不变；
- 公共官网没有 Workshop 入口；Studio 历史页可普通点击找到它；
- 匿名跳登录、learner 拒绝、mentor/admin 可读，`_source` 为 404；
- 搜索与缓存边界正确；release 保留旧源码字节和 manifest。

自动化不能证明其他人的浏览器已经全部导出。该项必须由资料所有者逐设备确认并记录，不能用一台隔离 Chromium 的合成 localStorage 冒充完成人工归档。
