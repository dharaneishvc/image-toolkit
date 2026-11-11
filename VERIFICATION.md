# Image Toolkit Verification

Verified locally on Windows with Node.js 24 on 2026-11-01. This report applies only to this repository.

| Check | Result |
| --- | --- |
| Supported catalog | 20 tools |
| Unit tests | 27 passed |
| Desktop/mobile browser cases | 10 passed |
| Locked dependency install | `npm ci` passed |
| Source lint | Passed with one advisory warning |
| TypeScript and production build | Passed |
| Dependency audit | Zero reported vulnerabilities at verification time |
| Editor diagnostics | No errors |

## Verified Coverage

- Geometry, aspect locking, crop/rotation bounds, output allocation limits, and palette quantization.
- Known red/blue canvas pixels for mirroring and grayscale, crop/rotate/resize dimensions, and real PNG/JPEG export bytes.
- Undo/redo, sample loading, batch ZIP members, contact-sheet dimensions, all tool navigation, SVG rejection, and invalid crops.
- Metadata-only IndexedDB history, retention cap, clearing, and favorites persistence at the storage layer.
- Axe accessibility scans, desktop/mobile horizontal-overflow checks, and reviewed screenshots for tested states.
- Workflow/dependency YAML parsing and least-privilege Pages deployment gates.
- A painted live development canvas using the locally bundled photograph. The integrated browser paused pointer visibility waits in a background tab, so this dev smoke job was dispatched programmatically; production Playwright tests independently verified normal pointer interactions.

## Reproduce

Run inside this repository:

```sh
npm ci
npm run check
npm audit --audit-level=high
npx playwright install chromium
npm run test -- --reporter=default --reporter=junit --outputFile=test-results/unit.xml
npm run test:e2e
```

Reports are generated in ignored `playwright-report/` and `test-results/` directories. Unit and browser JUnit files were confirmed present. Browser artifacts use `test-results/browser/` so browser startup does not erase unit reports. Counts above describe the recorded full verification run, not a claim that every subsequent documentation edit reran browser tests.

## Warnings and Unverified Requirements

One advisory React lint warning concerns synchronous metadata loading state in an effect. It does not fail the configured source gate; it is not a claim of zero warnings.

GitHub Actions and Jenkins configuration are present, but were not executed on live GitHub/Jenkins infrastructure. Remote publication, reviewed initial commits, Pages settings, required PR checks, an isolated Jenkins Multibranch runner/webhook, and a distribution-license choice require owner setup. No paid/cloud API or GitHub credit-funded call was used.

Safari/Firefox certification, hostile-file penetration testing, production-load testing, animation/RAW/ICC parity, and secure redaction guarantees were not verified. Blur/pixelation and metadata omission are not forensic sanitization. See the [README](README.md) for formats and limits, [Architecture](docs/ARCHITECTURE.md) for HLD/LLD/local BE/DB design, and [Operations](docs/OPERATIONS.md) for deployment.

## Local App Status

The development server is stopped. Restart from this repository with `npm run dev -- --port 5174`, then open http://localhost:5174/. Images remain in browser memory; IndexedDB stores preferences and job metadata only.