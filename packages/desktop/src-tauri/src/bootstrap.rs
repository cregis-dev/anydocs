//! Shell-layer renderer bootstrap injected before any application JavaScript.
//!
//! Story 9.1 wires two guarantees into the webview *before* the web bundle's
//! own scripts run (Tauri injects plugin `js_init_script` at webview creation):
//!
//! 1. **Runtime-mode signal (AC3).** Sets the explicit host-bootstrap global
//!    `__ANYDOCS_RUNTIME_MODE__ = 'desktop'`. `@anydocs/core`'s
//!    `resolveRuntimeMode()` reads this global as an explicit signal — ranked
//!    above the defensive Tauri capability probe.
//! 2. **`/api/local/*` block (AC4).** Wraps `fetch` and `XMLHttpRequest.open`
//!    so any renderer request whose path starts with `/api/local/` is rejected
//!    at the shell layer. Desktop mode never uses `/api/local/*`; this fails
//!    fast on regressions and seeds Story 9.6's zero-`/api/local/*` validation
//!    (FR52). The managed desktop-server (`http://127.0.0.1:33440/studio/*`)
//!    has a different path and is unaffected.

/// The renderer-global key carrying the explicit desktop runtime-mode signal.
/// Mirrors `RUNTIME_MODE_GLOBAL_KEY` in `@anydocs/core` runtime-mode.ts.
pub const RUNTIME_MODE_GLOBAL_KEY: &str = "__ANYDOCS_RUNTIME_MODE__";

/// Build the JavaScript injected into the main frame before app code runs.
pub fn desktop_bootstrap_script() -> String {
    format!(
        r#"(function () {{
  var KEY = "{key}";
  try {{
    Object.defineProperty(globalThis, KEY, {{
      value: "desktop",
      writable: false,
      configurable: false,
      enumerable: false,
    }});
  }} catch (_e) {{
    try {{ globalThis[KEY] = "desktop"; }} catch (_e2) {{}}
  }}

  var BLOCKED_PATH = /^\/api\/local\//;
  function anydocsIsBlocked(target) {{
    try {{
      var raw =
        typeof target === "string"
          ? target
          : target && typeof target.url === "string"
            ? target.url
            : "";
      if (!raw) return false;
      var base =
        globalThis.location && globalThis.location.href
          ? globalThis.location.href
          : "http://localhost/";
      return BLOCKED_PATH.test(new URL(raw, base).pathname);
    }} catch (_e) {{
      return false;
    }}
  }}
  var BLOCK_MESSAGE =
    "[anydocs] /api/local/* is disabled in desktop runtime mode";

  var originalFetch = globalThis.fetch;
  if (typeof originalFetch === "function") {{
    globalThis.fetch = function (input, init) {{
      if (anydocsIsBlocked(input)) {{
        return Promise.reject(new Error(BLOCK_MESSAGE));
      }}
      // Native fetch must be invoked bound to the global scope (not the
      // wrapper's `this`), or WebKit throws "Illegal invocation".
      return originalFetch.apply(globalThis, arguments);
    }};
  }}

  var OriginalXHR = globalThis.XMLHttpRequest;
  if (typeof OriginalXHR === "function" && OriginalXHR.prototype) {{
    var originalOpen = OriginalXHR.prototype.open;
    OriginalXHR.prototype.open = function (method, url) {{
      if (anydocsIsBlocked(url)) {{
        throw new Error(BLOCK_MESSAGE);
      }}
      return originalOpen.apply(this, arguments);
    }};
  }}
}})();
"#,
        key = RUNTIME_MODE_GLOBAL_KEY,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sets_desktop_runtime_mode_global_before_app_code() {
        let script = desktop_bootstrap_script();
        assert!(script.contains(RUNTIME_MODE_GLOBAL_KEY));
        assert!(
            script.contains(r#"value: "desktop""#),
            "must define the runtime-mode global as 'desktop'"
        );
    }

    #[test]
    fn installs_local_api_block_on_fetch_and_xhr() {
        let script = desktop_bootstrap_script();
        // Path matcher targets exactly /api/local/* and nothing else.
        assert!(script.contains(r"/^\/api\/local\//"));
        // Both renderer network surfaces are guarded.
        assert!(
            script.contains("globalThis.fetch = function"),
            "fetch must be wrapped"
        );
        assert!(
            script.contains("OriginalXHR.prototype.open = function"),
            "XMLHttpRequest.open must be wrapped"
        );
    }

    #[test]
    fn block_message_is_actionable() {
        assert!(desktop_bootstrap_script().contains("desktop runtime mode"));
    }
}
