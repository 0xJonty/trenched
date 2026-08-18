/**
 * Wire protocol between the MAIN-world tap and the ISOLATED-world bridge.
 *
 * The page can see and forge window.postMessage traffic, so every message
 * carries a marker and is checked against `event.source === window` plus the
 * page origin before it is trusted. Nothing here is a security boundary — it
 * exists to avoid confusing Axiom's own postMessage traffic with ours.
 */
export const TAP_MARKER = '__trenched_tap__' as const
export const CONTROL_MARKER = '__trenched_control__' as const

/** Direction of a recorded frame, from the page's point of view. */
export type FrameDirection = 'in' | 'out'

/** Tap -> bridge. */
export type TapMessage =
  | { marker: typeof TAP_MARKER; type: 'tap-ready' }
  | { marker: typeof TAP_MARKER; type: 'socket-open'; url: string; socketId: number }
  | { marker: typeof TAP_MARKER; type: 'socket-close'; url: string; socketId: number }
  | {
      marker: typeof TAP_MARKER
      type: 'frame'
      socketId: number
      direction: FrameDirection
      /** Raw frame text, truncated by the tap. Binary frames are described, not carried. */
      data: string
      truncated: boolean
    }

/** Bridge -> tap. The tap does no work at all unless recording is switched on. */
export type ControlMessage = {
  marker: typeof CONTROL_MARKER
  type: 'set-recording'
  recording: boolean
}

export function isTapMessage(value: unknown): value is TapMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { marker?: unknown }).marker === TAP_MARKER
  )
}

export function isControlMessage(value: unknown): value is ControlMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { marker?: unknown }).marker === CONTROL_MARKER
  )
}

/** Content script / UI -> service worker. */
export type RuntimeMessage =
  | { type: 'socket-status'; connected: boolean; url: string }
  | {
      type: 'recon-frame'
      direction: FrameDirection
      data: string
      truncated: boolean
      url?: string
    }
  | { type: 'get-recon' }
  | { type: 'set-recording'; recording: boolean }
  | { type: 'clear-recon' }
