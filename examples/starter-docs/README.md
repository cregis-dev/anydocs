# Anydocs Starter Example

This is the smallest complete Anydocs project kept in the repository.

Use it when you want to understand the base project shape without templates, import staging, or agent-specific guidance mixed in.

## Structure

```
examples/starter-docs/
├── anydocs.config.json      # Project configuration
├── anydocs.workflow.json    # Workflow standard definition
├── pages/                   # Page content (canonical DocContentV1 JSON)
│   ├── zh/*.json           # Chinese pages
│   └── en/*.json           # English pages
├── navigation/              # Navigation trees
│   ├── zh.json             # Chinese navigation
│   └── en.json             # English navigation
└── .gitignore              # Ignores dist/, .anydocs/
```

## What This Example Covers

- minimal bilingual docs project
- page and navigation source layout
- `build` and `preview` workflow
- Studio local editing

## What This Example Does Not Cover

- custom page templates
- metadata schemas
- import staging
- agent / MCP authoring workflows

For those topics, use the focused examples listed in [../README.md](../README.md).

## Quick Start

### Building

```bash
node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs
```

### Preview

```bash
node --experimental-strip-types packages/cli/src/index.ts preview examples/starter-docs
```

### Development with Studio

```bash
pnpm dev
```

Then open Studio and select `examples/starter-docs` as the project path.

## Creating Your Own Project

### Option 1: Use CLI init

```bash
node --experimental-strip-types packages/cli/src/index.ts init ./my-docs-project
```

### Option 2: Copy this example

```bash
cp -r examples/starter-docs ./my-docs-project
```
