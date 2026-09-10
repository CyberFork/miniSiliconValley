---
type: todo
id: T-095
title: "修复课程编辑器中不同用户字段意外共用与联动修改"
status: completed
created: 2026-09-09
updated: 2026-09-10
captured_by: project-inbox
priority: P0
estimated_effort: medium
related:
  - T-074
  - T-083
  - T-085
  - T-091
  - T-094
tags:
  - todo
  - mini-silicon-valley
  - course-editor
  - field-isolation
  - unique-id
  - role
  - seat
  - immutable-data
  - regression
---

# 修复课程编辑器中不同用户字段意外共用与联动修改

## 一、问题描述

课程编辑器中存在多个用户／角色的可编辑字段实际绑定到同一份对象或同一个字段ID的问题。修改一个用户的内容时，其他用户的对应内容也随之改变。

这不符合课程编辑器的预期：

> 同一份底层课程JSON可以同时包含所有角色和席位的数据，但每个用户专属的可编辑字段必须拥有独立ID、独立数据节点和独立编辑路径。

“使用同一份课程JSON”不等于“多个用户共用同一个可变字段”。

本任务同时覆盖**自定义学生人数**。当前明确存在6名学生的课程需求，因此编辑器不能继续假设固定4名学生，也不能在增加到6人时让学员5、学员6与其他席位共用卡片对象。

## 二、独立字段与公共字段的边界

### 默认必须独立

以下内容只要面向具体角色、席位或用户，就必须独立：

- P、D、M、O导师各自的任务、观察重点、提示、讲稿和课件入口。
- 各学员席位的可见任务、私密卡、行动要求和角色专属文案。
- 不同卡片的标题、正文、来源边界、行动要求和归属设置。
- 不同角色在同一个Block中看到的说明、输入字段和验收提示。
- 编辑预览中针对某一席位进行的临时修改或override。

即使初始内容完全相同，也必须在初始化时复制成独立节点；后续修改一份不能影响其他角色或席位。

### 只能显式公共

以下内容可以是全局公共字段，但必须由Schema和UI明确标记为`global／公共`：

- 课程标题、课程说明和统一版本信息。
- 五步与Block公共名称。
- 公共投屏事件和团队共同任务。
- 全班统一倒计时、奖励规则或公开验收条件。
- 明确设计为所有席位同步显示的公告。

公共字段只维护一份。用户编辑前，UI必须明确提示“这会更新所有角色／席位”，不能让多个看似独立的输入框偷偷指向同一对象。

### 运行状态不属于课程正文

以下内容属于ClassroomInstance，不能写回或共用CourseDefinition字段：

- 具体学员抽到的手牌。
- 已读、已公开和已提交状态。
- 当前Block和中控推进状态。
- RP、个人钱包和团队资金。
- 导师验收、退回和课堂审计记录。

## 三、自定义学生人数与六席独立契约

课程定义需要声明支持的学生人数范围和可用席位，而具体Classroom再选择本场实际启用多少名学生。例如：

```json
{
  "studentCapacity": {
    "min": 2,
    "max": 6,
    "default": 6
  },
  "studentSeats": [
    { "seatId": "student-01", "fieldRootId": "ROOT-STUDENT-01" },
    { "seatId": "student-02", "fieldRootId": "ROOT-STUDENT-02" },
    { "seatId": "student-03", "fieldRootId": "ROOT-STUDENT-03" },
    { "seatId": "student-04", "fieldRootId": "ROOT-STUDENT-04" },
    { "seatId": "student-05", "fieldRootId": "ROOT-STUDENT-05" },
    { "seatId": "student-06", "fieldRootId": "ROOT-STUDENT-06" }
  ]
}
```

### 六个席位必须真正独立

- 学员1～学员6分别拥有稳定且唯一的`seatId`，不能只依赖数组下标。
- 每个席位的任务、提示、私密卡配置和可编辑字段都拥有独立fieldId。
- 学员5、学员6由模板初始化时必须深复制并生成新ID，不能引用学员1或默认模板的可变对象。
- 对席位重新排序不能交换或覆盖其已有内容；Membership始终绑定稳定seatId。
- 实际课堂只有2名或4名学生时，只是不启用其他席位，不得把未启用席位的私密内容分配给已启用学生。

### 卡片独立规则

```text
sourceId
可以共同引用同一条不可变来源记录

cardId
每张可编辑课程卡必须唯一

cardAssignmentId
运行时每次发牌关系必须唯一，并绑定classroomId、runId和seatId
```

