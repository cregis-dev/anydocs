---
stepsCompleted:
  - step-01-init
  - step-01b-continue
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
  - step-e-01-discovery
  - step-e-02-review
  - step-e-03-edit
inputDocuments:
  - .trae/documents/PRD_DocEditor_v2.md
  - .trae/documents/TECH_DocEditor_v2.md
  - .trae/documents/DESIGN_DocEditor_v2.md
  - .trae/documents/SPEC_AIOutputs_llms_webmcp_v2.md
  - docs/README.md
  - docs/04-usage-manual.md
  - docs/05-dev-guide.md
workflowType: 'prd'
workflow: 'edit'
classification:
  projectType: 'CLI 工具 + 文档编译器'
  domain: '开发者工具 (Documentation)'
  complexity: 'medium'
  projectContext: 'brownfield'
lastEdited: '2026-03-11'
editHistory:
  - date: '2026-03-11'
    changes: 'Fixed critical validation findings for NFR measurability, traceability, and Phase 1 scope alignment.'
  - date: '2026-03-11'
    changes: 'Revised remaining NFRs to add measurable verification boundaries and acceptance criteria.'
---

# Product Requirements Document - Anydocs Site Builder

**Author:** Shawn
**Date:** 2026-03-11

---

## Executive Summary

### Vision Alignment

**Anydocs Site Builder** 是一个 AI-First 的文档站点构建工具，让文档维护者（开发者、产品人员）零精力投入编排，专注于内容思考和审核。

**核心能力：**
- 通过自然语言对话，AI 自动生成标准文档结构
- 自动读取已有文档，转换为标准化内容
- 一键构建和发布漂亮的多语言静态站点
- 内置 AI 友好输出（llms.txt），为 LLM/Agent 提供机器可读接口

**解决的问题：**
传统文档工具（GitBook、Docusaurus 等）要求用户手动编排结构、逐页编写、复杂配置，而 Anydocs 通过 AI-First 设计，让结构性工作由 AI 承担，用户只负责内容思考和审核。

---

### What Makes This Special

**产品差异化：**

| 维度 | 传统工具 | Anydocs |
|------|------|------|
| 上手方式 | 手动创建结构、逐页编写 | 几句话生成结构，AI 填充内容 |
| 内容迁移 | 手动复制粘贴 | 自动读取，标准化转换 |
| 发布流程 | 复杂配置 | 简单命令一键发布 |
| AI 整合 | 附加功能 | AI-First，深度整合 |
| 开源/商业 | 商业为主 | 开源免费 |

**核心洞察：**
文档维护者的核心痛点不是"写不出来"，而是"编排耗时"。AI 应该承担结构性工作，让人专注于内容思考和审核。

**为什么选择 Anydocs：**
- AI-First 设计，而非附加功能
- 开源免费，完全适合团队使用
- 本地优先，数据可控
- AI 友好输出，面向 AI 时代

---

### Project Classification

| 维度 | 分类 |
|------|------|
| **项目类型** | CLI 工具 + 文档编译器 |
| **领域** | 开发者工具（Documentation） |
| **复杂性** | 中等（Medium） |
| **项目上下文** | Brownfield（从 Anydocs DocEditor 拆分） |
| **目标用户** | 文档维护者（开发者、产品人员） |
| **终端用户** | 文档读者（访问静态站点） |

**范围边界：**
- ✅ 专注：开发者文档、操作文档
- ❌ 不做：企业官网、博客

---

## Success Criteria

### User Success

| 维度 | 成功标准 |
|------|----------|
| **编辑体验** | 用户可以通过 Studio 完成文档结构与内容的查看、调整和修订 |
| **构建体验** | 一个命令（`anydocs build`）完成站点构建 |
| **预览体验** | 一个命令（`anydocs preview`）启动本地预览，独立端口不与 Studio 冲突 |
| **发布体验** | 构建产物为纯静态文件，支持任意托管平台部署 |
| **标准流程** | 用户可以按统一内容模型组织文档，并稳定构建为站点 |

