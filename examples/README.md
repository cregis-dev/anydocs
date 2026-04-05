# Anydocs Examples

This directory contains focused example documentation projects.

The organizing rule is simple: one example should teach one primary topic. The default starter stays minimal; advanced topics get their own project instead of being mixed into the same demo.

## Recommended Order

1. `starter-docs`: start here if you want the smallest complete docs project
2. `page-template-docs`: then look here for custom page templates and metadata
3. `openapi-reference-docs`: use this for API source and reference route output
4. `import-staging-docs`: use this for legacy Markdown import staging
5. `codex-authoring-docs`: use this when you want a fuller agent authoring site
6. `codex-mcp-docs`: use this when you only care about Codex + MCP integration

## Available Examples

### `starter-docs`

Minimal starter project showcasing:
- multi-language support
- page and navigation source layout
- build and preview flow
- local Studio editing

**Location:** `examples/starter-docs/`

**Build:**
```bash
node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs
```

**Preview:**
```bash
node --experimental-strip-types packages/cli/src/index.ts preview examples/starter-docs
```

See [starter-docs/README.md](starter-docs/README.md) for detailed instructions.

### `page-template-docs`

Focused authoring-template project showcasing:
- custom page templates
- metadata schema fields
- template-backed published pages
- bilingual template content

**Location:** `examples/page-template-docs/`

**Build:**
```bash
node --experimental-strip-types packages/cli/src/index.ts build examples/page-template-docs
```

**Preview:**
```bash
node --experimental-strip-types packages/cli/src/index.ts preview examples/page-template-docs
```

See [page-template-docs/README.md](page-template-docs/README.md) for detailed instructions.

### `openapi-reference-docs`

Focused API reference project showcasing:
- `api-sources/*.json`
- local file-based OpenAPI sources
- published reference routes
- `dist/mcp/openapi/*` artifacts

**Location:** `examples/openapi-reference-docs/`

**Build:**
```bash
node --experimental-strip-types packages/cli/src/index.ts build examples/openapi-reference-docs
```

**Preview:**
```bash
node --experimental-strip-types packages/cli/src/index.ts preview examples/openapi-reference-docs
```

See [openapi-reference-docs/README.md](openapi-reference-docs/README.md) for detailed instructions.

### `import-staging-docs`

Focused import pipeline project showcasing:
- legacy Markdown source files
- staged import manifests
- staged import items
- the handoff into `convert-import`

**Location:** `examples/import-staging-docs/`

**Build:**
```bash
node --experimental-strip-types packages/cli/src/index.ts build examples/import-staging-docs
```

**Convert staged import:**
```bash
node --experimental-strip-types packages/cli/src/index.ts convert-import legacy-2026-04-04-demo examples/import-staging-docs
```

See [import-staging-docs/README.md](import-staging-docs/README.md) for detailed instructions.

### `codex-authoring-docs`

Fuller documentation site showcasing:
- how Codex writes and maintains an Anydocs project
- longer-form navigation and page sets
- practical authoring workflow guidance

**Location:** `examples/codex-authoring-docs/`

See [codex-authoring-docs/README.md](codex-authoring-docs/README.md) for detailed instructions.

### `codex-mcp-docs`

Focused integration project showcasing:
- how to connect Anydocs MCP in Codex
- a smaller, task-oriented guide set
- MCP-first authoring flow

**Location:** `examples/codex-mcp-docs/`

See [codex-mcp-docs/README.md](codex-mcp-docs/README.md) for detailed instructions.

## Creating Your Own Project

### From Scratch

```bash
# Initialize new project
node --experimental-strip-types packages/cli/src/index.ts init ./my-docs-project

# Build
node --experimental-strip-types packages/cli/src/index.ts build ./my-docs-project
```

### From Example

```bash
# Copy the starter example
cp -r examples/starter-docs ./my-docs-project

# Customize
cd ./my-docs-project
vim anydocs.config.json

# Build
node --experimental-strip-types packages/cli/src/index.ts build .
```

## Documentation Projects Structure

A typical docs project should contain:

```
my-docs-project/
├── anydocs.config.json       # Required: project configuration
├── anydocs.workflow.json     # Required: workflow standard
├── pages/                    # Required: page content (canonical DocContentV1)
│   ├── zh/*.json
│   └── en/*.json
├── navigation/               # Required: navigation trees
│   ├── zh.json
│   └── en.json
├── imports/                  # Optional: import staging
├── dist/                     # Generated: build output (git-ignored)
├── .gitignore               # Recommended
└── README.md                # Recommended
```

## More Information

- [Anydocs Documentation](../docs/README.md)
- [Architecture](../artifacts/bmad/planning-artifacts/architecture.md)
- [Usage Manual](../docs/usage-manual.md)
- [Main README](../README.md)
