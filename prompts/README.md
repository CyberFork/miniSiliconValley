# 公开提示词中心

固定入口：`https://minisv.vip/prompts/`。无需课程账号。

- 通用项目入口：`https://minisv.vip/prompts/general/`；游戏版仍为 `/prompts/`，两者通过分类导航切换。
- `general-project/student-prompt.txt` 面向工具、服务、活动、实物与内容项目，先按项目类型补缺口，不默认软件，仍只交付实施文档。
- `game-development/student-prompt.txt` 是当前游戏开发提示词的唯一可编辑正文。
- `game-development/` 同时维护策划输入、复制与降级选择的页面；仅在浏览器内存中处理输入，不上传、不保存策划。
- `node prompts/build.mjs OUTPUT_DIRECTORY` 独立生成公开站点文件及 SHA-256 清单，无需构建课件或安装依赖。
- 课件普通构建及 r24 维护脚本消费同一构建函数。历史不可变课件保留原字节；固定 workbook 入口转向 `/prompts/`。
- 发布公共中心无需增加课件 revision，不修改教师资料访问权限。这里只公开使用入口，不改变整个仓库的可见性或许可证。

验证：`node prompts/tests/verify.mjs`，以及现有 `verify-student-prompt.mjs`、`verify-workbook.mjs`；通用版另运行 `node prompts/tests/verify-general.mjs`。