### Business Success

| 阶段 | 成功标准 |
|------|----------|
| **MVP（流程验证）** | 端到端流程完整，用户可从 0 到构建出站点 |
| **Growth（AI 集成）** | AI 辅助能力上线，用户可导入旧文档自动生成 |
| **Vision（AI-First）** | 自然语言生成完整站点，社区生态成熟 |

### Technical Success

| 指标 | MVP 目标 |
|------|---------|
| **从 0 到站点时间** | < 30 分钟 |
| **100 页站点构建时间** | < 30 秒 |
| **Lighthouse 分数** | ≥ 90 分 |
| **预览启动时间** | < 10 秒 |
| **关键流程可重复性** | 连续 20 次构建/预览循环无残留状态导致的失败 |

### MVP Scope

**包含：**
- ✅ 标准化文档模型与编排规则
- ✅ 基础 Studio（查看、调整、修订）
- ✅ 内容保存落盘（JSON）
- ✅ CLI 命令（`anydocs init` / `anydocs build` / `anydocs preview`）
- ✅ 预览服务（独立端口）
- ✅ 可复用标准流程，可封装为 skill 供外部 AI 使用
- ✅ 默认主题（1 个，基础可用）
- ✅ 稳定的静态站点构建链路

**不包含（后续迭代）：**
- ❌ 产品内置 AI chat（Growth 阶段）
- ❌ 自然语言目录生成原生能力（Growth 阶段）
- ❌ 旧文档批量导入增强能力（Growth 阶段）
- ❌ 完整多语言体验（Growth 阶段）
- ❌ llms.txt / 机器可读输出增强能力（Growth 阶段）
- ❌ 主题市场（Growth 阶段）
- ❌ 一键部署（Growth 阶段）

### Growth Features (Post-MVP)

- 📌 AI 辅助生成文档结构
- 📌 旧文档自动导入和转换
- 📌 AI 内容填充和润色
- 📌 主题市场（用户扩展主题）
- 📌 一键部署（Vercel/Netlify/GitHub Pages）

### Vision (Future)

- 🚀 自然语言生成完整站点（"帮我做一个 API 文档站点"）
- 🚀 智能内容分析和重组
- 🚀 多语言自动翻译
- 🚀 社区生态成熟（主题/插件/模板）

---

## User Journeys

### Journey 1: 文档维护者 - 从 0 到发布站点

**角色背景：**
- **姓名**：Alex，开发者
- **情境**：需要为团队的新项目创建 API 文档，时间紧迫
- **痛点**：之前用 Markdown 手写，格式混乱，多语言维护困难
- **目标**：快速创建一个专业、美观、支持多语言的文档站点

**旅程故事：**

| 阶段 | 情节 |
|------|------|
| **开场** | Alex 刚接手新项目文档任务，需要在 1 小时内搭建好文档框架 |
| **探索** | Alex 安装 Anydocs CLI，运行 `anydocs init` 初始化项目 |
| **编辑** | 使用可视化编辑器创建内容，通过自然描述生成标准文档结构 |
| **构建** | 运行 `anydocs build`，30 秒内完成静态站点构建 |
| **预览** | 运行 `anydocs preview`，在浏览器查看效果（独立端口，不与 Studio 冲突） |
| **发布** | 上传构建产物到 Vercel，文档站点上线 |
| **结局** | 团队成员通过多语言站点阅读文档，Alex 获得好评 |

**旅程揭示的能力需求：**
- ✅ CLI 初始化命令
- ✅ 可视化编辑器集成
- ✅ 快速构建引擎
- ✅ 独立预览服务
- ✅ 静态站点输出

---

### Journey 2: 文档维护者 - 旧文档迁移

**角色背景：**
- **姓名**：Sarah，技术文档工程师
- **情境**：公司有一堆旧的 Markdown 文档，需要迁移到新平台
- **痛点**：手动复制粘贴太慢，格式容易丢失
- **目标**：批量导入旧文档，自动转换为标准化格式

