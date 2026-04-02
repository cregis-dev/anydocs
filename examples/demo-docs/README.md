# Anydocs Demo Project

This is a demonstration documentation project that showcases Anydocs features.

## Structure

```
examples/demo-docs/
├── anydocs.config.json      # Project configuration
├── anydocs.workflow.json    # Workflow standard definition
├── pages/                   # Page content (Yoopta JSON)
│   ├── zh/*.json           # Chinese pages
│   └── en/*.json           # English pages
├── navigation/              # Navigation trees
│   ├── zh.json             # Chinese navigation
│   └── en.json             # English navigation
├── imports/                 # Import staging area
└── .gitignore              # Ignores dist/, .anydocs/
```

## Quick Start

### Building

```bash
# From Anydocs tool repository root
cd /path/to/anydocs

# Build demo project (output to examples/demo-docs/dist/)
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs

# Build to custom location
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs --output ./demo-build

# Watch mode
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs --watch
```

### Preview

```bash
node --experimental-strip-types packages/cli/src/index.ts preview examples/demo-docs
```

### Development with Studio

```bash
# Start Studio from tool repository
cd /path/to/anydocs
pnpm dev

# Then open Studio and select examples/demo-docs as project path
# Studio URL: http://localhost:3000/studio
```

## Configuration

Edit `anydocs.config.json` to customize:

```json
{
  "version": 1,
  "projectId": "default",
  "name": "Demo Docs",
  "defaultLanguage": "zh",
  "languages": ["zh", "en"],
  "build": {
    "outputDir": "./dist"
  }
}
```

## Creating Your Own Project

### Option 1: Use CLI init

```bash
node --experimental-strip-types packages/cli/src/index.ts init ./my-docs-project
```

### Option 2: Copy this example

```bash
cp -r examples/demo-docs ./my-docs-project
cd ./my-docs-project

# Edit configuration
vim anydocs.config.json

# Edit content
vim pages/zh/welcome.json
vim navigation/zh.json

# Build
node --experimental-strip-types ../packages/cli/src/index.ts build .
```

## Documentation

See [Anydocs documentation](../../docs/README.md) for more information:
- [Architecture](../../artifacts/bmad/planning-artifacts/architecture.md)
- [PRD](../../artifacts/bmad/planning-artifacts/prd.md)
- [Usage Manual](../../docs/usage-manual.md)
- [Dev Guide](../../docs/developer-guide.md)
