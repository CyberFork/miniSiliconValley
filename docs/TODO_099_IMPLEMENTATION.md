# T-099 实现说明：Candidate CAS 与 exact 完整性

> 本文对应 `99-candidate-save-concurrency-and-exact-integrity.md` 的已完成实现。文中不包含密钥、账号或生产数据；第 7 节记录的是 2026-09-10 在干净校验副本中实际执行的结果。

## 1. exact Candidate CAS 契约

Candidate 身份是三元组 `{ courseId, revision, digest }`，三者必须同时匹配同一条不可变 `course_versions` 快照；仅按 revision 或仅按 digest 都不是有效引用。保存 API 要求请求显式携带 `expectedCandidateRef`：首次创建传 `null`，后续保存传当前 exact Candidate。缺少字段返回 `400 CANDIDATE_BASE_REQUIRED`；课程 ID 不一致或 ref 不是 Candidate 返回 `400/409 CANDIDATE_BASE_INVALID`。

示例（脱敏）：

```http
POST /api/studio/candidates
Content-Type: application/json

{
  "expectedCandidateRef": {
    "courseId": "course-demo",
    "schemaVersion": 1,
    "revision": 12,
    "digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "status": "candidate"
  },
  "course": {
    "schemaVersion": 1,
    "id": "course-demo",
    "title": "示例课程",
    "course": { "id": "course-demo", "name": "示例课程" }
  }
}
```

上例的 `course` 只展示与本契约有关的字段；真实请求仍必须提交通过 CourseDefinition Schema 校验的完整课程包。

首次创建将 `expectedCandidateRef` 设为 `null`。响应返回的新 exact ref；服务端会立即按 ref 读取并重新计算 digest，失败则报注册表损坏，而不返回成功。

## 2. 幂等、冲突与原子边界

- 相同正文重试：若当前 Candidate digest 已等于提交正文 digest，服务端校验 exact 快照后返回已存在 ref，属于幂等成功，不重复制造版本。
- 旧基线顺序保存或同基线并发保存：只有仍满足 CAS 基线的一方能推进 Candidate；另一方收到明确 `409`（包括基线冲突或 revision contention），本地 Working Copy 保留，不写成功事件。
- 不再使用 `INSERT OR IGNORE` 掩盖不同正文的版本竞争。版本分配、快照插入、Candidate pointer 条件移动、成功事件写入组成同一批原子条件写；失败后重新读取 pointer，仅在确定同一 digest 时按幂等处理。
- 发布也以 exact Candidate 为目标：检查 Candidate、验收回执和正文后再发布；并发保存使目标不再是当前 exact Candidate 时，发布 fail closed，不发布旧对象。

保存 API 的冲突处理步骤：读取 409 中的当前 ref/作者/时间（若界面可见）→比较本地 Working Copy 与服务器 Candidate→选择放弃本地修改并重载，或进行三方比较/显式合并→确认合并结果后，以新的 exact 基线再次保存。不得自动覆盖同事字段。

## 3. 0008 迁移与 exact 守卫

`drizzle/0008_candidate_cas_and_exact_integrity.sql` 先建立单行完整性守卫，并在迁移阶段检查 Candidate、Release、课堂绑定、运行/验收回执及事件等引用是否存在完全相同的 `course_id + revision + digest` 快照；相关表上的触发器拒绝孤立或错配 pointer。`course_versions` 的旧 digest 唯一索引被移除，改为 `course_id, revision, digest` exact 唯一索引，因为版本身份不是 digest 单列。父快照另有 UPDATE/DELETE 拒绝触发器，保证已经创建的版本只增不改、不可删除。迁移不会修复或改写历史错配数据。

## 4. 部署前置检查与失败关闭

部署脚本在停止课堂服务后，**先**创建完整 classroom data 备份，再以 SQLite `mode=ro`、`PRAGMA query_only=ON` 执行只读 preflight，并将报告写入受保护的备份目录。检查发现孤立/错配引用、数据库读取错误或发现不确定的历史状态时，preflight 返回非零，部署立即中止（fail closed），不猜测修复；后续切换 release、重启服务不会发生。回滚使用部署前记录的 release/数据备份，保留失败报告供审计。

## 5. 编辑器行为

编辑器区分浏览器内的 Working Copy、当前 Candidate、Released 和不可变历史快照。编辑只改变 Working Copy；保存整门 Course Package 才生成新 Candidate，运行课堂继续锁定创建时的 exact 版本，不会被热更新。发生冲突时界面显示本地基线、服务器当前版本、作者/时间（可用时）及本地/远端变更；支持比较、放弃本地修改重载，或三方合并。重叠字段不会自动选边，必须显式处理并二次确认；合并确认后仍需按新服务器基线重新保存。恢复历史也是载入 Working Copy，保存后生成新 revision，不覆盖旧快照。

## 6. 自动化测试矩阵

测试文件：`tests/course-registry-concurrency.test.ts`。

- 旧基线顺序保存：新 Candidate 不被旧编辑器覆盖。
- 同基线并发不同正文：一方成功、一方冲突，且无孤立 pointer。
- 相同正文在调用方未收到首次响应时重试：幂等返回。
- 恢复相同历史正文：产生新的不可变 revision。
- field-model 规范化后，返回 ref 可立即 exact 读取。
- 数据库 exact guard 拒绝 digest 错配且不改变历史。
- migration preflight 对遗留错配只报告并中止，不自动修复。
- 保存抢先于发布提交时，发布检查 fail closed。

使用 Node 22 运行（项目依赖和 TypeScript loader 以仓库脚本为准），例如：

```bash
nvm use 22
node --version
node --import tsx --test tests/course-registry-concurrency.test.ts
```

## 7. 2026-09-10 实际验收结果

- TypeScript typecheck：通过。
- ESLint：通过，0 warning。
- `test:course-platform`：92/92 通过，其中 T-099 数据库/并发测试 8/8 通过。
- 部署与 preflight 单元测试：45/45 通过。
- `build:minisv-app`：通过。
- 完整 Course Platform E2E：通过；验证缺少基线被拒绝、exact Candidate、双回执发布门禁、Test/Production 隔离和 2/6 人课堂。
- Chromium 151 真实浏览器：通过；验证 A/B 冲突、作者/时间与字段差异、Working Copy 不丢失、合并二次确认、手动再保存，以及破坏性重载二次确认。
- 浏览器回执：`docs/qa/t099-candidate-conflict/browser-receipt.json`。
- 截图证据：`docs/qa/t099-candidate-conflict/candidate-conflict.png`。

仓库位于 OneDrive，同步中的既有 `node_modules` 缓存曾出现第三方 JSON 截断；因此最终 typecheck、lint、build、E2E 与浏览器验证在从同一 canonical HEAD 建立并覆盖本次变更的干净临时校验副本执行。代码真值仍是本仓库，临时副本不作为发布源。

## 8. 回滚与边界

回滚优先恢复部署前 release、classroom data 备份及服务配置；不得删除或重写旧不可变 `course_versions`。0008 的 exact 守卫旨在阻止新错配，历史问题应先人工制定修复策略。既有 Released 快照、运行中 Classroom 及其创建时绑定不因 Studio Working Copy 或 Candidate 保存而改变；只有经过 exact Candidate、视图/UI 验收和发布闸门的版本才可进入正式课堂。