**旅程故事：**

| 阶段 | 情节 |
|------|------|
| **开场** | Sarah 面对数百个 Markdown 文件，发愁如何迁移 |
| **探索** | 发现 Anydocs 支持旧文档导入功能 |
| **导入** | 运行导入命令，自动转换 Markdown 为 canonical content |
| **审核** | 在编辑器中审核转换结果，AI 辅助修正格式问题 |
| **构建** | 一键构建，多语言站点生成 |
| **结局** | 迁移完成，Sarah 有时间优化内容而不是手动搬运 |

**旅程揭示的能力需求：**
- ✅ Markdown 导入和解析
- ✅ Markdown → canonical content 转换
- ✅ 批量处理能力
- ✅ 格式校验和修正

---

### Journey 3: 文档读者 - 访问文档站点

**角色背景：**
- **姓名**：Mike，使用 API 的开发者
- **情境**：遇到 API 使用问题，需要查文档
- **目标**：快速找到所需信息，理解如何使用

**旅程故事：**

| 阶段 | 情节 |
|------|------|
| **开场** | Mike 遇到 API 使用问题，Google 搜索进入文档站点 |
| **搜索** | 通过站点搜索快速找到相关章节 |
| **浏览** | 左侧导航清晰，面包屑引导，快速定位 |
| **阅读** | 页面加载快（Lighthouse ≥ 90），代码示例清晰，可一键复制 |
| **切换语言** | 切换到中文，内容准确翻译 |
| **AI 辅助** | 通过 llms.txt，LLM 可准确理解文档结构并回答问题 |
| **结局** | Mike 快速解决问题，对文档印象良好 |

**旅程揭示的能力需求：**
- ✅ 高性能静态站点
- ✅ 清晰的导航系统
- ✅ 站内搜索功能
- ✅ 多语言切换
- ✅ llms.txt 输出
- ✅ 代码高亮和复制

---

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. AI-First 文档产品范式**
Anydocs 的核心创新不是在传统文档工具的复杂能力上继续堆叠，而是重新定义文档工具的起点：让 AI 承担结构化工作，人负责意图表达、内容判断与最终审核。产品竞争点从“谁的编辑器功能更多”转向“谁更能降低文档成型门槛”。

**2. 挑战“人工编排信息架构是必经步骤”**
当前主流文档工具默认用户要先手动设计目录、页面层级、导航结构，再开始写内容。Anydocs 质疑这个前提，认为很多用户的问题不是不会写内容，而是不擅长把真实项目经验整理成清晰结构。通过自然语言生成目录结构，产品试图把“信息架构设计”从显性劳动转为 AI 辅助能力。

**3. 文档链路的一体化整合**
Anydocs 不只是“带 AI 的编辑器”，而是将以下能力组合成一个闭环：
- 自然语言生成目录结构
- 可视化编辑与本地优先保存
- 静态站点构建与预览
- `llms.txt` 与 WebMCP 机器可读输出

这种组合的创新点在于：既服务人类读者，也服务 AI/Agent 消费场景，把“文档输出”从网页扩展为人机双读的发布对象。

### Market Context & Competitive Landscape

现有文档工具如 GitBook、Docusaurus、Mintlify 等，主要仍建立在“用户负责结构编排，工具负责编辑/渲染/托管”的前提上。即使部分产品开始引入 AI，也多是内容补全、润色、问答等附加能力，而不是把“目录与结构生成”作为核心工作流入口。

Anydocs 的差异化不是“文档里加一点 AI”，而是：
- 把 AI 放在文档生产流程最前面
- 优先降低结构搭建成本，而非只优化最终展示
- 将 AI 消费友好的输出能力纳入产品主链路，而不是边缘插件

这使得 Anydocs 更接近一种新的文档生产范式，而非传统文档站工具的小幅增强版。

### Validation Approach

**首要验证假设：**
用户愿意使用自然语言来生成文档目录结构。

