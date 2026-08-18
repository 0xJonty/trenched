# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Trenched is a Chrome MV3 extension that augments [Axiom](https://axiom.trade), a memecoin
trading terminal. It runs inside a live trading UI, so **latency is the primary
non-functional requirement**: the extension must never be the reason the page feels slow.

v1 scope:

- Notification + distinct sound when a coin **bonds** and when it **migrates**.
- **Dev wallet tracking** — named wallet list; alert the moment a tracked dev's new token
  appears in the new-pairs feed.
- **Research button** on token pages — opens X account, X community, website, and an X
  search for the contract address, in one click. Only the links that exist.
- Per-chain and per-event toggles. Chains: Solana, BNB, Robinhood Chain, Ethereum.

## Hard invariants

Break these and the design stops being what it is.

1. **axiom.trade and nothing else.** `permissions` is exactly `storage` + `notifications`;
   `host_permissions` is exactly the Axiom matches. `auditBuiltManifest` in `vite.config.ts`
   fails the build on anything else. Widening `ALLOWED_PERMISSIONS` / `ALLOWED_HOSTS` is a
   deliberate decision, never a fix for a build error.
2. **Zero network egress.** The extension issues no requests of its own beyond same-origin
   Axiom calls and opening research tabs. Nothing is ever transmitted anywhere.
3. **Never read, store, or log credentials.** The tap sees every socket frame, which may
   include session tokens or auth material. Never persist it, never log it, redact before
   any debug output. The extension has no business touching wallet keys.
4. **Content scripts must be synchronous classic scripts.** See below — this is enforced at
   build time and is easy to break by accident.

## Architecture

Four contexts, one job each:

```
MAIN world (src/inject/)          ISOLATED content script (src/content/)
  wraps window.WebSocket            receives postMessage
  at document_start                 owns injected UI + audio
  cheap string prefilter            unlocks AudioContext on first gesture
  postMessage matches         ->    chrome.runtime.sendMessage
        |                                     |
        v                                     v
                          Service worker (src/background/)
                            dedupe -> classify -> match rules -> notifications
                            chrome.tabs.create for research links
                            chrome.storage.local for settings + wallet list
```

**Why the MAIN world.** Content scripts run in an isolated world and cannot see the page's
`window.WebSocket`. Only a `world: "MAIN"` script can wrap it, and only if it runs before
Axiom's bundle constructs a socket.

**Why the tap bypasses CRXJS.** CRXJS compiles every `content_scripts` entry into a loader
that `await import()`s the real module — asynchronous, therefore too late. `src/inject/ws-tap.ts`
is built separately as a self-contained classic IIFE (`dist/ws-tap.js`) by the `mainWorldTap`
plugin in `vite.config.ts`, which then patches the entry into the built manifest.
`verifyClassicScript` fails the build if any content script contains `import`/`export`.
If you add a shared import to a content script and the build starts failing, that is the
guard working — inline the dependency, don't disable the check.

**Why audio lives in the content script.** An offscreen document created with `AUDIO_PLAYBACK`
is auto-closed after 30s of silence, so every alert would pay document-creation latency. The
Axiom tab is open by definition in this design, so decode sounds into `AudioBuffer`s once and
play instantly. Autoplay policy requires user activation: unlock the `AudioContext` on the
first click/keypress in the page, and surface a "click to enable sound" state until then.

## Hot-path rules

`src/inject/ws-tap.ts` runs at feed rate. In priority order:

1. **Never throw into the page.** Every callback wrapped in `try/catch`.
2. **Never delay, mutate, or swallow a frame** Axiom is waiting on.
3. **Prefilter before parsing.** Cheap `indexOf` on the raw string first; `JSON.parse` only
   on frames that could matter. Parsing every frame is the one thing that can make Axiom
   feel slow.
4. No `chrome.*` in the MAIN world — it does not exist there. Output goes over
   `window.postMessage`, checked against `event.source === window` and the page origin.

## The adapter convention

Axiom is third-party and unversioned; its markup and payloads change without notice.
**All knowledge of Axiom's shape lives in exactly two modules:**

- `src/lib/feed-schema.ts` — every socket payload field name and discriminator.
- `src/lib/selectors.ts` — every DOM selector.

Nothing else may reference an Axiom field name or CSS class. When Axiom changes, the blast
radius is two files. Treat every lookup as nullable and degrade silently rather than
throwing into the page.

## Testing

**Fixture-driven, never live-waiting.** Recorded socket frames live in `test/fixtures/`;
replay them through the real pipeline. Do not write a test that waits for an actual bond or
migration to occur.

- `feed-schema.ts` parsing — against recorded fixtures.
- `rules.ts` matching — chain filters, wallet matching, address normalisation. Pure functions.
  Solana base58 is case-sensitive; EVM hex is not. Matching must not miss on case.
- Dedupe LRU behaviour.

## Commands

```bash
npm run dev     # Vite dev build + HMR -> dist/
npm run build   # tsc --noEmit, then vite build (runs the manifest audit)
npm run zip     # Web Store package
npm test        # Vitest
npm run lint    # ESLint + tsc --noEmit
```

**npm, not pnpm** — pnpm is not installed on this machine.

Reload the unpacked extension from `chrome://extensions` after a `build`. Manifest and
service-worker changes always need a manual reload.

## Layout

```
src/
  manifest.config.ts     # typed MV3 manifest (MAIN-world tap added post-build)
  inject/ws-tap.ts       # MAIN world. Hot path. No chrome.* here.
  content/               # bridge, audio, injected research button
  background/            # service worker: classify, dedupe, rules, notify
  lib/                   # feed-schema, selectors, storage, types, protocol
  popup/ options/        # Preact UI, off the hot path
test/fixtures/           # recorded Axiom frames
docs/axiom-feed.md       # observed feed schema
```

## Notes

- The repository is public. Assume anything committed is world-readable.
- The MV3 service worker is not long-lived. Never rely on module-level state in
  `background/` surviving between events; durable state goes in `chrome.storage.local`.
- Trenched is unofficial and not affiliated with Axiom.
