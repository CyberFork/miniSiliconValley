# T-096 + T-092｜统一登录课件目录与 P/D 课件上线

## 统一入口

```text
/course/                                  登录后 Released 课件目录
/course/product-mentor-foundations/       P 课件播放器壳
/course/development-mentor-ligun/         D 课件播放器壳
/courseware/product-mentor-foundations/   P 固定静态资源（网关鉴权）
/courseware/development-mentor-ligun/     D 固定静态资源（网关鉴权）
```

目录来自 CoursewarePackage 注册表，不硬编码假卡片。当前只列出真实已发布的 P、D 静态课件；系统内部 M/O fallback 不伪装成正式课件。

## 身份与权限

- admin、mentor、learner 登录后均可只读访问 Released 目录和播放器。
- learner 不显示 Studio 管理入口。
- anonymous 访问动态目录／播放器会跳到登录，并保留 slug、revision、slide、step。
- Candidate、Draft、observer、Test impersonation 和未完成一次性密码设置均不能进入课件库。
- P/D 原始静态目录统一经过同一个 cookie-only `auth_request`；匿名直接访问返回 401；允许网关返回小型通用 401 错误页，但不得包含任何课件正文或课件指纹。
- 原始静态响应使用 `private, no-store, no-transform`，退出后不能靠共享缓存重新看到课件。

## 不可变身份

P：

```text
packageId: cw-product-mentor-foundations
slug: product-mentor-foundations
revision: 0
digest: b2852b39462bc05464582b3c36f773e68fa84775b9e7c7673a128fac97d7cda5
source commit: 679213a61b835335016eac7649213983a0e48489
source tree: 3a041c4714190cc026f6de8e06e15cec0e5f765d
```

D：

```text
packageId: cw-development-mentor-ligun
slug: development-mentor-ligun
revision: 0
digest: cafb8878e710a698237631523428dff7e0832180415c1b5605acbe6f3ddcf69d
static content tree: ad6165eb01db16ad744bbfffba9fa016f5dc02e3abb5ad589fff68c30ab35234
slides: 18
```

没有创建 `development-mentor-field-kit` 的第二套正式 slug。旧系统 fallback 仍只供尚无真实课件时的课堂工厂内部使用，不进入 `/course/`。

## T-093 进度条

D 课件进度条是 18 段真实按钮：

- 已解锁段可点击、Tab 聚焦、Enter/Space 打开。
- 当前段高亮但不误触发下一步。
- 未解锁段 disabled，不泄露正文。
- 进度点击阻止冒泡，不触发幻灯片前进。
- URL 始终保留 revision，并同步 slide/step；刷新可恢复。

## 发布边界

代码部署与“把一个新 CourseDefinition 发布为 Production”是两件事。此次部署可以上线目录、认证、播放器和 T-095 Candidate 导入能力；新的课程 Released 仍必须由团队完成 View + Test Classroom UI 两级人工验收，系统不代签回执。


## 2026-09-10 生产部署

- Hecate release：`20260910T020748CST-t095-t096-course-platform-r3`。
- Git source：`b397f21e2b1ba45e29559c3b814ea159dbca20ad`。
- T-095 统一课程已作为 `eleme-2008-find-problem r11` Candidate 导入，digest 为 `5dde44ae…c2c33`。
- 真实导师与真实学员账号均已验收 `/course/`、P r0、D r0 和两套受保护静态资源。
- P 课件继续复用已批准整树 `34769769…35b04`，没有因重新编译产生无意义的字节漂移。
- 新 Candidate 未签发人工 View/UI 回执，未进入 Released，也未创建 Production Classroom。

完整机器回执：`TODO_091_096_PRODUCTION_DEPLOYMENT_RECEIPT.json`。