- 两张卡可以引用同一`sourceId`，但不能因此共用可变标题、正文、行动要求或归属对象。
- 修改学员6的一张卡，不得改变学员1～5或导师卡组中的任何卡片。
- 同一张唯一cardId默认只能在同一次发牌中分配给一个席位；需要多人看到相同内容时，应使用公共事件，或明确创建独立卡片副本。
- 增加学生人数后必须重新执行卡池容量、不重复发牌和每人最小手牌数校验。

### 编辑器人数控件

- 提供明确的学生人数／支持范围设置，并即时展示将产生的席位数量。
- 从4人增加到6人时，预览新增的学员5和学员6及其新fieldId、cardId。
- 从6人减少到4人时，先列出即将停用的席位、字段和卡片；不得静默删除已有内容。
- 推荐默认停用而不是立即删除；确需删除时经过确认，并保存到新的Candidate revision。
- 人数变化后的Editor Preview必须可以切换查看全部6个独立席位。

## 四、字段身份契约

每个可编辑节点必须至少具有：

```json
{
  "fieldId": "FIELD-B01-STUDENT-04-TASK-001",
  "scope": "seat",
  "ownerId": "student-04",
  "blockId": "B01",
  "fieldType": "taskPrompt",
  "value": "当前席位独立内容"
}
```

约束：

- `fieldId`在整个CourseDefinition revision中唯一。
- `scope`明确为`global`、`mentorRole`、`seat`或其他受Schema允许的范围。
- 非global字段必须有明确`ownerId`或所有者路径。
- 两个用户专属编辑控件不得引用相同`fieldId`。
- 复制字段时生成新ID和新对象，而不是复制引用。
- 保存、恢复历史版本和导入导出后仍保留独立ID。
- 前端显示的字段ID必须来自JSON／API，不得根据标签临时拼接。

## 五、可能根因

实施前重点排查：

- 前端初始化使用浅拷贝，多个席位共享嵌套对象。
- 使用`Array.fill(sharedObject)`创建多个用户配置。
- React状态更新直接修改共享对象，没有按路径不可变更新。
- 不同角色重复使用相同`cardId`、`fieldId`或组件key。
- 后端按标题、类型或旧ID去重，将不同用户节点错误合并。
- 模板和实例使用实时引用；修改实例实际修改了模板。
- 序列化／反序列化时丢失owner路径，重新加载后节点被合并。
- “复制到其他席位”实际创建链接，而不是深复制。
- Editor Preview的override被错误写回所有席位基础数据。

## 六、编辑器UI要求

### 显示作用范围

每个可编辑区域附近显示清楚的范围标识，例如：

```text
公共字段
P导师专属
D导师专属
学员4专属
席位模板，仅用于新建
运行状态，只读
```

### 显示字段ID

在字段详情、调试模式或复制信息面板中可以查看并复制：

```text
fieldId
scope
ownerId
JSON path
courseDataId
```

不要求把长ID一直占据主编辑区，但用户必须有地方确认两个输入框是否实际绑定同一节点。

### 修改影响提示

- 编辑seat／mentorRole字段时显示“只修改当前用户”。
- 编辑global字段时显示“将同步更新公共内容”，并列出受影响视图。
- 如果用户要把相同内容复制到多个角色，提供“复制内容”操作，默认产生独立字段。
- 只有用户明确选择“建立公共字段”时才创建共享引用。
- 保存前可以查看本次变更影响了哪些fieldId和ownerId。

## 七、数据修复与迁移

1. 保存当前CourseDefinition、Candidate和Released的只读备份及digest。
2. 遍历所有可编辑字段，建立`fieldId → bindings[]`反向索引。
3. 对同一fieldId绑定多个用户的情况逐项判断：显式global或意外共享。
4. 将意外共享节点按mentorRole／seat深复制，生成新的唯一fieldId。
5. 保留每个位置当前看到的值，不因拆分节点丢失文案、来源或卡牌状态。
6. 将模板改为只负责初始化；实例化后不再保持可变引用。
7. 保存为新的Candidate revision和courseDataId，不覆盖旧历史。
8. 在迁移报告中列出旧fieldId、新fieldId、所有者、JSON path和处理结果。
9. 无法确定是否应该公共的字段进入待审核列表，不由系统自动合并或拆分。

## 八、代码实现原则

