# Trenched

A Google Chrome extension for [Axiom](https://axiom.trade), the memecoin trading terminal.

> **Status:** early setup. Repository scaffolding only — no extension code yet.

## What it is

Trenched augments the Axiom trading terminal in the browser. Because it runs inside a
fast-moving trading UI, the guiding constraint is latency: the extension must never be
the reason a click, a chart update, or a fill feels slow.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Manifest | Chrome MV3 | Required for new Chrome Web Store submissions. |
| Language | TypeScript (strict) | Type safety over Axiom's DOM/API surface. |
| Bundler | Vite + `@crxjs/vite-plugin` | Fast HMR for content scripts, small output bundles. |
| Content script UI | Vanilla TS + DOM, Shadow DOM for isolation | No framework runtime on the hot path; no CSS bleed into Axiom's page. |
| Popup / options UI | Preact | ~4 kB runtime, React-compatible ergonomics, off the hot path. |
| Persistence | `chrome.storage.local` | Async, quota-friendly, survives service worker restarts. |
| Tests | Vitest (unit), Playwright (E2E against a loaded extension) | — |

Requires Node 22+ (developed on Node 24, npm 11).

## Getting started

```bash
npm install
npm run dev     # Vite dev build with HMR, writes to dist/
npm run build   # production build
npm run zip     # packaged artifact for the Chrome Web Store
```

Load the unpacked extension:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` directory.

## Planned layout

```
src/
  manifest.config.ts   # MV3 manifest, typed and generated at build time
  content/             # injected into axiom.trade — keep this lean and hot-path-safe
  background/          # MV3 service worker: alarms, messaging, network
  popup/               # toolbar popup UI (Preact)
  options/             # settings page (Preact)
  lib/                 # shared, side-effect-free helpers
```

## Contributing

This is a personal project. Issues and PRs welcome, but expect the architecture to
move quickly while the extension is being built out.

## License

MIT — see [LICENSE](LICENSE) once added.

## Disclaimer

Trenched is an unofficial, third-party tool. It is not affiliated with, endorsed by, or
supported by Axiom. It is not financial advice. Trading memecoins carries a high risk of
total loss — use at your own risk.