**建议验证方式：**
- 在 MVP 中提供自然语言生成目录结构的核心入口
- 观察用户是否愿意先“描述文档意图”，而不是先手工建树
- 测试生成结果是否足够接近用户预期，减少后续大幅重编排
- 记录用户在生成后手动修改目录的频率与幅度
- 比较“自然语言生成结构”与“纯手工建结构”两种流程的完成时间与满意度

**验证成功信号：**
- 用户能在几轮内得到可接受的目录初稿
- 用户认为 AI 生成结构比从零手工搭建更轻松
- 用户愿意在后续项目中重复使用该入口
- 目录生成成为用户选用 Anydocs 的核心理由之一

### Risk Mitigation

**风险 1：用户觉得 AI 生成的结构不可靠**
- 缓解：保留完整的手工调整能力，允许快速重排、增删、修改层级

**风险 2：创新点不足以支撑独立品类认知**
- 缓解：明确产品定位为 AI-First 文档工作流，而非通用文档站工具替代品

**风险 3：自然语言入口只在演示中成立，真实项目中效果一般**
- 缓解：先聚焦高频、结构相对清晰的文档类型，如开发者文档、产品说明、操作手册

**风险 4：若 AI 结构生成价值不足，产品定位会失焦**
- 缓解：fallback 明确退化为“优秀的本地文档编辑器 + 构建器”，确保即便创新假设未完全成立，MVP 仍具独立价值

## CLI Tool + Developer Tool Specific Requirements

### Project-Type Overview

Anydocs is a hybrid product combining a visual-first Studio with a scriptable CLI. The Studio is the primary entry point for human users, while the CLI provides deterministic project initialization, build, and preview capabilities for developers, automation, and AI-driven workflows.

The product must support both interactive and non-interactive usage modes:
- Interactive usage for human operators creating and managing documentation projects
- Scriptable usage for tools, CI pipelines, and AI agents invoking repeatable commands

### Technical Architecture Considerations

The system should maintain a clear separation between authoring, configuration, and execution:
- Studio acts as the main workspace for visual editing, AI chat, and project configuration
- CLI acts as the execution layer for project bootstrap, build, and preview workflows
- Configuration is stored inside each project and can be generated automatically, edited manually, or updated through Studio
- CLI behavior must be deterministic so it can be invoked reliably by automation and AI systems

This architecture reinforces the product value proposition: humans primarily work through Studio, while repeatable operational tasks remain accessible through commands.

### Command Structure

MVP command surface:
- `anydocs init` to create a new documentation project
- `anydocs build` to generate the static documentation site
- `anydocs preview` to run a local preview server for generated output

Command design requirements:
- Commands should work in both human-invoked and automation-invoked scenarios
- Commands should avoid unnecessary prompts when explicit parameters are provided
- Commands should produce predictable behavior across local and CI environments

### Output Formats

For MVP, CLI output will prioritize human-readable logs:
- Clear progress reporting for initialization, build, and preview
- Actionable error messages when commands fail
- Readable summaries of generated outputs and warnings

Additional machine-readable output formats are not required in MVP, but command behavior should still remain structured enough to support future extension.

### Configuration Schema

Configuration should be project-local and created automatically during project setup:
- A project configuration file is generated as part of initialization
- Users may edit configuration manually in the project
- Studio may also expose configuration editing visually
- CLI flags may override configuration where necessary for execution-time control

This keeps project setup portable, explicit, and compatible with both local workflows and automation.

### Distribution & Installation

The MVP should support lightweight JavaScript ecosystem installation paths:
- Global installation for frequent users
- `npx` or equivalent ephemeral execution for trial and automation scenarios

This lowers adoption friction while preserving a familiar developer-tool workflow.

### Scripting & Automation Support

The CLI should support basic automation-friendly behavior:
- Non-interactive CI mode
- Stable exit codes for success and failure
- `--watch` support for local iteration where relevant

Shell completion is not required for MVP.