- 所有编辑操作按唯一JSON path或fieldId进行不可变更新。
- 组件key包含owner和fieldId，避免不同用户组件复用错误状态。
- Schema校验拒绝一个非global fieldId绑定多个owner。
- 后端保存时不按文案相同进行去重。
- `deepClone／structuredClone`只用于实例化，正式编辑使用清晰的不可变更新函数。
- 公共字段由单一global节点投影到多个视图，不伪装成多个独立输入框。
- 若引入override，解析顺序必须固定并可解释，例如`global template → role override → seat override`；编辑seat override不能反向修改上层模板。

## 九、自动化回归测试

- [x] 修改学员1的任务文案，学员2～N及四位导师内容不变。
- [x] 修改P导师提示，D、M、O导师提示不变。
- [x] 修改学员4的一张私密卡，不改变其他席位的同序号卡片。
- [x] 修改一张卡的F／R边界，不改变其他卡片的边界。
- [x] 复制内容到另一席位后，两边值初始相同但fieldId不同；再修改其中一边互不影响。
- [x] 修改明确标记的global字段时，所有预期视图同步更新，且保存前有影响提示。
- [x] 非global fieldId绑定多个owner时，Schema校验失败。
- [x] 保存、刷新和重新打开编辑器后，独立字段不会重新合并。
- [x] 恢复历史revision时保持该revision原有字段关系，不覆盖历史。
- [x] 创建新Candidate后，courseDataId、revision和digest正确变化。
- [x] 使用固定seat和seed创建Test Classroom后，每个席位收到正确的独立字段和卡片。
- [x] 2人、4人和6人课程配置都通过字段唯一性扫描。
- [x] 将课程从4人扩展到6人后，学员5和学员6获得新的seatId、fieldId和cardId。
- [x] 修改学员6的任务或卡片时，学员1～5及四位导师完全不变。
- [x] 6名学生的实际Classroom中，Membership、席位、手牌和提交均按稳定seatId隔离。
- [x] 从6人切换为2人或4人时，未启用席位不会泄露、混入发牌或被静默删除。
- [x] 6人卡池容量不足或产生重复cardId时，编辑器阻止发布并指出具体缺口。
- [x] Undo／Redo只影响本次操作对应的fieldId，不回滚其他用户无关字段。

## 十、验收标准

- [x] 已盘点所有课程编辑字段的scope和owner，不再存在归属未知的可变字段。
- [x] 每个用户／角色专属字段具有独立fieldId和独立JSON节点。
- [x] 当前6名学生需求可以在编辑器中显式配置，并看到6个独立席位。
- [x] 六个席位的任务、卡片和行动要求均可分别修改，不发生联动。
- [x] 修改任意一个用户专属字段时，其他用户内容不发生变化。
- [x] 公共字段得到明确Schema标记和UI提示，不再发生隐式共享。
- [x] 编辑器可以查看字段ID、作用范围、所有者和JSON path。
- [x] 现有误共享数据完成无损拆分，并输出迁移清单。
- [x] Editor Preview、Test Classroom和中控按新的独立字段正确投影。
- [x] T-094的数据ID一致性检查可以进一步验证相同courseDataId下的用户字段投影。
- [x] 修复后再继续T-091的产品导师饿了么内容收敛。

## 十一、非目标

- 不把真正的公共课程字段强行复制成多份难以维护的数据。
- 不把运行中的手牌和提交状态写回课程JSON。
- 不通过隐藏其他视图的变化来掩盖共享引用问题。
- 不在没有备份和迁移报告的情况下原地覆盖已发布课程。
- 不自动决定归属不清字段应该公共还是独立；进入人工待审核列表。

## 2026-09-10 完成回执

- 新增 `fieldModel`：981 个稳定 `fieldId / scope / ownerId / blockId / path`，覆盖 global、四导师、learner01—06、card 与 seatTemplate。
- 13 个 Block 为 learner05／06 深复制 26 个独立席位节点；6→4 仅停用、不删除。
- 卡片正文继续以唯一 `cardId` 表示不可变课程内容；每场发牌以独立 `cardAssignmentId` 绑定 Classroom／Run／Seat，避免为每名学员伪造卡片副本。
- 隔离、global alias、非法绑定、2／4／6 人发牌、保存／恢复及编辑器 Undo／Redo 契约均通过。
- 生产 Candidate：`eleme-2008-find-problem r11`，digest `5dde44ae6d32fe935df1900d6b805e306be20671a9afc523180821939c8c2c33`；未覆盖任何旧 Candidate／Released。

