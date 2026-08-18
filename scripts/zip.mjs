/** Packs dist/ into trenched-<version>.zip for Web Store upload. */
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import JSZip from 'jszip'

const DIST = 'dist'

if (!existsSync(DIST)) {
  console.error(`[zip] ${DIST}/ not found — run "npm run build" first.`)
  process.exit(1)
}

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry)
    const info = await stat(full)
    if (info.isDirectory()) out.push(...(await walk(full)))
    else out.push(full)
  }
  return out
}

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const zip = new JSZip()

for (const file of await walk(DIST)) {
  // Source maps are useful locally and pure bloat in a Store upload.
  if (file.endsWith('.map')) continue
  zip.file(relative(DIST, file), createReadStream(file))
}

const out = `trenched-${version}.zip`
writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
console.warn(`[zip] wrote ${out}`)
