---
type: todo
id: T-092
title: "导入、部署并发布D导师开发课件到正式Courseware路由"
status: completed
created: 2026-09-09
updated: 2026-09-10
captured_by: project-inbox
courseware_role: D
priority: P1
estimated_effort: small-medium
depends_on:
  - T-089
  - T-093
  - T-096
related:
  - T-085
  - T-086
  - T-090
  - T-091
  - T-093
  - T-096
tags:
  - todo
  - mini-silicon-valley
  - development-mentor
  - courseware
  - import
  - deployment
  - release
  - route
  - authentication
---

# 导入、部署并发布D导师开发课件到正式Courseware路由

> 2026-09-09 实施更新：最终稳定身份采用
> `development-mentor-ligun`／`cw-development-mentor-ligun`／r0，
> 不再沿用本 Todo 早期建议但未落地的 `development-mentor-field-kit` 名称。
> 课件已上线并发布；T-090 课程 Candidate r10 已导入 Studio。
> Test Classroom 与 Production Classroom 绑定仍等待团队签发两级人工验收回执，
> 自动部署不会伪造回执或绕过 T-086 门禁。

## 一、问题确认

T-089 已完成 D／开发导师18页 HTML-PPT的本地制作与浏览器验收，但完成回执明确记录：

```text
developed = true
locallyTested = true
deployed = false
coursewareImported = false
released = false
committed = false
pushed = false
```

本地课件位于：

```text
/Users/hecate/Library/CloudStorage/OneDrive-个人/Work/CHJ、DL/AI教培-mini硅谷/cowork/课件/dev/mentor-development-deck
```

用户预期访问地址：

```text
https://minisv.vip/course/development-mentor-field-kit/?revision=0
```

2026-09-09 使用未登录请求检查时，该地址没有直接返回课件，而是：

```text
307 → /auth/login?returnTo=%2Fcourse%2Fdevelopment-mentor-field-kit%2F
308 → /auth/login/?returnTo=%2Fcourse%2Fdevelopment-mentor-field-kit%2F
```

这只能证明课程路由受到登录保护，不能证明对应课件revision已经存在。当前仓库搜索也没有找到 `development-mentor-field-kit` 的课程包注册或种子数据；同时登录跳转中的 `returnTo` 丢失了原始 `?revision=0` 查询参数，需要一并核实。

## 二、任务目标

将已经通过本地验收的 D 导师课件作为独立、不可变版本的 `CoursewarePackage` 导入课程工厂，完成Studio预览、Test Classroom绑定、正式发布和线上URL验收。

T-096先完成认证课件目录与P导师课件的首个上线闭环；本任务随后沿用同一目录、导入和权限机制增加D导师课件，避免P、D分别形成两套课件路由。

目标不是简单把目录复制到服务器，而是形成可追溯关系：

```text
本地课件源码
→ CoursewarePackage
→ 不可变revision与digest
→ Studio Preview验收
→ Test Classroom精确绑定
→ Released
→ Production Classroom使用
```

## 三、建议的课程包身份

```text
slug: development-mentor-field-kit
mentorRole: D
title: 开发导师现场工具包
format: html-deck
source: cowork/课件/dev/mentor-development-deck
```

实际 `revision` 不应由URL示例强行决定。导入时需要确认：

- `revision=0` 是否是系统允许的正式首版。
- revision 0 是否已经存在但没有内容或没有发布。
- 如果系统首个不可变发布版本应为 revision 1，则创建正确版本并更新所有入口。
- URL、Studio、Classroom和数据库必须引用同一个revision与digest。

## 四、导入范围

至少包含：

```text
index.html
README.md
课件完整文稿.md
课件设计思路与决策记录.md
立棍内容映射.md
导师口播与节奏.md
image-prompts.md
assets/
```

运行时只公开播放所需的HTML、CSS、JavaScript和图片资源。内部文稿是否允许在线下载由Courseware权限规则决定，但必须保留在源码包和版本记录中。

