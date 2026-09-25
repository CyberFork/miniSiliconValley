---
type: todo
id: T-096
title: "完善登录后课件目录并首先导入发布P导师课件"
status: completed
created: 2026-09-09
updated: 2026-09-10
captured_by: project-inbox
courseware_role: P
priority: P0
estimated_effort: small-medium
depends_on:
  - T-091
  - T-094
  - T-095
related:
  - T-085
  - T-086
  - T-092
tags:
  - todo
  - mini-silicon-valley
  - courseware-library
  - product-mentor
  - authentication
  - deployment
  - release
  - catalog
---

# 完善登录后课件目录并首先导入发布P导师课件

## 一、现场判断

用户登录后访问：

```text
https://minisv.vip/course/
```

看不到已经存在的P／产品导师课件和D／开发导师课件。

当前检查结果：

- `/course/`路由已经存在。
- 未登录请求会收到`307`并跳转到`/auth/login?returnTo=%2Fcourse%2F`，因此顶层认证门已经生效。
- P导师课件源码与完整资源已经归集在cowork目录。
- D导师18页课件也已经在cowork目录完成本地制作和验收。
- 当前dev仓库中没有`public/courseware/`目录，也没有找到P、D两个课件slug的注册或导入记录。
- T-090／T-091完成回执中提到的Candidate和`public/courseware/development-mentor-ligun/`在当前工作树中并不存在，不能据此认为课件已经进入当前发布包。

因此当前更可能是：**认证课件目录路由已经存在，但P、D课件尚未作为CoursewarePackage进入当前应用和线上发布数据**。不是两份课件源码不存在，而是“源码归集、课程包导入、目录登记和线上发布”之间还没有完成闭环。

## 二、产品决策

### `/course/`的职责

```text
/course/
登录后的课件目录／课件库首页

/course/{slug}/
播放某一套导师HTML课件
```

`/course/`不再直接承载旧P导师整站，也不代表完整课程真值。旧P课件需要迁入一个独立slug；D课件由T-092随后使用同一机制上线。

### 第一优先上线P导师

真实课堂首先由P／产品导师进入，因此本任务优先完成：

```text
P导师课件源码
→ CoursewarePackage
→ Candidate
→ Studio Preview
→ Test Classroom
→ Released
→ /course/目录可见
```

D导师课件在T-092中完成导入后，自动出现在同一课件目录，不再建设第二套目录。

## 三、权威源码

### P／产品导师

```text
/Users/hecate/Library/CloudStorage/OneDrive-个人/Work/CHJ、DL/AI教培-mini硅谷/cowork/课件/product-courseware/
```

入口：

```text
course/index.html
```

归集清单：

```text
manifest.json
```

该快照来自`origin/chj`的已归集产品课件，但正式导入前仍需按T-094／T-095重新确认courseDataId、revision、digest和字段隔离结果。

### D／开发导师

```text
/Users/hecate/Library/CloudStorage/OneDrive-个人/Work/CHJ、DL/AI教培-mini硅谷/cowork/课件/dev/mentor-development-deck/
```

本任务只建立其目录容纳能力；D课件具体导入、进度条和发布由T-093、T-092完成。

## 四、建议的稳定slug

```text
/course/product-mentor-field-kit/
/course/development-mentor-field-kit/
```

如果系统已有正式slug，以数据库／CoursewarePackage记录为准，但必须做到：

- slug稳定，不随标题或revision改变。
- `/course/`只负责列出目录，不重新兼任P课件本身。
- 旧P课件入口如需兼容，应跳转到P的新slug，并保留能够保留的深链参数。
- 每个课件页面显示角色、标题、coursewareId、revision和短digest。

## 五、认证和可见性

用户已确认：**导师和学生登录后都可以看到课件目录及P、D已发布课件；未登录访问必须跳转登录。**

### 未登录

- 访问`/course/`跳转登录，并保留`returnTo=/course/`。
- 访问`/course/{slug}/?revision=...&slide=...`跳转登录，并保留完整路径和所有查询参数。
- 登录成功后返回原本请求的课件页面，而不是统一返回主页或丢失revision。

### 已登录导师

- 可以打开`/course/`并看到所有对其开放的Released课件。
- 可以打开P、D课件并按精确revision播放。
- 普通导师不能在该目录直接执行导入、覆盖、发布或删除操作；管理操作留在Studio并服从RBAC。

### 已登录学生

- 可以打开`/course/`并看到P、D已经Released且允许课堂使用的课件。
- 可以只读播放，不显示编辑、上传、发布、删除或权限管理按钮。
- 课件页面不得泄露导师私密讲稿、rubric、其他学生手牌或Classroom管理数据。

### 无权限与失效版本

- 已登录但无权访问的资源返回明确403页面。
- 不存在的slug或revision返回明确404，不退回空目录。
- Candidate和Draft只在Studio中对有权人员可见，不出现在学生课件目录。

