# Trenched

A Google Chrome extension for [Axiom](https://axiom.trade), the memecoin trading terminal.

> **Status:** M1 — recon. The extension builds and loads, but does not alert yet. It
> currently exists to capture Axiom's socket traffic so the feed schema can be written from
> real data. See [docs/axiom-feed.md](docs/axiom-feed.md).

## What it is

Trenched augments the Axiom trading terminal in the browser. Because it runs inside a
fast-moving trading UI, the guiding constraint is latency: the extension must never be
the reason a click, a chart update, or a fill feels slow.

Planned for v1:

- Notification and a distinct sound when a coin **bonds** and when it **migrates**.
- **Dev wallet tracking** — a named wallet list, alerting the moment a tracked dev's new
  token hits the new-pairs feed.
- A **research button** on token pages that opens the X account, X community, website and an
  X search for the contract address in one click.
- Per-chain and per-event toggles across Solana, BNB, Robinhood Chain and Ethereum.

It reads the WebSocket the Axiom page already opens, so it needs access to `axiom.trade` and
nothing else: no API keys, no backend, no third-party data providers. Alerts fire while an
Axiom tab is open.

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
  inject/              # MAIN world: wraps window.WebSocket. Hot path.
  content/             # ISOLATED world: bridge, audio, injected UI
  background/          # MV3 service worker: classify, dedupe, notify
  popup/ options/      # Preact UI, off the hot path
  lib/                 # shared, side-effect-free helpers
docs/axiom-feed.md     # observed feed schema
```

## Recon

Axiom publishes no developer documentation, so the feed schema has to be observed. Build and
load the extension, open the options page, press **Start recording**, then use Axiom normally.
Frames are grouped by structure and counted, so a long session yields a bounded export rather
than a firehose. Samples are credential-scrubbed and truncated before they are stored.

Full procedure: [docs/axiom-feed.md](docs/axiom-feed.md).

## Contributing

This is a personal project. Issues and PRs welcome, but expect the architecture to
move quickly while the extension is being built out.

## License

MIT — see [LICENSE](LICENSE) once added.

## Disclaimer

Trenched is an unofficial, third-party tool. It is not affiliated with, endorsed by, or
supported by Axiom. It is not financial advice. Trading memecoins carries a high risk of
total loss — use at your own risk.
