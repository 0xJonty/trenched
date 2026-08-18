/**
 * ISOLATED world. The only place that talks to both the page and the service
 * worker.
 *
 * Kept import-free in its built output for the same reason as the tap: a
 * content script that is loaded asynchronously starts listening after the page
 * has already begun talking. See `verifyClassicScript` in vite.config.ts.
 */
import {
  CONTROL_MARKER,
  isTapMessage,
  type ControlMessage,
  type RuntimeMessage,
} from '../lib/protocol.ts'

/** Most recent socket URL seen, attached to recorded frames for context. */
let currentUrl: string | undefined

function toWorker(message: RuntimeMessage): void {
  // The service worker may be asleep or mid-restart; a failed send is normal
  // and must not surface in Axiom's console.
  void chrome.runtime.sendMessage(message).catch(() => {})
}

function toPage(message: ControlMessage): void {
  window.postMessage(message, window.location.origin)
}

async function pushRecordingState(): Promise<void> {
  try {
    // Read the flag directly rather than via lib/storage.ts: importing that
    // would pull the whole recon module graph into this content script.
    const result = (await chrome.storage.local.get('recon')) as {
      recon?: { recording?: boolean }
    }
    toPage({
      marker: CONTROL_MARKER,
      type: 'set-recording',
      recording: Boolean(result.recon?.recording),
    })
  } catch {
    // Extension context invalidated (reloaded while the page was open).
  }
}

window.addEventListener('message', (event: MessageEvent) => {
  // Only trust messages this window posted to itself.
  if (event.source !== window) return
  if (event.origin !== window.location.origin) return
  if (!isTapMessage(event.data)) return

  const message = event.data

  switch (message.type) {
    case 'tap-ready':
      void pushRecordingState()
      break

    case 'socket-open':
      currentUrl = message.url
      toWorker({ type: 'socket-status', connected: true, url: message.url })
      break

    case 'socket-close':
      toWorker({ type: 'socket-status', connected: false, url: message.url })
      break

    case 'frame':
      toWorker({
        type: 'recon-frame',
        direction: message.direction,
        data: message.data,
        truncated: message.truncated,
        ...(currentUrl === undefined ? {} : { url: currentUrl }),
      })
      break
  }
})

// Recording is toggled from the options page, which lives in another context.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.recon) return
  const next = changes.recon.newValue as { recording?: boolean } | undefined
  toPage({
    marker: CONTROL_MARKER,
    type: 'set-recording',
    recording: Boolean(next?.recording),
  })
})

// The tap may have signalled readiness before this script attached its
// listener; asking again costs nothing and closes that gap.
void pushRecordingState()
