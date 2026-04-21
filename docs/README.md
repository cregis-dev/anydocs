# Anydocs Docs Index

当前 `docs/` 目录只保留仍然有独立维护价值的运行文档、模板和内部流程说明。通用的 agent 集成说明已并回根 [README](../README.md)；BMAD 相关规划、实现与测试产物继续放在 `../artifacts/bmad/`。

## Start Here

- [usage-manual.md](usage-manual.md): 日常使用入口，覆盖初始化、Studio、build、preview、导入与 Markdown 迁移
- [developer-guide.md](developer-guide.md): 面向仓库维护者的开发、验证和调试指南
- [runtime-architecture.md](runtime-architecture.md): Studio / Reader runtime 边界、env contract 与路由策略
- [agent.md](agent.md): 项目根最小 agent guide 模板

## Product Docs

- [classic-docs-theme-config.md](classic-docs-theme-config.md): `classic-docs` 阅读主题配置说明
- [reader-theme-guide.md](reader-theme-guide.md): Reader 主题选择指南
- [design-system.md](design-system.md): Anydocs 共享设计系统与统一 token 规范
- [reader-design.md](reader-design.md): Reader surface 设计规范
- [studio-design.md](studio-design.md): Studio surface 设计规范

## Templates

- [claude-code-commands/](claude-code-commands): Claude Code slash command 模板

## Internal

- [ai-first-ci.md](ai-first-ci.md): 面向公司内部的 AI-First CI 与外部 AI reviewer 落地指南

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
- 已删除单独的 `agent-integration.md`；必要的 MCP 接入说明现在以更短形式放在根 `README.md`。
- 规划与实现上下文现在主要由 `../artifacts/bmad/planning-artifacts/architecture.md`、`../artifacts/bmad/planning-artifacts/prd.md`、`../artifacts/bmad/planning-artifacts/epics.md` 承接。
