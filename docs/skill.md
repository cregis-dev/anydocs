# Anydocs AI Skills Guide

本文用于指导 AI agent 在 Anydocs 中生成可落盘、可被 Studio 继续编辑、可被 CLI 构建的文档源文件。

目标不是让 AI 只产出自然语言草稿，而是让 AI 直接产出符合项目约束的结构化文档文件。

## 1. 适用范围

当 AI 需要为 Anydocs 生成或修改文档项目内容时，默认遵守以下目标：

- 生成项目源文件，不是只生成 Markdown 草稿
- 生成结果应符合项目目录结构与 JSON 数据模型
- 页面内容应优先兼容 Studio 当前使用的 Yoopta 编辑器
- AI 生成内容默认进入人工审阅流，不应直接作为公开发布内容

## 2. AI 必须先理解的项目结构

AI 操作的对象是“文档项目”，不是 `packages/` 下的工具代码。

一个标准文档项目根目录通常包含：

```text
<projectRoot>/
├── anydocs.config.json
├── anydocs.workflow.json
├── pages/
│   ├── zh/
│   │   └── <pageId>.json
│   └── en/
│       └── <pageId>.json
├── navigation/
│   ├── zh.json
│   └── en.json
├── imports/
└── dist/
```

AI 在生成内容时最常写入的是：

- `pages/<lang>/<pageId>.json`
- `navigation/<lang>.json`

## 3. 页面文件 contract

页面文件路径：

```text
<projectRoot>/pages/<lang>/<pageId>.json
```

页面 JSON 的核心字段：

~~~json
{
  "id": "getting-started-introduction",
  "lang": "zh",
  "slug": "getting-started/introduction",
  "title": "Introduction",
  "description": "Optional summary",
  "tags": ["guide", "core"],
  "status": "draft",
  "updatedAt": "2026-03-13T00:00:00.000Z",
  "content": {},
  "render": {
    "markdown": "# Introduction\n\nPage body...",
    "plainText": "Introduction Page body..."
  },
  "review": {
    "required": true,
    "sourceType": "ai-generated",
    "sourceId": "ai-batch-2026-03-13"
  }
}
~~~

字段约束：

- `id`: 非空字符串，建议 kebab-case，在同语言和跨语言映射中保持稳定
- `lang`: 当前仅支持 `zh` 或 `en`
- `slug`: 非空字符串，表示阅读站路由，语言内必须唯一
- `title`: 非空字符串
- `status`: 只能是 `draft`、`in_review`、`published`
- `content`: 必填，建议写成合法 Yoopta 内容对象
- `render.markdown`: 建议始终生成，便于搜索、导出和人工校对
- `render.plainText`: 建议始终生成，便于搜索和审校
- `review`: AI 生成内容建议始终带上，并将 `required` 设为 `true`

发布约束：

- 带 `review.required = true` 的页面，不应直接设为 `published`
- 推荐 AI 生成页面默认使用 `draft` 或 `in_review`
- 只有 `published` 页面才会进入公开阅读站、搜索索引、`llms.txt` 和 WebMCP 产物

## 4. 导航文件 contract

导航文件路径：

```text
<projectRoot>/navigation/<lang>.json
```

导航 JSON 结构：

```json
{
  "version": 1,
  "items": [
    {
      "type": "section",
      "title": "开始使用",
      "children": [
        {
          "type": "page",
          "pageId": "getting-started-introduction"
        }
      ]
    }
  ]
}
```

支持的导航节点类型：

- `section`: 分组，必须有 `title` 和 `children`
- `folder`: 文件夹，必须有 `title` 和 `children`
- `page`: 页面引用，必须有 `pageId`
- `link`: 外链，必须有 `title` 和 `href`

导航约束：

- `page.pageId` 必须指向真实存在的页面
- 同一个语言的导航应只引用该语言下存在的页面
- AI 新增页面后，如希望页面在阅读站出现，必须同步更新导航
- `hidden: true` 的页面节点不会出现在公开阅读站侧边栏

## 5. Yoopta 内容生成原则

Studio 当前使用 Yoopta 作为可视化编辑器。  
因此，AI 不应只生成 Markdown，而应优先生成 Yoopta 可编辑内容，并同步生成 `render.markdown` 与 `render.plainText`。

当前仓库允许的顶层 block type 包括：

- `Paragraph`
- `HeadingOne`
- `HeadingTwo`
- `HeadingThree`
- `BulletedList`
- `NumberedList`
- `TodoList`
- `Blockquote`
- `Code`
- `CodeGroup`
- `Divider`
- `Callout`
- `Image`
- `Table`
- `Link`

但从“稳定可生成”的角度，AI 默认只应使用安全子集：

