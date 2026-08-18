import { describe, expect, it } from 'vitest'
import { TAP_MARKER, isTapMessage } from '../src/lib/protocol.ts'

describe('isTapMessage', () => {
  it('accepts a message carrying the tap marker', () => {
    expect(isTapMessage({ marker: TAP_MARKER, type: 'socket-open', url: 'wss://x' })).toBe(true)
  })

  it('rejects unrelated page traffic', () => {
    expect(isTapMessage({ type: 'socket-open' })).toBe(false)
    expect(isTapMessage('socket-open')).toBe(false)
    expect(isTapMessage(null)).toBe(false)
    expect(isTapMessage(undefined)).toBe(false)
  })
})
