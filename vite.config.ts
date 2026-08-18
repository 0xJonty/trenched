import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build, defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import { crx } from '@crxjs/vite-plugin'
import manifest, { AXIOM_MATCHES } from './src/manifest.config.ts'

const TAP_ENTRY = 'src/inject/ws-tap.ts'
const TAP_OUTPUT = 'ws-tap.js'

/**
 * Builds the MAIN-world WebSocket tap as a self-contained classic script and
 * registers it in the built manifest.
 *
 * Why this exists: CRXJS rewrites every `content_scripts` entry into a loader
 * that `await import()`s the real module. That is asynchronous, so the tap
 * would install its WebSocket wrapper after Axiom had already opened its
 * socket, and we would see nothing. A classic (non-module) script declared in
 * the manifest is executed synchronously at document_start, before any page
 * script runs — which is the only timing that works here.
 *
 * The output must therefore stay import-free. `verifyClassicScript` enforces
 * that, so a stray dynamic import can never silently reintroduce the race.
 */
function mainWorldTap(): Plugin {
  return {
    name: 'trenched:main-world-tap',
    apply: 'build',
    enforce: 'post',
    async closeBundle() {
      await build({
        configFile: false,
        logLevel: 'warn',
        build: {
          outDir: 'dist',
          emptyOutDir: false,
          target: 'chrome116',
          sourcemap: true,
          lib: {
            entry: resolve(TAP_ENTRY),
            formats: ['iife'],
            name: '__trenchedTap',
            fileName: () => TAP_OUTPUT,
          },
        },
      })

      const manifestPath = resolve('dist/manifest.json')
      const built = JSON.parse(await readFile(manifestPath, 'utf8'))
      built.content_scripts = [
        {
          matches: AXIOM_MATCHES,
          js: [TAP_OUTPUT],
          run_at: 'document_start',
          world: 'MAIN',
          all_frames: false,
        },
        ...(built.content_scripts ?? []),
      ]
      await writeFile(manifestPath, JSON.stringify(built, null, 2))

      await auditBuiltManifest(built)
    },
  }
}

/** Permissions the extension is allowed to ship with. Widening this list is a
 *  decision to make deliberately — see the permission invariant in CLAUDE.md. */
const ALLOWED_PERMISSIONS = ['storage', 'notifications']
const ALLOWED_HOSTS = AXIOM_MATCHES

/**
 * Build-time enforcement of the two invariants that are easy to break by
 * accident: the extension asks for nothing beyond Axiom, and every content
 * script runs synchronously at document_start.
 */
async function auditBuiltManifest(built: Record<string, unknown>): Promise<void> {
  const permissions = (built.permissions as string[]) ?? []
  const hosts = (built.host_permissions as string[]) ?? []

  const extraPermissions = permissions.filter((p) => !ALLOWED_PERMISSIONS.includes(p))
  const extraHosts = hosts.filter((h) => !ALLOWED_HOSTS.includes(h))
  if (extraPermissions.length || extraHosts.length) {
    throw new Error(
      `[trenched] manifest requests more than it should — permissions: ${extraPermissions.join(', ') || 'none'}; ` +
        `hosts: ${extraHosts.join(', ') || 'none'}. Widen ALLOWED_* in vite.config.ts only on purpose.`,
    )
  }

  const scripts = (built.content_scripts as { js?: string[] }[]) ?? []
  for (const file of scripts.flatMap((s) => s.js ?? [])) {
    await verifyClassicScript(resolve('dist', file))
  }
}

/**
 * Fails the build if a content script is not synchronously executable.
 *
 * A script containing `import` is loaded asynchronously, which means it runs
 * after the page's own bundle — the tap would miss the socket entirely, and the
 * bridge would miss the frames the tap sends before it is listening.
 */
async function verifyClassicScript(path: string): Promise<void> {
  const source = await readFile(path, 'utf8')
  const offenders = [/\bimport\s*\(/, /\bimport\s+[\w{*]/, /\bexport\s/]
  for (const pattern of offenders) {
    if (pattern.test(source)) {
      throw new Error(
        `[trenched] content script ${path} matches ${pattern.source}. Content scripts must be ` +
          'self-contained classic scripts, or they install too late to see the socket.',
      )
    }
  }
}

export default defineConfig({
  plugins: [preact(), crx({ manifest }), mainWorldTap()],
  build: {
    // Chrome-only extension: no point down-levelling for other engines.
    target: 'chrome116',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
