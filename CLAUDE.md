# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Trenched is a Chrome MV3 extension that augments [Axiom](https://axiom.trade), a memecoin
trading terminal. It is injected into a live trading UI, so **latency is the primary
non-functional requirement**: the extension must never be the reason the page feels slow.

## Stack

- Chrome MV3, TypeScript in `strict` mode.
- Vite + `@crxjs/vite-plugin` for bundling and content-script HMR.
- Content scripts: vanilla TS + DOM, rendered into a Shadow DOM root. No UI framework here.
- Popup and options pages: Preact (off the hot path, so the runtime cost is acceptable).
- State: `chrome.storage.local`. The MV3 service worker is not long-lived — never rely on
  module-level variables in `background/` surviving between events.
- Tests: Vitest for units, Playwright for E2E against a loaded unpacked extension.
- Node 22+ (developed on Node 24 / npm 11). **npm is the package manager — pnpm is not
  installed on this machine.**

## Commands

```bash
npm run dev     # Vite dev build + HMR -> dist/
npm run build   # production build
npm run zip     # Web Store package
npm test        # Vitest
npm run lint    # ESLint + tsc --noEmit
```

Reload the unpacked extension from `chrome://extensions` after a `build`; content-script
HMR covers most `dev` changes but manifest and service-worker changes need a manual reload.

## Layout

```
src/
  manifest.config.ts   # typed MV3 manifest, generated at build time
  content/             # injected into axiom.trade — hot path, keep lean
  background/          # MV3 service worker: alarms, messaging, network
  popup/               # toolbar popup (Preact)
  options/             # settings page (Preact)
  lib/                 # shared, side-effect-free helpers
```

## Conventions

- **Hot path discipline.** In `content/`, avoid layout thrash: batch DOM reads before
  writes, and put per-frame work behind `requestAnimationFrame`. Prefer `MutationObserver`
  with a narrow subtree over polling. Never block on `await` inside an observer callback.
- **Style isolation.** All injected UI goes inside a Shadow DOM root. Do not add global
  styles or mutate Axiom's own classes/attributes.
- **Defensive DOM.** Axiom's markup is third-party and unversioned; it will change without
  notice. Centralize selectors in one module, treat every lookup as nullable, and degrade
  silently rather than throwing into the page.
- **Permissions.** Keep `manifest.permissions` and `host_permissions` minimal — additions
  trigger Web Store review friction and re-prompt existing users. Justify any new one.
- **Secrets.** Anything shipped in the extension bundle is public. Never commit or bundle
  API keys, wallet keys, or seed phrases. `.env` is gitignored; add new vars to
  `.env.example` with placeholder values.
- **No credential handling.** The extension must not read, store, or transmit the user's
  wallet keys or session credentials.

## Notes

- The repository is public. Assume anything committed is world-readable.
- Trenched is unofficial and not affiliated with Axiom.
