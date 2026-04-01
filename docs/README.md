# Anydocs Docs Index

当前 `docs/` 目录只保留运行文档与集成说明。BMAD 相关规划、实现与测试产物已迁移到 `../artifacts/bmad/`，与普通文档分开维护。

## Runtime Docs

- [04-usage-manual.md](04-usage-manual.md): 详细操作手册，覆盖启动、编辑、构建、预览、导入和部署
- [05-dev-guide.md](05-dev-guide.md): 面向开发者的开发与验证指南
- [06-classic-docs-theme-config.md](06-classic-docs-theme-config.md): `classic-docs` 阅读主题配置说明
- [07-agent-integration.md](07-agent-integration.md): Codex / Claude Code 与 Anydocs MCP 的集成方式
- [08-ai-first-ci.md](08-ai-first-ci.md): 面向公司内部的 AI-First CI 与外部 AI reviewer 落地指南
- [skill.md](skill.md): 项目内 agent guide 模板，指导 agent 通过 MCP 使用 Anydocs

## BMAD Artifacts

- [../artifacts/bmad/README.md](../artifacts/bmad/README.md): BMAD 产物总索引
- [../artifacts/bmad/planning-artifacts/prd.md](../artifacts/bmad/planning-artifacts/prd.md): 产品需求文档
- [../artifacts/bmad/planning-artifacts/architecture.md](../artifacts/bmad/planning-artifacts/architecture.md): 架构设计文档
- [../artifacts/bmad/planning-artifacts/epics.md](../artifacts/bmad/planning-artifacts/epics.md): Epic 与 Story 分解
- [../artifacts/bmad/implementation-artifacts/sprint-status.yaml](../artifacts/bmad/implementation-artifacts/sprint-status.yaml): Sprint 状态
- [../artifacts/bmad/implementation-artifacts/tech-spec-ai-readable-artifacts-and-find-search.md](../artifacts/bmad/implementation-artifacts/tech-spec-ai-readable-artifacts-and-find-search.md): AI 可读产物与 `Find` 搜索技术规格
- [../artifacts/bmad/test-artifacts/automation-summary.md](../artifacts/bmad/test-artifacts/automation-summary.md): 自动化测试总结

## Notes

- 旧的 `00-index.md`、`01-project-status.md`、`02-editor-spec.md`、`03-repositioning.md` 已移除。
- 规划与实现上下文现在主要由 `../artifacts/bmad/planning-artifacts/architecture.md`、`../artifacts/bmad/planning-artifacts/prd.md`、`../artifacts/bmad/planning-artifacts/epics.md` 承接。
