import { defineManifest } from '@crxjs/vite-plugin'
import pkg from '../package.json' with { type: 'json' }

/**
 * Axiom is the only site this extension touches. Adding anything to
 * `host_permissions` is a deliberate architectural decision, not a convenience —
 * see the permission invariant in CLAUDE.md.
 */
export const AXIOM_MATCHES = ['https://axiom.trade/*', 'https://*.axiom.trade/*']

export default defineManifest({
  manifest_version: 3,
  name: 'Trenched',
  version: pkg.version,
  description: pkg.description,

  // world: "MAIN" content scripts need 111+; WebSocket activity extending the
  // service worker lifetime needs 116+.
  minimum_chrome_version: '116',

  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },

  permissions: ['storage', 'notifications'],
  host_permissions: AXIOM_MATCHES,

  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  action: {
    default_title: 'Trenched',
    default_popup: 'src/popup/index.html',
  },

  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },

  // The MAIN-world tap is deliberately absent from this list. CRXJS compiles
  // every content_scripts entry into an async dynamic-import loader, which
  // would run *after* Axiom constructs its WebSocket — too late to wrap it.
  // The tap is built as a standalone classic script and patched in by the
  // `mainWorldTap` plugin in vite.config.ts, so Chrome runs it synchronously
  // at document_start.
  content_scripts: [
    {
      // Isolated world: relays tap output to the service worker, owns injected
      // UI and audio playback.
      matches: AXIOM_MATCHES,
      js: ['src/content/bridge.ts'],
      run_at: 'document_start',
      world: 'ISOLATED',
      all_frames: false,
    },
  ],
})
