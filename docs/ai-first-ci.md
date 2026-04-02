# AI-First CI 内部实施指南

本文面向公司内部研发、平台和 DevEx 团队，说明如何把 AI review 放到 PR 合并链路的最前面，并把它作为正式的 merge gate。

目标不是“让 AI 顺手看一眼”，而是把 AI 变成一条可审计、可配置、可阻断的质量关卡。

## 1. 目标

我们希望达成以下效果：

- PR 创建或更新后，先由独立 AI agent 按预定义标准执行 review
- 只有 AI review 结果为 `pass`，后续 CI 才继续执行
- 只有 AI review 对应的 GitHub check 为成功，PR 才允许 merge
- review 标准可版本化、可审计、可逐步演进
- AI agent 可以运行在另一台电脑或独立服务上，不依赖 GitHub Actions runner 本机

这套模式称为 `AI-First CI`。

## 2. 适用场景

推荐用于以下场景：

- 需要统一执行公司内部工程规范、架构约束、安全约束
- 需要在人工 review 之前先过滤明显不合格 PR
- 希望把“规范是否满足”前移到 CI 之前，而不是在 CI 之后再人工补救
- 需要让外部 AI reviewer 运行在单独机器、专用 GPU 机或受控内网环境

不推荐用于以下场景：

- 仅把 AI 当成提示工具，不希望它具备阻断 merge 的权力
- review 标准尚未固化，仍处于频繁试错阶段
- 仓库没有开启 branch protection，无法把 check 变成正式 gate

## 3. 核心原则

### 3.1 Gate 建在 GitHub，不建在口头流程里

真正决定“能不能 merge”的，不是某个聊天窗口里的结论，而是 GitHub 上的 required checks。

因此 AI review 的最终输出必须回写到 GitHub，形式应为：

- `Check Run`
- 或 `Commit Status`

推荐优先使用 `Check Run`，因为它更适合承载：

- `queued` / `in_progress` / `completed` 生命周期
- 明确的 `success` / `failure` / `neutral` / `cancelled` 结论
- review summary 与详细结论

### 3.2 外部 agent 是独立 reviewer service，不是 CI 脚本的附庸

如果 AI agent 运行在另一台电脑上，推荐把它设计为独立服务：

- 接收 GitHub 事件
- 获取 PR diff 与上下文
- 执行 review
- 直接回写 GitHub check 结果
- 在通过后主动触发后续 CI

不要把它设计成“某个 workflow step 里的远程脚本”，否则可观测性、重试和权限边界都会变差。

### 3.3 规则必须版本化

AI review 的标准不能只存在于 prompt 历史里，应该放在仓库中版本管理，例如：

- `.github/ai-review-rules.md`
- `.github/ai-review-policy.yaml`
- `docs/engineering/ai-review-rubric.md`

这样做的好处：

- 标准变更可走 PR
- review 结果可追溯到对应规则版本
- 不同仓库可以共享一套基线规则，再叠加 repo-specific 规则

## 4. 推荐架构

推荐采用四段式架构：

1. GitHub 发出 PR 事件
2. 外部 AI reviewer service 接收事件并执行 review
3. reviewer 向 GitHub 回写 `AI Review` check 结果
4. reviewer 在 `pass` 后触发正式 CI workflow

逻辑上分为两条控制线：

- merge 控制线：由 Branch Protection + Required Checks 控制
- 执行控制线：由 AI reviewer 是否触发后续 workflow 控制

## 5. 事件流

### 5.1 标准事件流

```text
Developer pushes commit to PR
  -> GitHub emits pull_request/synchronize event
  -> AI reviewer receives event
  -> AI reviewer creates or updates check run: AI Review = in_progress
  -> AI reviewer fetches PR diff + repository rules
  -> AI reviewer runs policy-based review
  -> if fail:
       AI Review = failure
       stop
  -> if pass:
       AI Review = success
       trigger CI workflow
  -> GitHub Actions runs quality / acceptance jobs
  -> Branch protection allows merge only if all required checks are green
```

### 5.2 失败路径

当 AI review 不通过时：

- `AI Review` check 标记为 `failure`
- 正式 CI 不触发，或保持在未开始状态
- PR 保持不可 merge
- reviewer 可选地回写一条 summary comment，说明失败原因与建议动作

## 6. 为什么不建议“把结果传回某个正在等待的 CI”

很多团队第一反应是：

- PR 触发 GitHub Actions
- Actions 卡住等待外部 agent review
- agent 完成后把结果传回这个 workflow

这个设计能做，但不推荐作为第一选择，因为它有几个问题：

- workflow 长时间占用 runner
- 超时、重跑、幂等性处理复杂
- 外部 agent 异常时，CI 状态容易进入不清晰的中间态
- merge gate 实际仍应依赖 GitHub checks，而不是某个 job 内部变量