不得遗漏：

- 四张现有本地图片。
- HTML内联样式与脚本。
- 逐步揭示、总览、全屏和打印功能。
- URL深链接所需逻辑。
- 资源的相对路径和内容摘要。

## 五、发布和绑定流程

1. 重新运行 T-089 的本地验收脚本，确认源目录没有在导入前发生未验证修改。
2. 完成 T-093 的可点击已解锁进度条，并重新运行课件交互验收。
3. 计算课件包digest，保存来源路径、构建时间和Git提交信息；如果源码尚未提交，先完成可追溯提交。
4. 在 `/studio/courseware/` 创建或更新 `development-mentor-field-kit`。
5. 将导入结果保存为不可变Candidate revision，不覆盖历史版本。
6. 在Studio中打开确定revision进行只读播放验收。
7. 在一个Test Classroom中将D导师的课件入口绑定到该精确revision。
8. 从D导师实际账号打开课件，完成登录、返回、打开、播放和关闭流程。
9. 验收通过后发布为Released，并让后续Production Classroom可以选择该版本。
10. 更新所有D导师课件入口和剧本包绑定，禁止继续指向本地文件或不存在的revision。
11. 记录最终可访问URL、revision、digest、release时间和回退版本。

## 六、认证与URL行为

当前URL首先进入登录页，因此需要明确课程访问策略：

- D导师和有权限的Admin DM登录后可以访问。
- 没有课程权限的普通账号得到明确的403／无权限页面，而不是含糊404或空白。
- 未登录用户跳转登录后，应返回原始课件地址。
- 登录跳转必须保留精确revision；当前检查观察到 `returnTo` 丢失 `?revision=0`，需要修复或给出明确的统一版本解析规则。
- 如果PPT支持 `?slide=数字`，还要验证它能与revision同时存在，例如：

```text
/course/development-mentor-field-kit/?revision=1&slide=6
```

- 退出登录后浏览器后退不得继续读取受保护课件内容。

## 七、资源与播放验收

线上部署后至少检查：

- 所有HTML、图片和本地资源均为200，无404和混合内容。
- CSP允许课件自身必要的样式、脚本和图片，但不放宽为不受控外部资源。
- 相对路径在 `/course/{slug}/` 下解析正确。
- 页面不会因为站点顶部栏、登录布局或Courseware外壳破坏16:9舞台。
- 空格、回车、左右方向键、Home、End、`F`、`O`、`P`均可用。
- `revision`、`slide`及其他参数不会互相覆盖。
- 浏览器刷新后仍停留在同一确定课件revision。
- 打印和总览不会显示站点无关导航或泄露其他课堂信息。
- 桌面常用视口无溢出，D导师电脑投影播放稳定。
- 浏览器控制台无错误，课件外壳和静态资源无404。

## 八、Studio与Classroom验收

### Studio Courseware

- 可以在课件库中看到标题、slug、D导师归属、revision、digest和发布状态。
- 可以打开Candidate和Released的精确版本预览。
- 新版本不会静默覆盖正在运行的Classroom。
- 可以查看来源、发布时间和回退版本。

### Test Classroom

- D导师卡片或弹窗显示正确课件入口。
- 链接打开的是该Classroom绑定的精确revision，而不是“最新版本”漂移链接。
- DM后退、刷新或恢复课堂不会改变已绑定课件版本。
- T-090的开发导师剧本最终可以引用同一courseware revision。

### Production Classroom

- 只有Released版本可被新生产课堂选择。
- 已经开始的课堂继续使用锁定revision，后续发布不静默替换。
- 需要升级时由Admin DM显式创建或选择新版本，并保留审计记录。

## 九、最小验收矩阵

```text
未登录访问          跳转登录，并保留完整returnTo与revision
D导师账号           可以打开绑定的精确课件版本
Admin DM            可以预览、绑定和检查版本
无权限学员           不可直接进入导师课件
Studio Preview      Candidate与Released均可按revision查看
Test Classroom      D导师入口打开锁定revision
Production          只允许选择Released版本
回退测试             老revision仍可读取，新课堂可显式选择回退版本
```

