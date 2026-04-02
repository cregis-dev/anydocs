---
name: 'anydocs:publish-page'
description: 'Publish an existing Anydocs page through the MCP workflow.'
---

Use `@anydocs/mcp` for this workflow.

1. Start with `project_open(projectRoot)`.
2. Read `anydocs://authoring/guidance` before publishing if project rules or workflow state are unclear.
3. Locate the target page with `page_find` or `page_get` and confirm the page id, language, and current status before writing.
4. Use `project_validate(projectRoot)` when project state is uncertain, when recent structural edits may affect publication, or when the user asks for a safer publish pass.
5. Publish with `page_set_status({ status: "published" })`; do not try to change `status` through `page_update`.
6. Re-read the page after publishing to confirm the new status.
7. If MCP returns a validation or workflow error, preserve the original error details and explain them instead of bypassing MCP with direct file edits.
