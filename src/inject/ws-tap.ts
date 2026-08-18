/**
 * MAIN world. Runs at document_start, before Axiom constructs its WebSocket.
 *
 * Rules for this file, in priority order:
 *   1. Never throw into the page. Every callback is wrapped.
 *   2. Never delay, mutate, or swallow a frame Axiom is waiting on.
 *   3. Do as little as possible per frame — this runs at feed rate.
 *
 * No chrome.* APIs exist in this world. Output goes over window.postMessage
 * and is picked up by src/content/bridge.ts.
 */
import { TAP_MARKER, type TapMessage } from '../lib/protocol.ts'

const NativeWebSocket = window.WebSocket

function emit(message: TapMessage): void {
  try {
    window.postMessage(message, window.location.origin)
  } catch {
    // A payload that cannot be structured-cloned is dropped rather than
    // allowed to surface as an error in Axiom's console.
  }
}

function onFrame(data: unknown): void {
  // M1 lands the cheap string prefilter here, ahead of any JSON.parse.
  // Until recon tells us what to look for, observe-only mode forwards nothing.
  void data
}

class TappedWebSocket extends NativeWebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols)

    const href = String(url)

    this.addEventListener('open', () => {
      emit({ marker: TAP_MARKER, type: 'socket-open', url: href })
    })

    this.addEventListener('close', () => {
      emit({ marker: TAP_MARKER, type: 'socket-close', url: href })
    })

    // Added after the page's own listeners are attached in practice, but
    // listener order never delays delivery to Axiom — handlers are independent.
    this.addEventListener('message', (event: MessageEvent) => {
      try {
        onFrame(event.data)
      } catch {
        // Swallow. A bug in our tap must not become a bug in Axiom.
      }
    })
  }
}

window.WebSocket = TappedWebSocket as unknown as typeof WebSocket
