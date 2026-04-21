# Anydocs Design Index

这是 Anydocs 的设计入口文档。后续所有面向产品界面的设计决策，都优先从这里开始，再分别进入 Reader 和 Studio 的 surface 规范。

## 先读什么

1. [docs/design-system.md](docs/design-system.md) - 共享设计系统、语义 token、组件规则
2. [docs/reader-design.md](docs/reader-design.md) - 阅读站的布局、内容密度和交互规范
3. [docs/studio-design.md](docs/studio-design.md) - Studio 的工作台、编辑器和设置面板规范
4. [docs/reader-theme-guide.md](docs/reader-theme-guide.md) - Reader 主题选择指南
5. [docs/classic-docs-theme-config.md](docs/classic-docs-theme-config.md) - 现有 classic-docs 主题配置说明

## 设计目标

- Reader 像成熟的开发者文档产品，不像博客
- Studio 像专业工作台，不像普通内容管理后台
- 全站共享同一套语义 token，但不同 surface 有不同布局、chrome 和信息密度
- Reader 和 Studio 不是同一个界面的两种皮肤，它们应当明显不同
- 默认避免 indigo / violet 作为主品牌色
- 少做装饰，多做层级、间距和可读性

## 落地原则

- 先定共享 token，再定 Reader / Studio 的结构
- 新主题或新 surface 先对齐这份索引，再扩展局部规则
- 所有品牌覆盖优先走 `site.theme.*`，不要混进页面内容模型
- Reader 的主题可以不同，且应该根据阅读场景选择不同 chrome，不要强行统一成同一套壳层
- 新设计如果不能解释为什么适合 Anydocs，就不要加
