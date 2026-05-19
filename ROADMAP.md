# Roadmap

Anydocs 的高层演进路线。详细的 epic / story 拆解见 [`artifacts/bmad/planning-artifacts/epics.md`](artifacts/bmad/planning-artifacts/epics.md)。

---

## 当前状态（v1.0）

已可用：

- **Studio**：本地优先的三栏编辑器（导航 + Yoopta 编辑器 + 元数据），支持 `draft / in_review / published` 三态
- **CLI**：`init / build / preview / studio / project / page / nav / import / convert-import / workflow`
- **MCP 服务**：33 个工具（9 个 `project_*` + 18 个 `page_*` + 6 个 `nav_*`），通过 stdio 暴露，给外部 AI Agent 使用
- **构建产物**：reader 站点 + MiniSearch 索引 + `llms.txt` + MCP 静态快照
- **内容模型**：`doc-content-v1` 受限块 schema，slug 唯一性 + navigation 引用有效性校验

定位：**为 AI Agent 而设计的文档系统**。覆盖内部 PRD、技术设计、ADR、API 规范、对外开发者站点。
不与 Notion / 飞书（协作笔记）和 GitBook / Mintlify（托管发布）正面竞争。

---

## 近期路线图

按依赖关系和优先级排序。**不建议并行三条线**——核心代码量已不小，并发开发会撕裂架构一致性。

### v0.2 — 内置 AI 对话式编辑（BYOK）

**目标**：把"AI 写文档"的门槛降到零。用户不需要先装 Cursor / Claude Code，打开 Studio 就能让 AI 起草、改写、补全。

**范围（in scope）**
- Studio 右侧 chat sidebar
- 后端复用现有 MCP 工具集（同一套 schema 校验、同一套权限边界）
- 当前页面 / 选中块自动作为 context 注入
- BYOK：用户自带 Anthropic / OpenAI / 本地 Ollama 的 API Key，配置存本地

**显式 out of scope**
- 行内 inline 润色（Notion AI 那种）——是 editor plugin 工作量，超出 chat 范畴
- 托管 LLM 服务 / 计费 / 多模型路由
- 多轮 agent 任务编排（agent loop 留给外部 Cursor/Claude Code 那条路径）

**为什么先做这个**
- 工程量最小（2-4 周），复用 MCP 不需要新增编辑路径
- 开源 README 的杀手锏 demo
- 反向压力测试 MCP 设计是否真的够用

**依赖**：无。

---

### v0.3 — HTTP MCP + Self-hosted Docker 部署

**目标**：让一个团队（5-50 人）共享一个 Anydocs 实例，而不是每人本地起一套。同时让远程 AI Agent 能接入。

**范围（in scope）**
- HTTP MCP transport，与现有 stdio transport 平行
- 鉴权：单 admin token 起步，之后加 GitHub / OIDC OAuth
- 只读 MCP profile（给生产环境的 Agent 用）
- `/api/local/*` 加 auth 中间件
- 文件存储仍走 FS，但跑在服务器上
- Docker compose 一键部署，覆盖 Studio + reader + MCP 三个 surface

**显式 out of scope**
- 多租户 SaaS（留给后面）
- 数据库后端（FS 仍是 source of truth）
- 复杂 RBAC（admin / editor / viewer 三级足够 v0.3）
- **不删除本地优先模式**——它是核心差异化

**为什么必须做**
- 团队场景的硬前置依赖
- v0.4 协作 review 必须建在共享后端上
- 远程 HTTP MCP 解锁 Agent 团队共享的新场景

**依赖**：无（与 v0.2 解耦，但建议在 v0.2 之后）。

**预估**：1-2 个月。

---

### v0.4 — 协作 Review 工作流

**目标**：让现在死的三态状态机（`draft → in_review → published`）真正跑起来。AI 写完、人审一遍、合入发布。

**范围（in scope）**
- "Submit for review" 按钮（draft → in_review）
- Reviewer 视图：与上一个 published 版本的 **block-level diff**
- **块级 threaded 评论**（按 block id 锚定）
- Approve / Request changes → published / 退回 draft
- 评审历史记录

**显式 out of scope**
- 行内 inline 评论 / 建议修改（accept-reject changes）——是 Notion 的场
- 实时协同光标 / co-editing
- @提及通知 / 邮件集成
- 评审解决追踪 / SLA

**为什么是这个形态**
- 直击你最初的痛点："文档质量参差、无人审核"
- 跟 Docusaurus / Mintlify / GitBook 拉开差距（它们都没有原生 review）
- 严格控制 scope，避免滑向 Notion 协作工具的复杂度

**依赖**：v0.3（必须在远程部署上跑，本地 FS 模式下 review 体验别扭）。

**预估**：1-2 个月。

---

## 中长期方向（v0.5+）

按市场反馈和上游 v0.2-v0.4 的真实使用情况再决定优先级。

- **多项目工作台完成**：路由层真正的 project 隔离（当前 `resolveProjectRoot` 是占位实现），ProjectSwitcher 接入 Studio 主循环
- **Managed Cloud**：v0.3 验证有真实付费需求后再做。多租户、SSO、计费、备份
- **基于 diff 的增量更新**：MCP 工具支持 patch 级修改，而不只是整页 CRUD
- **代码 → 文档自动生成**：从 OpenAPI / TypeScript 类型 / 代码注释生成或更新页面
- **Desktop 应用收尾**：[`packages/desktop/README.md`](packages/desktop/README.md) 明确写了"will be wired in later"，Tauri 壳已搭好但业务未接入
- **进阶 reader 体验**：跟 GitBook / Mintlify 缩短差距——版本切换、AI 摘要、analytics

---

## 不在 roadmap 里的事

明确声明不做，避免 scope 扩散：

- ❌ 取代 Notion / 飞书 的协作笔记
- ❌ 取代 GitBook / Mintlify 的托管 SaaS（v0.5+ 的 Managed Cloud 是补充而非取代）
- ❌ 内置 Git 提交 / 评审 / 发布流程——交给外部 Git 工具
- ❌ 富 layout 块（columns、embeds、databases）——违背"受限 schema 让 AI 写出合规文档"的根基
- ❌ 实时协同编辑（Yjs / CRDT）——是 Notion 的护城河，不是我们的战场

---

## 参与方式

- 提 issue 讨论 roadmap 优先级
- 看 [`artifacts/bmad/planning-artifacts/epics.md`](artifacts/bmad/planning-artifacts/epics.md) 了解已有 epic / story 的颗粒度
- 看 [`CLAUDE.md`](CLAUDE.md) 了解架构边界和开发约束
