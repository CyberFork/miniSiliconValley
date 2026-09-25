# Course Registry 发布 SOP

> **Legacy（T-085 已替代）**：旧 `/control`／Alpha 发布链已退休。现行流程是 `CourseDefinition → Candidate → ViewAcceptanceReceipt → 真实 Test Classroom → UiAcceptanceReceipt → Released → Production`，请使用 [Course Platform SOP](COURSE_PLATFORM_SOP.md)。下文只作历史审计。


## 目标

Registry 是课程发布链的索引，不是内容复制器。唯一真值链为：`Candidate → Alpha exact revision/digest → Released → Classroom`。每个版本 immutable；任何修订都新建 revision，不覆盖旧记录。

## 发布步骤

1. 在 `/control/editor/` 建立 Candidate，校验课程标识、步骤/区块结构、卡组数量、来源边界和 schema。
2. 服务端规范化课程正文并计算 digest，登记不可变 revision；记录 Candidate、操作者和时间。相同 `(courseId, revision)` 不允许出现第二份正文。
3. 显式刷新 Alpha 时必须绑定该 Candidate 的同一 revision 与 digest；保存 Candidate 不得静默改变现有 Run 或学员手牌。
4. 评审通过后登记 Released，保留 Alpha 对应关系与发布回执；禁止直接从未登记文件生成 Classroom。
5. Classroom 仅消费指定 Released revision；变更需新 revision、重新验收和显式切换。

## 回滚与失败

回滚通过 Registry 选择旧的已验收 revision，并以新的指向/发布事件记录，不删除或改写历史。任一步骤失败都阻断后续发布，保留当前有效 Released/ Classroom 版本；不得部分写入或伪造 digest。

## 路由与例外

- `/control/editor/`：唯一写入口，管理员/导师按现有权限操作。
- `/control/`、Alpha、Classroom、Workshop：读取 Registry/Released 快照，不提供隐式回写。
- `/course/`：同事原样交付，字节不变，不注入品牌或 Registry 字段。
- `/framework/`：本项目自有页面，可统一品牌，但不改变课程内容真值。
- 页面内品牌统一使用受控 `public/assets/mini-silicon-valley-logo-transparent.png`；`public/favicon.svg` 只用于浏览器图标。不得输出密钥、令牌、cookie 或内部诊断数据。

## 验收命令

```sh
python3 -m unittest discover -s deploy/minisv/tests -p 'test_*.py'
python3 -m unittest discover -s tools/live-run/tests -p 'test_*.py'
npm run typecheck
npm run lint
npm run build
```

验收还需核对：revision/digest 在 Candidate、Alpha、Released、Classroom 一致；历史记录 append-only；失败保留旧版本；显式切换前后活动 Run、成员与手牌不被静默改动。命令仅为发布门槛，不代表本文件已执行或已部署。
