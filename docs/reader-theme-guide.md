# Reader Theme Guide

这份文档用于选择 Reader 主题。它只讨论阅读站，不讨论 Studio。

## 先说结论

- 如果不确定，默认用 `classic-docs`
- 如果你的内容是多知识域结构，优先考虑 `atlas-docs`
- 如果你的内容更偏内部文档、PRD、技术评审或知识库，优先考虑 `blueprint-review`
- Reader 的不同主题可以不同，且不需要长得一样
- 主题不是品牌皮肤的简单换色，而是阅读壳层和导航结构的选择

## 选择维度

### 1. 导航拓扑

先看导航结构，而不是颜色。

- 单层或弱分层导航：`classic-docs`
- 有明显站点级导航，再配局部侧栏：`atlas-docs`
- 深层级文件树、内部门类、review 目录：`blueprint-review`

### 2. 内容类型

- 通用产品文档：`classic-docs`
- API、SDK、指南、参考资料混合：`atlas-docs`
- 内部 PRD、技术方案、评审说明：`blueprint-review`

### 3. 读者目标

- 先找内容，再深入阅读：`classic-docs`
- 在多个知识域之间跳转：`atlas-docs`
- 逐层浏览、强目录感、偏内部协作：`blueprint-review`

## 现有主题定位

| 主题 | 定位 | 适合什么 |
| --- | --- | --- |
| `classic-docs` | neutral / product docs | 通用产品文档、入门指南、混合型参考内容 |
| `atlas-docs` | structured / product docs | API、SDK、指南与参考文档并存的站点 |
| `blueprint-review` | internal / review / content-first | 内部 PRD、技术规范、评审笔记、知识库 |

## 使用建议

### 默认策略

- 新项目或不确定场景：先上 `classic-docs`
- 只要内容结构开始分域，就评估 `atlas-docs`
- 纯内部阅读场景，不要硬套面向外部用户的 Reader 壳层

### 不要这么选

- 不要先选颜色，再选主题
- 不要把 Reader 主题当作 Studio 主题
- 不要为了“看起来高级”选不符合内容结构的主题
- 不要让主题选择掩盖信息架构问题

## 与设计系统的关系

这份指南和 [design-system.md](design-system.md) 的关系是：

- design-system 定义共享 token 和通用原则
- theme-guide 决定 Reader 该用哪种壳层和导航拓扑
- 主题可以不同，但都应该遵守同一套设计语言