### Studio Role in the Product

Studio is a primary product entry point, not a secondary admin tool:
- It is the main interface for visual editing
- It hosts AI chat and other higher-level content workflows
- It may directly invoke CLI-backed actions where appropriate
- It should feel like the operational center of the product, with CLI serving as the execution substrate

### Implementation Considerations

The product should be designed so that Studio and CLI share the same project model and configuration source. This avoids divergence between visual workflows and command-driven workflows, and ensures a user can move between Studio and CLI without inconsistent behavior.

The product explicitly does not require IDE integrations or editor extensions in MVP, which helps preserve focus on the Studio + CLI dual-entry model.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP focused on establishing a standard documentation orchestration workflow and proving that standardized content can be reliably built into a documentation site.

**Resource Requirements:** Phase 1 is designed for a single-founder implementation. The scope must prioritize a stable workflow standard, lightweight editing surface, and deterministic build pipeline over feature breadth.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- 用户初始化一个文档项目
- 用户按照标准流程组织和维护文档内容
- 用户在 Studio 中观察、调整、修改结构与内容
- 用户将标准化内容构建为静态站点
- 用户本地预览构建结果
- 用户通过外部 AI 配合 skill 生成内容并回到标准流程中继续编排

**Must-Have Capabilities:**
- `anydocs init` 创建项目骨架与标准配置
- 标准化文档模型与编排规则
- 基础 Studio 界面，用于观察、调整、修改内容与结构
- `anydocs build` 将标准化内容构建为静态站点
- `anydocs preview` 启动本地预览
- 可复用的标准流程定义，可封装为 skill 供外部 AI 使用
- 本地优先内容保存机制
- 基础主题与稳定渲染链路

**Phase 1 explicitly minimized:**
- 高级可视化编辑能力
- 产品内置 AI chat
- 深度 AI-assisted authoring
- 复杂导入迁移能力
- 完整多语言体验
- 完整 WebMCP 能力面

### Post-MVP Features

**Phase 2 (Post-MVP):**
- 在产品内直接引入 AI 能力
- 自然语言生成目录结构成为原生能力
- 更强的 AI chat 与 AI-assisted authoring
- 更完整的 Studio 编辑体验
- 多语言能力补齐
- `llms.txt` 与搜索能力增强

**Phase 3 (Expansion):**
- WebMCP 完整化
- 旧文档导入与转换
- 主题扩展或主题市场
- 更丰富的自动化工作流
- 更广泛的团队协作与生态能力

### Risk Mitigation Strategy

**Technical Risks:**
- 同时做 AI、Studio、CLI、构建链路、机器接口会让单人开发超载
- 缓解方式：先把“标准流程 + 编排模型 + 构建”做稳定，把 AI 内嵌延后

**Market Risks:**
- 风险在于用户不一定因 AI 概念本身买单
- MVP 先验证：标准化流程是否能帮助用户更快产出可发布文档，并让外部 AI 真正能参与内容生产

**Resource Risks:**
- 单人开发必须避免首发变成复杂平台
- 资源不足时优先保留：标准流程、基础 Studio、build/preview、skill 化能力
- 延后：内建 AI chat、完整多语言、WebMCP 扩展面

## Functional Requirements

### Project Initialization & Configuration

- FR1: Documentation maintainers can initialize a new Anydocs project with a standard project structure.
- FR2: Documentation maintainers can create a project that includes default configuration required for authoring, orchestration, and site generation.
- FR3: Documentation maintainers can inspect and modify project configuration after initialization.
- FR4: Documentation maintainers can manage project configuration through Studio.
- FR5: Documentation maintainers can run core project lifecycle commands without relying on manual repository setup steps outside the product workflow.

### Content Modeling & Orchestration