## 六、课件目录内容

`/course/`至少以真实CoursewarePackage注册表生成卡片，不硬编码两条URL。每张课件卡显示：

- P／D／M／O导师角色。
- 课件标题和简短说明。
- 建议时长与适用课堂。
- Released revision。
- 短Digest短码或“课程信息”入口。
- 打开课件按钮。
- 当前是否已被某个Classroom绑定；该信息仅在有权限时显示。

第一版至少出现：

```text
P · 产品导师课件
D · 开发导师课件（T-092完成后）
```

M、O尚未上传时显示为空位、筹备中或不显示，不能伪造不存在的课件。

## 七、CoursewarePackage导入

P导师第一版建议建立：

```text
coursewareId: CW-P-PRODUCT-FIELD-KIT
slug: product-mentor-field-kit
mentorRole: P
format: html-site
sourceManifest: product-courseware/manifest.json
```

导入流程：

1. 校验manifest列出的全部文件、字节数和SHA-256。
2. 核对HTML的`/course/`旧基础路径，修复为独立slug后仍能加载的资源路径。
3. 生成不可变Courseware revision和digest，不直接覆盖旧发布。
4. 在`/studio/courseware/`创建Candidate并完成只读预览。
5. 创建Test Classroom，使用P导师和学生账号分别打开。
6. 检查资源、深链、返回目录、全屏、刷新和浏览器控制台。
7. 通过验收后签发Released并加入`/course/`目录。
8. 保存来源版本、manifest摘要、Courseware revision、发布时间和回退版本。

## 八、目录与播放页一致性

- 目录卡片引用确定的CoursewarePackage和Released revision。
- 点击后打开相同coursewareId、revision和digest。
- 课件播放器返回目录时保持用户会话。
- 新revision发布后，目录“最新版”指向新版本；已开始Classroom继续使用其锁定版本。
- 学生从Classroom打开导师课件时，只能看到该Classroom绑定的精确版本。
- 目录直接打开可以进入当前Released版本，但界面应显示实际revision。

## 九、测试矩阵

```text
匿名访问/course/                  跳转登录，保留returnTo
匿名访问P/D深链                   跳转登录，保留slug、revision、slide
导师访问目录                      看到P和已发布D课件
学生访问目录                      看到P和已发布D课件，可只读播放
学生访问Candidate                 403或404，不泄露内容
P导师课件                         所有manifest资源加载成功
D导师课件                         由T-092完成后出现在同一目录
不存在slug                        明确404
不存在revision                    明确404
退出后浏览器后退                  不重新显示受保护课件
```

## 十、验收标准

- [x] `/course/`是可用的登录后课件目录，不再是空页面或旧P整站入口。
- [x] 未登录访问目录或课件深链均跳转登录。
- [x] 登录跳转保留完整`returnTo`、slug、revision、slide和step参数。
- [x] 导师和学生登录后都能看到所有允许其查看的Released导师课件。
- [x] 学生只能只读播放，无法访问Courseware管理操作或导师私密信息。
- [x] P导师课件以独立CoursewarePackage、slug、revision和digest上线。
- [x] `/course/product-mentor-field-kit/`或最终确认的P稳定slug可以播放全部资源。
- [x] T-092完成后，D导师课件自动显示在同一目录。
- [x] 目录内容来自CoursewarePackage注册表，不是前端硬编码链接。
- [x] 旧P课件`/course/`基础路径迁移后没有资源404或路由冲突。
- [x] Studio Preview、Test Classroom和课件目录打开的是同一Courseware revision。
- [x] 完成回执记录最终URL、coursewareId、revision、digest、发布时间和回退方式。

## 十一、非目标

- 不把`/course/`重新定义为完整课程或CourseDefinition编辑器。
- 不允许未登录用户绕过登录直接读取HTML、图片或脚本资源。
- 不把Candidate或Draft暴露给普通学生。
- 不在本任务中重写P导师课件内容；内容收敛由T-091负责。
- 不在本任务中部署D导师课件；D部署继续由T-092负责。
- 不为P、D分别开发两套课件目录、认证逻辑或播放器。

## 2026-09-10 完成回执

- `/course/` 已成为注册表驱动的登录后 Released 课件目录；真实导师和学员均可只读访问。
- P：`cw-product-mentor-foundations / product-mentor-foundations / r0`。
- D：`cw-development-mentor-ligun / development-mentor-ligun / r0`。
- 匿名目录／深链回登录并保留 `revision/slide/step`；P/D 原始静态资源共用 cookie-only gate 与 `private, no-store, no-transform`。
- 系统 M/O fallback、Draft、Candidate、observer 和 Test impersonation 均不会出现在目录。
- 生产 release：`20260910T020748CST-t095-t096-course-platform-r3`；完整回执见仓库 `docs/TODO_091_096_PRODUCTION_DEPLOYMENT_RECEIPT.json`。

