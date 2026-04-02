# Anydocs Examples

This directory contains example documentation projects demonstrating Anydocs features.

## Available Examples

### demo-docs

A basic demonstration project showcasing:
- Multi-language support (Chinese & English)
- Page content with Yoopta editor format
- Navigation tree structure
- Project configuration

**Location:** `examples/demo-docs/`

**Build:**
```bash
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs
```

**Preview:**
```bash
node --experimental-strip-types packages/cli/src/index.ts preview examples/demo-docs
```

See [demo-docs/README.md](demo-docs/README.md) for detailed instructions.

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
# Copy example project
cp -r examples/demo-docs ./my-docs-project

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
├── pages/                    # Required: page content
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
