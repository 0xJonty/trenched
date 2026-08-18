/**
 * Copies dist/ somewhere Chrome can load it from.
 *
 * Exists because development happens in WSL while Chrome runs on Windows, and
 * pointing "Load unpacked" at a \\wsl.localhost UNC path is slower and flakier
 * than loading from a native Windows directory. Set TRENCHED_STAGE_DIR to
 * override the destination; a no-op anywhere the default target is absent.
 */
import { cp, mkdir, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

const DEFAULT_WINDOWS_HOME = '/mnt/c/Users'

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function resolveTarget() {
  if (process.env.TRENCHED_STAGE_DIR) return process.env.TRENCHED_STAGE_DIR

  const candidate = join(DEFAULT_WINDOWS_HOME, basename(homedir()), 'trenched-ext')
  const parent = join(DEFAULT_WINDOWS_HOME, basename(homedir()))
  return (await exists(parent)) ? candidate : null
}

if (!(await exists('dist'))) {
  console.error('[stage] dist/ not found — run "npm run build" first.')
  process.exit(1)
}

const target = await resolveTarget()
if (!target) {
  console.warn('[stage] no Windows home found; nothing to do. Set TRENCHED_STAGE_DIR to override.')
  process.exit(0)
}

// Replace rather than merge: a stale file from a previous build that Chrome
// still loads is a genuinely confusing way to lose an afternoon.
await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
await cp('dist', target, { recursive: true })

console.warn(`[stage] ${target}`)
console.warn('[stage] reload the extension at chrome://extensions')
