# Anydocs - AI 时代的文档站点编辑器

**本地优先 · 内容与工具分离 · AI 友好**

Anydocs 是一个现代化的文档站点编辑器，专为 AI 时代设计。

## 核心特性

- **Studio（本地编辑台）**：Notion 风格编辑器 + 导航编排 + 元数据面板
- **CLI 构建工具**：生成静态站点、搜索索引、llms.txt 和 WebMCP 产物
- **GitBook 风格阅读站**：多语言路由、内部搜索、published-only 过滤
- **内容与工具分离**：文档项目可独立管理，构建产物独立输出

## 快速开始

### 开发模式

```bash
pnpm install
pnpm dev
```

打开：
- http://localhost:3000/ - Studio 编辑台
- http://localhost:3000/zh/docs - 中文阅读站
- http://localhost:3000/en/docs - 英文阅读站

### 构建文档

```bash
# 构建示例项目
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs

# 构建到自定义位置
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs --output /var/www/docs

# Watch 模式
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs --watch
```

## 架构说明

### 目录结构

```
anydocs/                      # Anydocs 工具仓库
├── packages/
│   ├── cli/                 # CLI 工具
│   ├── core/                # 核心库
│   ├── web/                 # Next.js Studio & 阅读站
│   └── desktop/             # Electron 桌面端
│
├── examples/                # 示例文档项目
│   └── demo-docs/           # 演示项目
│       ├── pages/          # 页面内容
│       ├── navigation/      # 导航树
│       └── .gitignore      # 忽略 dist/
│
└── docs/                    # Anydocs 工具文档

dist/                        # 构建产物（不纳入版本控制）
└── projects/default/
    ├── build-manifest.json  # 构建清单
    ├── site/assets/         # 搜索索引
    ├── mcp/                 # 机器可读产物
    └── llms.txt             # LLM 索引
```
│   └── desktop/             # Electron 桌面端
│
└── content/projects/        # 文档项目（示例）
    └── default/             # Demo 项目
        ├── pages/          # 页面内容（Yoopta JSON）
        ├── navigation/      # 导航树
        └── .gitignore      # 忽略 dist/

dist/                        # 构建产物（不纳入版本控制）
└── projects/default/
    ├── build-manifest.json  # 构建清单
    ├── site/assets/         # 搜索索引
    ├── mcp/                 # 机器可读产物
    └── llms.txt             # LLM 索引
```

### 构建产物

运行 `build` 命令后生成：

- **dist/build-manifest.json** - 构建元信息
- **dist/projects/{projectId}/site/assets/** - 搜索索引
- **dist/projects/{projectId}/mcp/** - WebMCP 机器可读产物
- **dist/projects/{projectId}/llms.txt** - LLM 友好站点索引

## 文档项目规范

一个标准的文档项目包含：

```
my-docs-project/
├── content/projects/default/
│   ├── anydocs.config.json     # 项目配置
│   ├── pages/{lang}/*.json     # 页面内容
│   └── navigation/{lang}.json  # 导航树
├── dist/                       # 构建产物（git-ignored）
├── .gitignore                  # 必须忽略 dist/
└── README.md
```

## 命令参考

### CLI 命令

```bash
# 初始化新项目
node --experimental-strip-types packages/cli/src/index.ts init <targetDir>

# 构建
node --experimental-strip-types packages/cli/src/index.ts build <targetDir> [--output <dir>] [--watch]

# 预览
node --experimental-strip-types packages/cli/src/index.ts preview <targetDir>

# 导入 Markdown
node --experimental-strip-types packages/cli/src/index.ts import <sourceDir> <targetDir> [lang]
node --experimental-strip-types packages/cli/src/index.ts convert-import <importId> <targetDir>
```

### 开发命令

```bash
pnpm dev              # 启动开发服务器
pnpm build            # 构建工具包
pnpm typecheck        # 类型检查
pnpm lint             # 代码检查
pnpm check            # 完整校验
```

## 部署

构建产物是纯静态文件，可部署到：

- Nginx / Apache
- Vercel / Netlify / Cloudflare Pages
- GitHub Pages
- AWS S3 / OSS

示例：

```bash
# 构建
node --experimental-strip-types packages/cli/src/index.ts build ./my-docs --output ./dist-prod

# 部署到 Nginx
cp -r ./dist-prod/projects/default/site/* /var/www/html/docs/

# 或部署到 Vercel
cd ./dist-prod/projects/default/site
vercel --prod
```

## 文档

完整文档请查看：[docs/README.md](docs/README.md)

- [文档索引](docs/README.md) - 当前 `docs/` 目录入口
- [架构文档](docs/planning-artifacts/architecture.md) - 规划与架构设计
- [PRD](docs/planning-artifacts/prd.md) - 产品需求定义
- [Epics](docs/planning-artifacts/epics.md) - Epic 与 Story 拆分
- [使用手册](docs/04-usage-manual.md) - 详细操作指南
- [开发指南](docs/05-dev-guide.md) - 开发与验证流程