- FR6: Documentation maintainers can create documentation content using a standardized content model.
- FR7: Documentation maintainers can organize documentation content into a structured information architecture.
- FR8: Documentation maintainers can maintain stable document structure independent of final rendering format.
- FR9: Documentation maintainers can revise document structure without rebuilding the entire documentation model from scratch.
- FR10: Documentation maintainers can manage documentation content in a way that supports later AI-assisted generation and revision.
- FR11: The system can preserve a reusable standard workflow for how documentation is created, organized, reviewed, and built.
- FR12: The system can expose the standard workflow in a form that can be reused externally as a skill or equivalent workflow artifact.

### Studio Authoring & Review

- FR13: Documentation maintainers can view documentation structure and content inside Studio.
- FR14: Documentation maintainers can modify documentation structure inside Studio.
- FR15: Documentation maintainers can modify documentation content inside Studio.
- FR16: Documentation maintainers can use Studio as the primary workspace for documentation review and adjustment.
- FR17: Documentation maintainers can use Studio to validate whether generated or imported content conforms to the project’s standard structure.
- FR18: Documentation maintainers can trigger project actions from Studio that are consistent with CLI-driven workflows.

### AI-Assisted Workflow Readiness

- FR19: Documentation maintainers can bring externally generated content into the Anydocs standard workflow for further review and orchestration.
- FR20: Documentation maintainers can import legacy documentation files into Anydocs for conversion into the standard workflow.
- FR21: Documentation maintainers can review and revise AI-generated structure before building and publishing.
- FR22: Documentation maintainers can convert imported legacy documentation into the standardized content model before build and publication.
- FR23: Documentation maintainers can review and correct converted legacy documentation before it enters the published workflow.

### Build & Preview

- FR24: Documentation maintainers can build a documentation project into a static site.
- FR25: Documentation maintainers can preview the generated documentation site locally before publishing.
- FR26: Documentation maintainers can use the same project content and configuration across authoring, build, and preview workflows.
- FR27: The system can generate a site that reflects the standardized content structure maintained in the project.
- FR28: Documentation maintainers can repeat build and preview workflows reliably throughout project iteration.

### Reading Experience & Published Output

- FR29: Documentation readers can access documentation as a browsable static site.
- FR30: Documentation readers can navigate documentation through a structured site hierarchy.
- FR31: Documentation readers can consume documentation content rendered from the same underlying content model used in authoring.
- FR32: Documentation readers can access documentation pages through stable routes derived from the project structure.
- FR33: Documentation maintainers can control which documentation content is included in published output.

### CLI & Automation Workflows

- FR34: Documentation maintainers can use CLI commands interactively.
- FR35: Tools, CI workflows, and AI agents can use CLI commands non-interactively.
- FR36: Users can invoke project initialization, build, and preview through a stable command surface.
- FR37: CLI users can receive human-readable feedback about command progress, outcomes, and failures.
- FR38: Automation workflows can determine whether a CLI command succeeded or failed.
- FR39: Documentation maintainers can run iterative workflows that support repeated local changes and verification.

### Search, Language, and AI-Friendly Output

- FR40: Documentation readers can search documentation content within the generated site.
- FR41: Documentation maintainers can configure the language variants published for a project.
- FR42: Documentation readers can switch between available language variants of published documentation.
- FR43: Documentation maintainers can generate published AI-friendly documentation artifacts, including `llms.txt`, alongside the documentation site.
- FR44: External AI tools and agents can read published machine-readable documentation artifacts exposed by the project.
- FR45: Documentation maintainers can ensure that AI-friendly outputs follow the same publication boundaries as reader-facing content.

### Governance & Workflow Integrity

- FR46: Documentation maintainers can maintain documentation in a local-first workflow where project content remains under their direct control.
- FR47: Documentation maintainers can use the product without depending on a cloud-only authoring workflow.
- FR48: The system can keep Studio workflows and CLI workflows aligned to the same project model and configuration source.
- FR49: Documentation maintainers can apply the Anydocs workflow standard across multiple documentation projects without redefining the workflow each time.
- FR50: Documentation maintainers can evolve from a minimal Phase 1 workflow to richer later-phase capabilities without replacing the core project structure.

