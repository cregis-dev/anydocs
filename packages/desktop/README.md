# anydocs-desktop

Tauri shell scaffold for Anydocs.

## Scripts

```bash
pnpm dev        # run the local web shell in Vite
pnpm tauri:dev  # run the Tauri desktop shell with the local web shell
pnpm build      # type-check and build the local web shell
pnpm tauri:build
```

## Notes

- The shell is intentionally minimal.
- The native bridge currently exposes app info and a folder picker.
- Studio and the Node desktop server will be wired in later without changing the Tauri shell shape.
