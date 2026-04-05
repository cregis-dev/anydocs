---
name: 'anydocs:new-page'
description: 'Create a new Anydocs page through MCP and optionally place it in navigation.'
---

Use `@anydocs/mcp` for this workflow.

1. Start with `project_open(projectRoot)`.
2. Read `anydocs://authoring/guidance` before choosing tools or templates.
3. Confirm the target `lang`, `title`, `slug`, page summary, optional template, and optional navigation placement from the user's request. Ask only when a missing field would make the write unsafe.
4. If template choice is unclear, use `page_template_query` (or inspect `project_open.authoring.templates`) before writing.
5. If the user asks to create or update a custom template definition, use `page_template_save` instead of `project_update_config`.
6. Inspect the current project state with `page_list`, `page_find`, `page_get`, or `nav_get` before writing.
7. Prefer `page_create_from_template` when the user wants a structured first draft; otherwise use `page_create`.
8. `page_create_from_template` accepts both built-in templates and project-defined template ids; include `metadata` when the selected template requires it.
9. If the user wants the page added to navigation, use `nav_insert` after reading the current navigation.
10. Re-read the created page and any changed navigation after the write. Use `project_validate(projectRoot)` when the change affected navigation or other project structure.
11. Do not edit `pages/<lang>/*.json` or `navigation/*.json` directly unless MCP cannot express the operation.
