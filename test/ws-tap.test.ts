/**
 * Exercises the MAIN-world tap against a fake WebSocket.
 *
 * The tap is the one piece of this extension that runs inside someone else's
 * hot path, so its contract is tested directly rather than inferred: it must
 * stay silent until recording is switched on, must never delay a send, and must
 * never let its own failure reach the page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONTROL_MARKER, TAP_MARKER, type TapMessage } from '../src/lib/protocol.ts'

const ORIGIN = 'https://axiom.trade'

interface Listener {
  (event: unknown): void
}

/** Stand-in for the browser WebSocket the page would otherwise construct. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  sent: unknown[] = []
  listeners = new Map<string, Listener[]>()

  constructor(
    public url: string | URL,
    public protocols?: string | string[],
  ) {
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type: string, listener: Listener): void {
    const existing = this.listeners.get(type) ?? []
    existing.push(listener)
    this.listeners.set(type, existing)
  }

  send(data: unknown): void {
    this.sent.push(data)
  }

  dispatch(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

interface FakeWindow {
  WebSocket: unknown
  location: { origin: string }
  postMessage(message: unknown, origin: string): void
  addEventListener(type: string, listener: Listener): void
}

let posted: TapMessage[] = []
let windowListeners: Listener[] = []

async function loadTap(): Promise<void> {
  posted = []
  windowListeners = []
  FakeWebSocket.instances = []

  const fakeWindow: FakeWindow = {
    WebSocket: FakeWebSocket,
    location: { origin: ORIGIN },
    postMessage(message) {
      posted.push(message as TapMessage)
    },
    addEventListener(type, listener) {
      if (type === 'message') windowListeners.push(listener)
    },
  }

  vi.stubGlobal('window', fakeWindow)
  vi.resetModules()
  await import('../src/inject/ws-tap.ts')
}

/** Delivers a control message the way the bridge would. */
function sendControl(recording: boolean): void {
  for (const listener of windowListeners) {
    listener({
      source: globalThis.window,
      origin: ORIGIN,
      data: { marker: CONTROL_MARKER, type: 'set-recording', recording },
    })
  }
}

function openSocket(): FakeWebSocket {
  const Wrapped = (globalThis.window as unknown as FakeWindow).WebSocket as new (
    url: string,
  ) => FakeWebSocket
  const socket = new Wrapped('wss://cluster3.axiom.trade/')
  socket.dispatch('open', {})
  return socket
}

function framesOnly(): Extract<TapMessage, { type: 'frame' }>[] {
  return posted.filter((m): m is Extract<TapMessage, { type: 'frame' }> => m.type === 'frame')
}

beforeEach(loadTap)
afterEach(() => vi.unstubAllGlobals())

describe('installation', () => {
  it('replaces window.WebSocket and announces itself', () => {
    expect((globalThis.window as unknown as FakeWindow).WebSocket).not.toBe(FakeWebSocket)
    expect(posted).toContainEqual({ marker: TAP_MARKER, type: 'tap-ready' })
  })

  it('still constructs a real socket with the arguments the page passed', () => {
    openSocket()
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.instances[0]?.url).toBe('wss://cluster3.axiom.trade/')
  })
})

describe('recording gate', () => {
  it('forwards no frames until recording is switched on', () => {
    const socket = openSocket()
    socket.dispatch('message', { data: '{"type":"new_pair"}' })
    expect(framesOnly()).toHaveLength(0)
  })

  it('forwards inbound frames once recording is on', () => {
    sendControl(true)
    const socket = openSocket()
    socket.dispatch('message', { data: '{"type":"new_pair"}' })

    const frames = framesOnly()
    expect(frames).toHaveLength(1)
    expect(frames[0]).toMatchObject({ direction: 'in', data: '{"type":"new_pair"}' })
  })

  it('stops again when recording is switched off', () => {
    sendControl(true)
    const socket = openSocket()
    socket.dispatch('message', { data: '{"a":1}' })
    sendControl(false)
    socket.dispatch('message', { data: '{"a":2}' })
    expect(framesOnly()).toHaveLength(1)
  })

  it('ignores control messages from another origin', () => {
    for (const listener of windowListeners) {
      listener({
        source: globalThis.window,
        origin: 'https://evil.example',
        data: { marker: CONTROL_MARKER, type: 'set-recording', recording: true },
      })
    }
    const socket = openSocket()
    socket.dispatch('message', { data: '{"a":1}' })
    expect(framesOnly()).toHaveLength(0)
  })
})

describe('send', () => {
  it("passes the page's data through to the real socket even while recording", () => {
    sendControl(true)
    const socket = openSocket()
    ;(socket as unknown as { send(data: string): void }).send('{"room":"pulse"}')

    expect(socket.sent).toEqual(['{"room":"pulse"}'])
    expect(framesOnly()).toMatchObject([{ direction: 'out', data: '{"room":"pulse"}' }])
  })

  it('delivers to the real socket before recording the frame', () => {
    sendControl(true)
    const socket = openSocket()
    const order: string[] = []

    // Spy on the prototype, not the instance: the tap calls `super.send`, which
    // resolves through FakeWebSocket.prototype. An own property on the instance
    // would shadow the tap's own override and the test would prove nothing.
    const realSend = FakeWebSocket.prototype.send
    FakeWebSocket.prototype.send = function patched(this: FakeWebSocket, data: unknown) {
      order.push('page')
      realSend.call(this, data)
    }
    const realPost = (globalThis.window as unknown as FakeWindow).postMessage
    ;(globalThis.window as unknown as FakeWindow).postMessage = (m, o) => {
      order.push('tap')
      realPost(m, o)
    }

    try {
      ;(socket as unknown as { send(data: string): void }).send('x')
    } finally {
      FakeWebSocket.prototype.send = realSend
    }

    expect(order).toEqual(['page', 'tap'])
    expect(socket.sent).toEqual(['x'])
  })

  it('still sends when the page passes something unrecordable', () => {
    sendControl(true)
    const socket = openSocket()
    const binary = new ArrayBuffer(8)
    ;(socket as unknown as { send(data: ArrayBuffer): void }).send(binary)

    expect(socket.sent).toEqual([binary])
    expect(framesOnly()[0]?.data).toContain('ArrayBuffer(8)')
  })
})

describe('resilience', () => {
  it('truncates oversized frames instead of posting them whole', () => {
    sendControl(true)
    const socket = openSocket()
    socket.dispatch('message', { data: 'y'.repeat(20_000) })

    const frame = framesOnly()[0]
    expect(frame?.truncated).toBe(true)
    expect(frame?.data.length).toBe(8192)
  })

  it('does not throw into the page when postMessage fails', () => {
    sendControl(true)
    const socket = openSocket()
    ;(globalThis.window as unknown as FakeWindow).postMessage = () => {
      throw new Error('structured clone failed')
    }

    expect(() => socket.dispatch('message', { data: '{"a":1}' })).not.toThrow()
  })

  it('tracks each socket separately across a reconnect', () => {
    sendControl(true)
    const first = openSocket()
    const second = openSocket()
    first.dispatch('message', { data: '{"a":1}' })
    second.dispatch('message', { data: '{"b":2}' })

    const ids = framesOnly().map((f) => f.socketId)
    expect(new Set(ids).size).toBe(2)
  })
})
