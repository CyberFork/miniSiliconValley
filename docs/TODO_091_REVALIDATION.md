# T-091｜P 导师饿了么课程包重新验收

## 重新验收对象

本次不再只验收旧的 P-only Candidate，而是验收 T-095 统一 Candidate：

```text
courseId: eleme-2008-find-problem
source: tools/live-run/courses/candidates/eleme-2008-unified-t095.json
course digest: 5dde44ae6d32fe935df1900d6b805e306be20671a9afc523180821939c8c2c33
file SHA-256: 470986fcb674ec84bd6fc03987a81246ca68645ca72d583e8efb5af3873be775
```

## 通过项

- 饿了么 historical CasePackage 唯一 owner 为 P。
- P ScriptPackage 只拥有 B01—B04 四个检查点。
- D/M/O 在 B01—B04 不获得 P 私有主持稿。
- D 从 B05 开始拥有自己的纯课堂模拟剧本；“不是饿了么历史”是边界提示，不是复制历史讲解。
- 所有 F 卡有来源；R 卡无来源且明确以“课堂模拟”标注；G/U 继续保持推测／未知边界。
- ProductBrief 仍为 P 所有的 10 字段成果，B04 提交并由 P 退回／通过。
- 只有 accepted ProductBrief 在 B05 通过独立 handoff 投影交给 D；M/O 不可见。
- P 课件 exact ref 仍锁定：
  `cw-product-mentor-foundations / product-mentor-foundations / r0 / b2852b39462bc05464582b3c36f773e68fa84775b9e7c7673a128fac97d7cda5`。
- 2—6 人每人两张 B01 私密卡，六人时 12 张全部唯一。

## 自动真实流程

本地临时 D1 已跑通：

```text
导入 T-095 Candidate
→ 创建 exact Test Classroom
→ P/B01—B04
→ 学员提交 ProductBrief
→ P 退回
→ 学员重交
→ P 通过
→ 解锁 B05
→ D 获得 accepted handoff + 自己的开发剧本
→ 错误 P 课件 digest 创建课堂被拒绝
```

自动流程只产生临时测试数据。它不冒充团队的人工作品验收，也没有签发生产 ViewAcceptanceReceipt／UiAcceptanceReceipt。