更稳的方式是：

- 外部 agent 直接写 GitHub check
- 通过后再触发 CI

## 7. 外部 AI reviewer 的两种接入方式

### 7.1 Webhook 模式

GitHub 通过 webhook 把 PR 事件推送给 reviewer service。

适用情况：

- 有稳定服务端
- 有公网入口或可被 GitHub 访问的入口
- 需要实时响应

优点：

- 响应快
- 架构标准
- 更适合长期运行

缺点：

- 需要公网入口、反向代理或中转层
- 运维要求更高

### 7.2 Polling 模式

外部 agent 定时轮询 GitHub，发现新的 PR 更新后再执行 review。

适用情况：

- agent 只是运行在另一台普通办公电脑或内网机器
- 当前没有公网入口
- 先做最小可用方案

优点：

- 实现简单
- 不要求 webhook 基础设施

缺点：

- 实时性较差
- 需要自行维护去重与轮询状态

内部试点推荐顺序：

1. 先用 polling 跑通最小闭环
2. 稳定后切到 webhook 模式

## 8. GitHub 侧推荐能力

### 8.1 身份模型

推荐使用 `GitHub App`，不推荐长期使用高权限个人 PAT。

推荐原因：

- 权限边界更清晰
- 更适合团队与多仓库治理
- 可独立控制：
  - `Pull requests: Read`
  - `Checks: Write`
  - `Contents: Read`
  - `Metadata: Read`
  - 可选 `Commit statuses: Write`

### 8.2 回写对象

优先使用 `Check Run`，名称建议固定为：

- `AI Review`

不要频繁变更这个名称，因为 Branch Protection 会依赖它作为 required status check。

### 8.3 Branch Protection

目标分支建议至少开启：

- Require a pull request before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging

并将以下检查设为 required：

- `AI Review`
- `Quality`
- `Acceptance`

其中：

- `AI Review` 是前置 gate
- `Quality` 和 `Acceptance` 是常规 CI gate

## 9. 推荐 workflow 设计

对于当前仓库，现有 CI 位于 [`.github/workflows/ci.yml`](/Users/shawn/workspace/code/anydocs/.github/workflows/ci.yml)，包含：

- `Quality`
- `Acceptance`

推荐改为两层 workflow：

### 9.1 Workflow A: AI review 入口

用途：

- 接收 PR 事件
- 不执行正式构建测试
- 仅负责把 PR 变更信息交给外部 reviewer，或由外部 reviewer 自行监听

如果 reviewer 完全跑在外部系统上，这个 workflow 甚至可以不存在。

### 9.2 Workflow B: 正式 CI

用途：

- 只在 `AI Review = success` 后触发
- 执行：
  - lint
  - typecheck
  - test
  - build
  - acceptance

触发方式推荐：

- `repository_dispatch`
- 或 `workflow_dispatch`

外部 reviewer 在 pass 后调用 GitHub API 触发它。

## 10. 推荐仓库内文件布局

建议新增以下文件：

```text
.github/
├── ai-review-rules.md
├── workflows/
│   ├── ci.yml
│   └── ci-dispatch.yml
└── scripts/
    └── ai-review-payload.md
```

说明：

- `ai-review-rules.md`：review 标准，供外部 agent 读取
- `ci.yml`：正式 CI，仅由 dispatch 触发
- `ci-dispatch.yml`：可选，用于接收外部信号或做轻量编排
- `ai-review-payload.md`：可选，定义传给 reviewer 的上下文格式

如果 reviewer 服务在仓库外维护，也至少应把规则文件保留在仓库中。

## 11. AI review 标准如何组织

推荐把规则分成三层：

### 11.1 全局工程基线

例如：

- 不能引入明文密钥
- 不能绕过鉴权
- 不能删除关键审计日志
- 不能破坏发布边界

### 11.2 仓库级规则

例如对 Anydocs：

- 不得把 `draft` / `in_review` 内容暴露到 public reader
- 不得将 `/api/local/*` 视为公网 API 使用
- 文档构建产物必须保持 `published-only`
- reader 路由与 Studio 路由边界不能混淆

### 11.3 变更域规则

根据改动目录附加更细规则，例如：

- 改 `packages/web/app/[lang]` 时，重点检查 reader 暴露面
- 改 `packages/core/src/publishing` 时，重点检查发布过滤逻辑
- 改 `.github/workflows` 时，重点检查是否削弱 gate

## 12. 外部 reviewer 的最小职责

无论 reviewer 运行在另一台电脑、容器还是专用服务上，至少应具备以下能力：

- 识别目标 PR 与最新 head SHA
- 获取 PR changed files 与 patch
- 读取仓库内 review 规则
- 生成结构化 review 结论
- 回写 GitHub check
- 在 pass 时触发正式 CI
- 保证幂等性，避免同一 SHA 重复触发多次

