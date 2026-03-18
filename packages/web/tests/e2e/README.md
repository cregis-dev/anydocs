# Studio E2E Tests

This directory contains end-to-end tests for the Anydocs Studio (Epic 2: Content Editor).

## Test Structure

```
tests/e2e/
├── studio.spec.ts      # Main Studio E2E tests
└── README.md           # This file
```

## Prerequisites

1. **Install Playwright**:
   ```bash
   npx playwright install chromium
   ```

2. **Start Development Server**:
   ```bash
   pnpm dev
   ```

## Running Tests

### Run all tests
```bash
npx playwright test
```

### Run P0 tests only (critical path)
```bash
npx playwright test --grep "@p0"
```

### Run P1 tests only (high priority)
```bash
npx playwright test --grep "@p1"
```

### Run specific test file
```bash
npx playwright test tests/e2e/studio.spec.ts
```

### Run with UI (interactive)
```bash
npx playwright test --ui
```

### Generate HTML report
```bash
npx playwright show-report
```

## Test Coverage

### P0 - Critical (Must Pass)
- Studio homepage loads
- Three-panel layout renders
- Yoopta editor renders
- Navigation tree renders
- Settings panel renders
- Save status in footer
- Preview button exists

### P1 - High Priority
- Sidebar toggles
- Text input in editor
- Navigation validation display
- Add page via menu
- Tags/status fields
- Auto-save functionality
- Language switcher
- Connection status
- Status confirmation dialog

### P2 - Medium Priority
- All Yoopta block types
- Folder expand/collapse

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| STUDIO_URL | http://localhost:3000/studio | Studio URL |
| CI | - | Set to run in CI mode |

## Notes

- Tests are designed to work with Chrome DevTools MCP
- Some tests will skip if no project is opened (welcome screen)
- Tests use Playwright's built-in waiting strategies
- Screenshot and video are captured on failure
