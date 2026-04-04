# Page Template Example

This example isolates custom authoring-template behavior.

Use it when you want to inspect how `authoring.pageTemplates`, `template`, and `metadata` work together without starter-project concerns or agent workflow docs mixed in.

## Structure

```
examples/page-template-docs/
├── anydocs.config.json
├── anydocs.workflow.json
├── pages/
│   ├── zh/*.json
│   └── en/*.json
├── navigation/
│   ├── zh.json
│   └── en.json
└── .gitignore
```

## What This Example Covers

- custom page template registration
- metadata schema fields
- template-backed published pages
- bilingual template documentation

## Quick Start

```bash
node --experimental-strip-types packages/cli/src/index.ts build examples/page-template-docs
node --experimental-strip-types packages/cli/src/index.ts preview examples/page-template-docs
```

Or open Studio and select `examples/page-template-docs` as the project path.
