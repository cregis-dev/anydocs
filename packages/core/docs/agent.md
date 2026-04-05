# Anydocs Agent Guide

If this task is authoring content inside an Anydocs docs project:

- Use `@anydocs/mcp` as the canonical read/write surface.
- Start with `project_open(projectRoot)`.
- Pass `projectRoot` on every MCP call and `lang` on page operations.
- Read `anydocs://authoring/guidance` before multi-step edits or when you need workflow, template, or block rules.
- Prefer `/anydocs:new-page` and `/anydocs:publish-page` for those Claude Code flows when they match the user's intent.
- For legacy Markdown migration, prefer `page_create_from_markdown` for whole-file conversion and `page_update_from_markdown` for replace/append fragment workflows. Use `inputMode: "document"` for full documents and `inputMode: "fragment"` for partial content.
- Review `conversion.warnings` after markdown conversion, especially for MDX, unmapped frontmatter, and simplified markdown constructs such as lists, code fences, tables, links, images, and blockquotes.
- Do not edit `pages/<lang>/*.json` or `navigation/*.json` directly unless MCP cannot express the operation.
- Use `page_set_status` for status changes.
- Re-read the page or navigation after each write; use `project_validate(projectRoot)` when project state is uncertain or after structural changes.
