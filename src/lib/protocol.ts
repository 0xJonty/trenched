/**
 * Wire protocol between the MAIN-world tap and the ISOLATED-world bridge.
 *
 * The page can see and forge window.postMessage traffic, so every message
 * carries a marker and is checked against `event.source === window` plus the
 * page origin before it is trusted. Nothing here is a security boundary — it
 * exists to avoid confusing Axiom's own postMessage traffic with ours.
 */
export const TAP_MARKER = '__trenched_tap__' as const

export type TapMessage =
  | { marker: typeof TAP_MARKER; type: 'socket-open'; url: string }
  | { marker: typeof TAP_MARKER; type: 'socket-close'; url: string }
  | { marker: typeof TAP_MARKER; type: 'frame'; payload: unknown }

export function isTapMessage(value: unknown): value is TapMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { marker?: unknown }).marker === TAP_MARKER
  )
}

/** Messages the content script and popup send to the service worker. */
export type RuntimeMessage =
  | { type: 'tap-status'; connected: boolean; url?: string }
  | { type: 'feed-frame'; payload: unknown }
  | { type: 'open-research'; urls: string[] }
  | { type: 'get-status' }