- `Paragraph`
- `HeadingOne`
- `HeadingTwo`
- `HeadingThree`
- `BulletedList`
- `NumberedList`
- `TodoList`
- `Blockquote`
- `Code`
- `Divider`
- `Callout`

除非已经拿到现成示例或明确知道 schema，否则不要主动生成这些复杂块：

- `Table`
- `Image`
- `Link`
- `CodeGroup`

原因：

- 顶层校验只检查 block 外壳，不保证内部结构一定可被编辑器稳定渲染
- 复杂 block 往往带有额外 props、嵌套节点或 void node 语义
- 对 AI 来说，文本型 block 更稳定，也更适合后续人工在 Studio 中继续编辑

## 6. 推荐 Yoopta 最小格式

### 6.1 段落

```json
{
  "block-2": {
    "id": "block-2",
    "type": "Paragraph",
    "value": [
      {
        "id": "el-2",
        "type": "paragraph",
        "children": [
          { "text": "这是正文段落。" }
        ],
        "props": {
          "nodeType": "block"
        }
      }
    ],
    "meta": {
      "order": 1,
      "depth": 0
    }
  }
}
```

### 6.2 一级标题

```json
{
  "block-1": {
    "id": "block-1",
    "type": "HeadingOne",
    "value": [
      {
        "id": "el-1",
        "type": "h1",
        "children": [
          { "text": "开始使用" }
        ],
        "props": {
          "nodeType": "block"
        }
      }
    ],
    "meta": {
      "order": 0,
      "depth": 0
    }
  }
}
```

### 6.3 二级标题

```json
{
  "block-3": {
    "id": "block-3",
    "type": "HeadingTwo",
    "value": [
      {
        "id": "el-3",
        "type": "h2",
        "children": [
          { "text": "安装" }
        ],
        "props": {
          "nodeType": "block"
        }
      }
    ],
    "meta": {
      "order": 2,
      "depth": 0
    }
  }
}
```

### 6.4 列表项

```json
{
  "block-4": {
    "id": "block-4",
    "type": "BulletedList",
    "value": [
      {
        "id": "el-4",
        "type": "bulleted-list",
        "children": [
          { "text": "第一步先安装依赖" }
        ],
        "props": {
          "nodeType": "block"
        }
      }
    ],
    "meta": {
      "order": 3,
      "depth": 0
    }
  }
}
```

说明：

- 一个列表项通常就是一个 block
- 多个 bullet 请生成多个 `BulletedList` block，并按 `meta.order` 顺序排列

### 6.5 代码块

```json
{
  "block-5": {
    "id": "block-5",
    "type": "Code",
    "value": [
      {
        "id": "el-5",
        "type": "code",
        "children": [
          { "text": "pnpm install\npnpm dev" }
        ],
        "props": {
          "nodeType": "void",
          "language": "bash"
        }
      }
    ],
    "meta": {
      "order": 4,
      "depth": 0
    }
  }
}
```

## 7. AI 推荐输出策略

如果 AI 需要从“主题说明”或“Markdown 草稿”生成 Anydocs 页面，推荐遵循下面的策略：

1. 先确定页面元信息

- `id`
- `lang`
- `slug`
- `title`
- `description`
- `tags`

2. 再把正文拆成安全 Yoopta blocks

- 标题转 `HeadingOne/Two/Three`
- 普通正文转 `Paragraph`
- 命令或示例代码转 `Code`
- 无序步骤转 `BulletedList`
- 有序步骤转 `NumberedList`

3. 同步生成 render 字段

- `render.markdown` 应尽量与 `content` 对齐
- `render.plainText` 应去掉格式，仅保留可检索文本

4. 默认进入审阅流

- `status` 设为 `draft` 或 `in_review`
- `review.required` 设为 `true`
- `review.sourceType` 设为 `ai-generated`
- `review.sourceId` 写入本次生成任务标识

## 8. AI 生成页面时的硬性规则

- 不要省略 `content`
- 不要把页面直接写成 `.md` 或 `.mdx` 作为主源格式
- 不要让 `slug` 在同语言内重复
- 不要让 `navigation/*.json` 引用不存在的 `pageId`
- 不要默认发布 AI 生成内容
- 不要生成当前项目不支持的自定义 block type
- 不要把复杂布局 block 当成文档主格式
- `meta.order` 应从 `0` 开始连续递增
- `meta.depth` 默认写 `0`
- block id 和 element id 应稳定且唯一，推荐 `block-1`、`el-1` 这种可读命名

## 9. 推荐页面样例

下面是一个适合 AI 直接生成的完整页面样例：

