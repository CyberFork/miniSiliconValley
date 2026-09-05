# Course Studio 发布说明

发布：`20260905T113036Z-course-studio-r2`
入口：<https://minisv.vip/control/editor/>
权限：`admin` / `mentor`

本次完成：

- Google、饿了么继续作为内置 JSON 课程；主控选课改为动态读取已发布课程库。
- 课程包固定为 5 大步 / 13 小块 / 每块 8 席任务，服务端给出 JSONPath 错误。
- 新增结构化课程编辑器、JSON 源码编辑、导入、导出、校验、草稿、发布和克隆。
- 新增草稿/发布/历史三层持久目录、原子写入和修订冲突保护。
- 正在运行的课堂固定使用开课时 JSON；服务重启也不会换稿。重置或新 Run 才加载最新版。
- 新增 JSON Schema、中性完整模板和课程实施 SOP。
- 生产部署仍完全位于 Hecate；未修改 `cyberforker.com` 主站。

验证：LIVE RUN/编辑器 18 项、网关/发布 7 项均通过；生产登录后页面、CSS、JS 与课程目录 API 均返回 200。
