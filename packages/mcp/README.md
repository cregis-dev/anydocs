# @anydocs/mcp

Model Context Protocol (MCP) server for [Anydocs](https://github.com/cregis-dev/anydocs) — exposes project authoring operations (pages, navigation, build, preview, templates) to MCP-aware AI agents such as Claude Desktop, Cursor, and Cline.

## Trust model

**This server is designed for local, single-user stdio use only.** It runs over `@modelcontextprotocol/sdk`'s `StdioServerTransport` and, by design, grants the calling agent full read/write access to any Anydocs project directory it names via `projectRoot`.

Do **not** expose this process over a network without adding, at minimum:

- an authentication layer,
- a read-only tool profile (filter out tools with `annotations.destructiveHint`),
- `projectRoot` allowlist enforcement (the server honors the `ANYDOCS_MCP_ALLOWED_ROOTS` env var — colon-separated absolute paths — when set),
- per-client rate limiting.

There is no HTTP transport in this package. If you need one, build an adapter that wraps `createAnydocsMcpServer()` with those controls.

## Install / run

```bash
# Run directly (no install):
npx @anydocs/mcp

# Install globally:
npm i -g @anydocs/mcp
anydocs-mcp
```

The server speaks JSON-RPC over stdio and stays alive until it receives SIGINT / SIGTERM / SIGHUP — on any of those, running preview sessions are stopped before the process exits.

## Wire into Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "anydocs": {
      "command": "npx",
      "args": ["-y", "@anydocs/mcp"]
    }
  }
}
```

## Capabilities

- **Tools** (~33) grouped as `project_*`, `page_*`, `nav_*`. Each tool carries `annotations.readOnlyHint` / `destructiveHint` / `idempotentHint` so clients can filter by side-effect profile.
- **Resources** under `anydocs://` URIs — authoring guidance, allowed block types, template index, per-template details, block examples.

Inspect the full list with any MCP client's `listTools` / `listResources` — the server is the source of truth.

## Project-root scoping

Every tool takes an explicit `projectRoot` argument (absolute path). The server resolves it, loads `<projectRoot>/anydocs.config.json`, and performs all I/O under that directory. When `ANYDOCS_MCP_ALLOWED_ROOTS` is set, the resolved path must be inside one of the listed absolute roots or the call is rejected with `MCP_PROJECT_ROOT_OUT_OF_SCOPE`.

## Development

```bash
pnpm --filter @anydocs/mcp dev        # tsx watch
pnpm --filter @anydocs/mcp test       # node:test suites
pnpm --filter @anydocs/mcp typecheck
pnpm --filter @anydocs/mcp build
```