## Non-Functional Requirements

### Performance

- NFR1: The system shall allow a documentation maintainer to initialize a new project in 5 minutes or less on a standard local development machine, as verified by workflow timing tests.
- NFR2: The system shall build a documentation site for a typical project of up to 100 pages in less than 30 seconds on a standard local development machine.
- NFR3: The system shall start a local preview workflow in 10 seconds or less for a typical project of up to 100 pages, as measured from command invocation to server readiness.
- NFR4: The generated documentation site shall render primary page content in 2 seconds or less on broadband connections for the 95th percentile of page loads, as measured by Lighthouse or equivalent browser profiling.
- NFR5: The system shall support 20 consecutive local build and preview cycles for a typical project without failures caused by residual process state, as verified by automated workflow tests.

### Reliability

- NFR6: The build process shall produce byte-for-byte identical output for three repeated builds from the same project content and configuration on the same supported environment, excluding explicitly documented timestamped metadata.
- NFR7: The system shall ensure that 100% of save operations either persist valid content/configuration or fail without partial writes, as verified by integration tests.
- NFR8: A change saved in Studio shall be reflected unchanged in the next CLI build or preview run in 100% of source-of-truth regression tests for supported project fixtures.
- NFR9: At least 95% of simulated build, preview, and validation failures shall return an error message containing the failure source and at least one remediation hint, as verified by automated error-handling tests.
- NFR10: Publication-boundary tests shall confirm that 100% of content marked outside the publication rules is excluded from generated sites and published artifacts.

### Security

- NFR11: After dependencies are installed, 100% of normal authoring, save, build, and preview workflows shall execute on a supported local machine without requiring an active network connection, as verified by offline workflow tests.
- NFR12: Production deployments shall return a non-success response for Studio editing routes and local write APIs in 100% of deployment smoke tests.
- NFR13: Publication-boundary tests shall confirm that 100% of AI-friendly outputs and machine-readable interfaces expose only content allowed by the project’s publication rules.
- NFR14: 100% of supported authoring, save, build, and preview workflows shall complete without requiring a cloud account, hosted authoring service, or remote storage dependency, as verified by local environment acceptance tests.

### Accessibility

- NFR15: The generated documentation site shall meet WCAG 2.1 AA for core reading surfaces, as verified by automated accessibility checks plus manual keyboard review.
- NFR16: Keyboard-only tests shall complete primary reading flows, including navigation, page reading, search access, and language switching, with 100% task completion across supported browser smoke tests.
- NFR17: Automated accessibility checks and manual semantic review shall report zero critical violations for missing headings, landmark structure, labels, or color-only meaning on core reading surfaces.

### Compatibility

- NFR18: The generated documentation site shall support the latest stable versions of Chrome, Firefox, Safari, and Edge on desktop, plus Safari on iOS and Chrome on Android, as verified by release smoke tests.
- NFR19: The CLI shall support macOS and Linux local environments and Linux-based CI runners used in JavaScript workflows, as verified by automated command execution tests.
- NFR20: The project structure and configuration shall execute unchanged across supported macOS and Linux environments and Linux CI runners, as verified by build and preview tests on each target.
- NFR21: A project created for human-invoked workflows shall execute successfully in non-interactive CLI workflows without requiring a separate project model or configuration format, as verified by CI smoke tests.

### Maintainability

- NFR22: Projects created from the current documentation standard shall remain compatible across the next minor product release without requiring content-model migration, as verified by release compatibility tests.
- NFR23: Reference project fixtures shall produce equivalent content and configuration results when edited in Studio and executed through CLI workflows in 100% of cross-workflow regression tests.
- NFR24: Later native AI capabilities shall consume the same project content model and configuration format introduced in Phase 1 without requiring full project reinitialization, as verified by migration compatibility tests.
- NFR25: A single maintainer shall be able to execute the documented Phase 1 workflow from project initialization through build and preview using one repository and one local machine, as verified by an end-to-end maintainer workflow test.