推荐输出结构：

```json
{
  "result": "pass",
  "summary": "No blocking policy violations found.",
  "findings": [],
  "headSha": "abc123",
  "rulesVersion": "repo@main:.github/ai-review-rules.md"
}
```

## 13. 正式 CI 触发方式

### 13.1 推荐方式：`repository_dispatch`

AI reviewer 在 pass 后向 GitHub 发起事件，例如：

- event type: `ai_review_passed`

正式 CI workflow 只监听这个事件，并使用事件中携带的：

- `pr_number`
- `head_sha`
- `base_ref`

这样可以明确表达：

- AI review 已完成
- 当前是哪个 commit 被批准进入正式 CI

### 13.2 可选方式：`workflow_dispatch`

如果团队更习惯手工触发语义，可以由 reviewer 调用 `workflow_dispatch` 触发指定 workflow。

缺点是事件语义不如 `repository_dispatch` 清晰。

## 14. CI workflow 约束建议

正式 CI workflow 应增加一层自校验，确认它只处理已经通过 AI review 的 SHA。

例如：

- 读取 dispatch payload 中的 `head_sha`
- 校验当前 checkout SHA 与其一致
- 必要时查询 `AI Review` check 是否为 `success`

这样可以避免：

- reviewer 审的是旧 commit
- CI 跑的是新 commit
- 中间出现竞态条件

## 15. 评论与可观测性

AI reviewer 除了写 check run，建议再补充两类可观测输出：

- PR comment summary
- reviewer service 自身日志与审计记录

PR comment 适合给开发者看，内容应简洁：

- 是否通过
- 失败原因摘要
- 下一步建议

内部审计日志适合平台团队看，内容可更完整：

- 收到事件时间
- review 规则版本
- 使用的模型版本
- 输入 commit SHA
- 最终 decision
- 是否成功触发后续 CI

## 16. 安全与治理要求

### 16.1 Prompt 不等于策略

不要只把规则放在自然语言 prompt 里，而不做结构化约束。建议：

- 规则文件版本化
- 结论结构化
- 对 `pass` / `fail` 做明确映射

### 16.2 Fail closed

当 reviewer service 出现异常时，默认策略应为：

- 不通过
- 不触发正式 CI
- 不允许 merge

不要采用“reviewer 挂了就默认放行”的策略。

### 16.3 防止自我削弱

对于修改以下路径的 PR，应启用更严格 review：

- `.github/workflows/**`
- `.github/ai-review-rules.md`
- reviewer 相关脚本或配置

否则提交者可能通过修改 gate 本身来绕过 gate。

## 17. 最小落地方案

如果公司内部要先快速试点，推荐按下面顺序推进：

1. 在仓库内新增 `ai-review-rules.md`
2. 搭建一个外部 polling reviewer
3. reviewer 为每个 PR head SHA 回写 `AI Review` check
4. 在 GitHub 中把 `AI Review` 设为 required check
5. reviewer 在 pass 后触发正式 CI
6. 正式 CI 只接收来自 reviewer 的 dispatch

这一步完成后，就已经具备：

- AI review 前置
- AI review 失败阻断 merge
- AI review 通过后再跑正式 CI

## 18. 分阶段演进路线

### 阶段一：试点

- 单仓库启用
- polling 模式
- 规则以 Markdown 管理
- 失败时只输出 summary

### 阶段二：稳定化

- 切换到 webhook 模式
- 引入 GitHub App
- 增加结构化 finding 分类
- 加入 reviewer 审计日志

### 阶段三：平台化

- 多仓库共享基线规则
- 按目录或语言栈自动装配规则
- 接入统一平台控制台
- 支持 reviewer SLA、重试与指标监控

## 19. 对内部团队的操作建议

研发团队需要理解：

- AI Review 是正式 gate，不是建议项
- 修改规则文件本身也会被更严格审查
- `AI Review` 没通过时，不应先讨论是否 merge，而应先修正问题

平台团队需要保障：

- reviewer 身份与权限最小化
- check run 命名稳定
- dispatch 事件幂等
- reviewer 故障时默认阻断

## 20. 推荐结论

公司内部若要实施 AI-First CI，推荐默认方案是：

- 用外部 AI reviewer service 作为独立 gatekeeper
- 用 GitHub `Check Run` 承载 `AI Review` 结果
- 用 Branch Protection 把 `AI Review` 设为 required check
- 用 `repository_dispatch` 在 review pass 后触发正式 CI
- 用仓库内版本化规则文件维护 review 标准

这比“在 GitHub Actions 内等待另一台机器返回结果”更稳、更清晰，也更适合后续平台化治理。