## 十、验收标准

- [x] 本地18页D导师课件重新通过T-089自动化验收。
- [x] `development-mentor-ligun` 已注册为D导师 `CoursewarePackage`。
- [x] 课件拥有确定revision和digest，而不是只存在于本地目录。
- [x] Studio Courseware能够查看和播放该精确版本。
- [x] Test Classroom中的D导师入口能够打开该精确版本。
- [x] 正式URL登录后返回课件，不再出现缺包、空白或错误404。
- [x] 登录跳转保留revision；`revision`、`slide`与`step`参数可以共存。
- [x] 所有静态资源加载成功，自动化浏览器验收控制台无错误。
- [x] 课件快捷键、逐步揭示、总览、全屏和打印通过 exact 发布字节的浏览器验收。
- [x] Courseware r0 已标记为Released，可供后续 Production Classroom 精确选择。
- [x] 线上D导师入口不引用本地绝对路径，也不自动漂移到未知最新版。
- [x] 最终URL、revision、digest、发布时间和回退方式写入完成回执。

## 十一、非目标

- 不在本任务中重写18页课件内容；内容更新仍回到T-089的后续revision。
- 不制作开发导师剧本组课件；该工作属于T-090。
- 不迁移饿了么产品导师内容；该工作属于T-091。
- 不让课件部署绕过Courseware版本、审核和发布流程。
- 不因为测试URL写了`revision=0`就直接覆盖或伪造该revision。

## 十二、2026-09-09 生产进度

```text
URL             https://minisv.vip/course/development-mentor-ligun/?revision=0
Deep link       https://minisv.vip/course/development-mentor-ligun/?revision=0&slide=6&step=2
Package         cw-development-mentor-ligun
Courseware      r0 · cafb8878e710a698237631523428dff7e0832180415c1b5605acbe6f3ddcf69d
Content tree    ad6165eb01db16ad744bbfffba9fa016f5dc02e3abb5ad589fff68c30ab35234
Hecate release  20260909T223953CST-t090-t093-course-release-r3
T-090 Candidate eleme-2008-find-problem r10
Course digest   bbb3d912b94b93127422d83cd03c1ad1aca3119b48f38797af1718dc99db281a
```

已验证：

- 匿名静态课件请求返回 `401`。
- D 导师账号登录、Course 外壳、静态课件均返回 `200`。
- 登录往返完整保留 `revision=0&slide=6&step=2`。
- Studio exact 验收深链登录往返完整保留 `course`、`revision` 与 `digest`。
- 受保护课件返回 `private, no-store`，同时保留 Hecate 来源标识和全套安全响应头。
- Hecate healthcheck 与公网 smoke 通过；生产数据未重置。

待团队人工完成：

1. 在 Studio 多角色视图验收 r10 并签发 `ViewAcceptanceReceipt`。
2. 由同一 exact Candidate 创建 Test Classroom，跑完实际课堂 UI 验收。
3. 签发 `UiAcceptanceReceipt` 后发布课程 r10，并验证新 Production Classroom 的 exact 绑定。

生产证据：`docs/TODO_090_093_PRODUCTION_DEPLOYMENT_RECEIPT.json`。

## 2026-09-10 完成回执

- 最终稳定身份：`cw-development-mentor-ligun / development-mentor-ligun / r0`。
- registry digest：`cafb8878e710a698237631523428dff7e0832180415c1b5605acbe6f3ddcf69d`。
- 18 页课件、2／4／6 人 Test Classroom exact 绑定、D B05—B08、进度跳转和 D→M 交接均通过。
- 已随 Hecate release `20260910T020748CST-t095-t096-course-platform-r3` 上线统一 `/course/`；真实导师和学员登录均可只读打开。

