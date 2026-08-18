/**
 * MV3 service worker. Terminates when idle — hold no state here that matters.
 * Anything durable belongs in chrome.storage.local.
 *
 * M1 responsibility: fold recorded frames into the recon store. Writes are
 * debounced because a busy Pulse feed would otherwise hit storage on every
 * frame, which is both slow and pointless.
 */
import { emptyStore, noteSocket, recordFrame, type ReconStore } from '../lib/recon.ts'
import type { RuntimeMessage } from '../lib/protocol.ts'
import { get, set } from '../lib/storage.ts'

const FLUSH_DELAY_MS = 750

let cached: ReconStore | undefined
let flushTimer: ReturnType<typeof setTimeout> | undefined
let dirty = false

async function store(): Promise<ReconStore> {
  // The worker can be torn down between events, so the cache is an optimisation
  // and never the source of truth.
  cached ??= await get('recon')
  return cached
}

function scheduleFlush(): void {
  dirty = true
  if (flushTimer !== undefined) return
  flushTimer = setTimeout(() => {
    flushTimer = undefined
    void flush()
  }, FLUSH_DELAY_MS)
}

async function flush(): Promise<void> {
  if (!dirty || !cached) return
  dirty = false
  await set('recon', cached)
}

chrome.runtime.onInstalled.addListener(() => {
  console.warn('[trenched] installed')
})

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  switch (message.type) {
    case 'socket-status': {
      if (!message.connected) break
      void (async () => {
        noteSocket(await store(), message.url)
        scheduleFlush()
      })()
      break
    }

    case 'recon-frame': {
      void (async () => {
        const current = await store()
        if (!current.recording) return
        recordFrame(current, { direction: message.direction, data: message.data }, Date.now())
        scheduleFlush()
      })()
      break
    }

    case 'get-recon': {
      void (async () => {
        await flush()
        sendResponse(await store())
      })()
      return true // response is asynchronous

    }

    case 'set-recording': {
      void (async () => {
        const current = await store()
        current.recording = message.recording
        dirty = true
        await flush()
        sendResponse(current)
      })()
      return true
    }

    case 'clear-recon': {
      void (async () => {
        const recording = (await store()).recording
        cached = emptyStore()
        cached.recording = recording
        dirty = true
        await flush()
        sendResponse(cached)
      })()
      return true
    }
  }
  return false
})