~~~json
{
  "id": "getting-started-introduction",
  "lang": "zh",
  "slug": "getting-started/introduction",
  "title": "介绍",
  "description": "快速了解 Anydocs 的项目结构与使用方式。",
  "tags": ["guide", "getting-started"],
  "status": "draft",
  "updatedAt": "2026-03-13T00:00:00.000Z",
  "content": {
    "block-1": {
      "id": "block-1",
      "type": "HeadingOne",
      "value": [
        {
          "id": "el-1",
          "type": "h1",
          "children": [{ "text": "介绍" }],
          "props": { "nodeType": "block" }
        }
      ],
      "meta": { "order": 0, "depth": 0 }
    },
    "block-2": {
      "id": "block-2",
      "type": "Paragraph",
      "value": [
        {
          "id": "el-2",
          "type": "paragraph",
          "children": [{ "text": "Anydocs 是一个面向 AI 时代的文档站点编辑器。" }],
          "props": { "nodeType": "block" }
        }
      ],
      "meta": { "order": 1, "depth": 0 }
    },
    "block-3": {
      "id": "block-3",
      "type": "HeadingTwo",
      "value": [
        {
          "id": "el-3",
          "type": "h2",
          "children": [{ "text": "快速开始" }],
          "props": { "nodeType": "block" }
        }
      ],
      "meta": { "order": 2, "depth": 0 }
    },
    "block-4": {
      "id": "block-4",
      "type": "BulletedList",
      "value": [
        {
          "id": "el-4",
          "type": "bulleted-list",
          "children": [{ "text": "运行 pnpm install" }],
          "props": { "nodeType": "block" }
        }
      ],
      "meta": { "order": 3, "depth": 0 }
    },
    "block-5": {
      "id": "block-5",
      "type": "BulletedList",
      "value": [
        {
          "id": "el-5",
          "type": "bulleted-list",
          "children": [{ "text": "运行 pnpm dev 打开 Studio" }],
          "props": { "nodeType": "block" }
        }
      ],
      "meta": { "order": 4, "depth": 0 }
    },
    "block-6": {
      "id": "block-6",
      "type": "Code",
      "value": [
        {
          "id": "el-6",
          "type": "code",
          "children": [{ "text": "pnpm install\npnpm dev" }],
          "props": {
            "nodeType": "void",
            "language": "bash"
          }
        }
      ],
      "meta": { "order": 5, "depth": 0 }
    }
  },
  "render": {
    "markdown": "# 介绍\n\nAnydocs 是一个面向 AI 时代的文档站点编辑器。\n\n## 快速开始\n\n- 运行 pnpm install\n- 运行 pnpm dev 打开 Studio\n\n```bash\npnpm install\npnpm dev\n```",
    "plainText": "介绍 Anydocs 是一个面向 AI 时代的文档站点编辑器。 快速开始 运行 pnpm install 运行 pnpm dev 打开 Studio pnpm install pnpm dev"
  },
  "review": {
    "required": true,
    "sourceType": "ai-generated",
    "sourceId": "ai-batch-2026-03-13"
  }
}
~~~

## 10. 推荐给 AI 的执行流程

当 AI 接到“生成文档页面”的任务时，推荐按以下流程执行：

1. 读取目标项目的 `anydocs.config.json`
2. 确认支持语言与默认语言
3. 扫描对应语言的 `pages/<lang>/`，避免 `pageId` 和 `slug` 冲突
4. 读取对应语言的 `navigation/<lang>.json`
5. 生成页面 JSON
6. 按需更新导航 JSON
7. 将页面状态保持为 `draft` 或 `in_review`
8. 如页面来自 AI 生成，写入 `review` 元数据

## 11. 可直接复用给 agent 的提示词

下面这段可以作为上层 agent 的工作指令：

```text
你正在为 Anydocs 生成文档项目源文件，而不是普通 Markdown 草稿。

请遵守以下规则：
1. 目标文件是 pages/<lang>/<pageId>.json 与 navigation/<lang>.json。
2. 页面 JSON 必须包含 id、lang、slug、title、status、content。
3. content 使用 Yoopta 可编辑格式，优先使用 Paragraph、HeadingOne、HeadingTwo、HeadingThree、BulletedList、NumberedList、TodoList、Blockquote、Code、Divider、Callout。
4. 默认不要使用 Table、Image、Link、CodeGroup，除非已经有明确 schema 示例。
5. render.markdown 与 render.plainText 需要与 content 一致。
6. AI 生成页面默认 status=draft，并写入 review.required=true、review.sourceType=ai-generated。
7. 同语言内 slug 必须唯一；navigation 中 pageId 必须引用真实页面。
8. 除非明确要求，不要直接发布为 published。
```

## 12. 一句话原则

对 Anydocs 来说，AI 最理想的输出不是“漂亮的 Markdown”，而是“符合项目 contract、可继续在 Yoopta 里编辑、可进入审阅流的结构化页面 JSON”。
