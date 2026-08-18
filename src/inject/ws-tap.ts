/**
 * MAIN world. Runs at document_start, before Axiom constructs its WebSocket.
 *
 * Rules for this file, in priority order:
 *   1. Never throw into the page. Every callback is wrapped.
 *   2. Never delay, mutate, or swallow a frame Axiom is waiting on.
 *   3. Do as little as possible per frame — this runs at feed rate.
 *
 * No chrome.* APIs exist in this world. Output goes over window.postMessage and
 * is picked up by src/content/bridge.ts.
 *
 * M1 state: recording only, and off unless the bridge switches it on. When
 * recording is off the message hook returns after a single boolean test, so the
 * cost to Axiom of having this installed is a function call per frame.
 */
import {
  TAP_MARKER,
  isControlMessage,
  type FrameDirection,
  type TapMessage,
} from '../lib/protocol.ts'

/** Frames above this are truncated before crossing postMessage. */
const MAX_FRAME_CHARS = 8192

const NativeWebSocket = window.WebSocket

let recording = false
let socketCounterSeed = 0

function emit(message: TapMessage): void {
  try {
    window.postMessage(message, window.location.origin)
  } catch {
    // A payload that cannot be structured-cloned is dropped rather than
    // allowed to surface as an error in Axiom's console.
  }
}

function emitFrame(socketId: number, direction: FrameDirection, data: unknown): void {
  // Binary frames are described rather than carried: decoding an ArrayBuffer on
  // the hot path is exactly the kind of work this file must not do. Recon still
  // learns that the socket uses binary, which is the finding that matters.
  if (typeof data !== 'string') {
    emit({
      marker: TAP_MARKER,
      type: 'frame',
      socketId,
      direction,
      data: `[non-string frame: ${describe(data)}]`,
      truncated: false,
    })
    return
  }

  const truncated = data.length > MAX_FRAME_CHARS
  emit({
    marker: TAP_MARKER,
    type: 'frame',
    socketId,
    direction,
    data: truncated ? data.slice(0, MAX_FRAME_CHARS) : data,
    truncated,
  })
}

function describe(data: unknown): string {
  if (data instanceof ArrayBuffer) return `ArrayBuffer(${data.byteLength})`
  if (typeof Blob !== 'undefined' && data instanceof Blob) return `Blob(${data.size})`
  return Object.prototype.toString.call(data)
}

class TappedWebSocket extends NativeWebSocket {
  readonly __trenchedId: number

  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols)

    const socketId = ++socketCounterSeed
    this.__trenchedId = socketId
    const href = String(url)

    this.addEventListener('open', () => {
      emit({ marker: TAP_MARKER, type: 'socket-open', url: href, socketId })
    })

    this.addEventListener('close', () => {
      emit({ marker: TAP_MARKER, type: 'socket-close', url: href, socketId })
    })

    this.addEventListener('message', (event: MessageEvent) => {
      if (!recording) return
      try {
        emitFrame(socketId, 'in', event.data)
      } catch {
        // Swallow. A bug in our tap must not become a bug in Axiom.
      }
    })
  }

  /**
   * Outbound frames are captured because the subscribe format is the thing M1
   * most needs: joining Axiom's own rooms is what makes alerts work from any
   * tab rather than only from Pulse.
   */
  override send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    // The page's frame goes out first, always. Recon never delays a send.
    super.send(data as Parameters<WebSocket['send']>[0])
    if (!recording) return
    try {
      emitFrame(this.__trenchedId, 'out', data)
    } catch {
      // Swallow.
    }
  }
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  if (event.origin !== window.location.origin) return
  if (!isControlMessage(event.data)) return
  if (event.data.type === 'set-recording') recording = event.data.recording
})

window.WebSocket = TappedWebSocket as unknown as typeof WebSocket

// Lets the bridge know the tap is installed, so a control message that arrives
// before this point is not simply lost.
emit({ marker: TAP_MARKER, type: 'tap-ready' })
