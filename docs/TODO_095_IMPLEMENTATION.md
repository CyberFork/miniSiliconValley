# T-095｜课程字段与六席隔离实施回执

## 结果

课程编辑器现在把“同一份课程 JSON”和“共用同一个可变字段”彻底分开：

```text
CourseDefinition
├── global：显式公共字段
├── mentorRole：mentor01—mentor04 独立字段
├── seat：learner01—learner06 独立字段
├── card：每张 cardId 独立字段
└── seatTemplate：只负责创建新席位，不反向改写既有席位
```

每个可编辑字段都有稳定的 `fieldId / scope / ownerId / blockId / valueType / JSON path`。字段身份是课程内容的索引契约，不是第二份正文。

## 六席迁移

- 不可变来源：`eleme-2008-product-development-t090.json`
- 来源课程 digest：`bbb3d912b94b93127422d83cd03c1ad1aca3119b48f38797af1718dc99db281a`
- 新 Candidate 文件：`eleme-2008-unified-t095.json`
- 新课程 digest：`5dde44ae6d32fe935df1900d6b805e306be20671a9afc523180821939c8c2c33`
- 新文件 SHA-256：`470986fcb674ec84bd6fc03987a81246ca68645ca72d583e8efb5af3873be775`
- 字段身份：981 个
- 新建席位节点：26 个（13 Block × learner05/06）
- 稳定学员席：learner01—learner06

旧 T-090、旧 Candidate 和 Released 均未修改。新保存的 Candidate 由服务端先完成确定性迁移和完整 Schema 校验，再计算 digest、分配数据库 revision。

## 编辑器行为

- 课程信息页可设置默认、最少、最多学员数和每人卡数。
- 4 位导师与 N 个学员都在原编辑器布局中直接编辑，不再退化成摘要卡。
- 字段弹窗显示字段 ID、作用域、所有者和 JSON path。
- 公共字段明确提示会影响全部投影视图；专属字段明确提示只改当前 owner。
- “建立／刷新字段身份”只改变浏览器 Working Copy；必须显式保存才产生新 Candidate。
- 6→4 只把 learner05/06 标为 inactive，不删除其文案。
- Undo／Redo 保存整个不可变快照，但一次编辑仍只变更目标 fieldId 及其显式 global alias。

## 同步修正

T-090 已声明 2—6 人、每人 2 张卡，但部分可见文字仍写固定“4 人×3 张”。只在新 T-095 Candidate 中改为人数无关的两张卡描述；旧版本保持逐字节不变。

机器迁移明细：`TODO_095_FIELD_ISOLATION_MIGRATION.json`。

## 自动验收

- learner01／learner06、P 导师和任一卡片修改互不串联。
- global alias 只在声明路径间同步。
- 重复 fieldId、错误 owner/path、陈旧模型全部 fail closed。
- 2／4／6 人均生成独立席位；每人 2 张、同轮不重复。
- 6→4 后停用席位仍保留。
- 保存 Candidate、刷新字段模型和浏览器投影均通过契约测试。
