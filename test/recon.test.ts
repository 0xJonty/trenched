import { describe, expect, it } from 'vitest'
import { parseFrame, shapeOf } from '../src/lib/shape.ts'
import {
  MAX_SAMPLES_PER_SHAPE,
  MAX_SHAPES,
  emptyStore,
  noteSocket,
  recordFrame,
  shapesByFrequency,
} from '../src/lib/recon.ts'

describe('shapeOf', () => {
  it('groups frames with the same structure', () => {
    const a = shapeOf({ mint: 'x', name: 'A' })
    const b = shapeOf({ name: 'B', mint: 'y' })
    expect(a.signature).toBe(b.signature)
  })

  it('separates frames that differ only by discriminator', () => {
    const pair = shapeOf({ type: 'new_pair', mint: 'x' })
    const migrated = shapeOf({ type: 'migrated', mint: 'x' })
    expect(pair.signature).not.toBe(migrated.signature)
  })

  it('describes arrays and primitives without throwing', () => {
    expect(shapeOf([{ a: 1 }]).signature).toBe('array<{a}>')
    expect(shapeOf([]).signature).toBe('array<empty>')
    expect(shapeOf(null).signature).toBe('null')
    expect(shapeOf(7).signature).toBe('number')
  })
})

describe('parseFrame', () => {
  it('parses JSON frames', () => {
    expect(parseFrame('{"a":1}')).toEqual({ ok: true, value: { a: 1 } })
  })

  it('reports non-JSON frames rather than throwing', () => {
    expect(parseFrame('ping').ok).toBe(false)
    expect(parseFrame('{broken').ok).toBe(false)
  })
})

describe('recordFrame', () => {
  it('counts repeats and caps samples', () => {
    const store = emptyStore()
    for (let i = 0; i < 10; i += 1) {
      recordFrame(store, { direction: 'in', data: `{"type":"tick","n":${i}}` }, 1000 + i)
    }
    const [shape] = shapesByFrequency(store)
    expect(shape?.count).toBe(10)
    expect(shape?.samples).toHaveLength(MAX_SAMPLES_PER_SHAPE)
    expect(store.totals.in).toBe(10)
  })

  it('keeps inbound and outbound frames of identical shape apart', () => {
    const store = emptyStore()
    recordFrame(store, { direction: 'in', data: '{"room":"pulse"}' }, 1)
    recordFrame(store, { direction: 'out', data: '{"room":"pulse"}' }, 2)
    expect(shapesByFrequency(store)).toHaveLength(2)
    expect(store.totals).toMatchObject({ in: 1, out: 1 })
  })

  it('redacts samples on the way in', () => {
    const store = emptyStore()
    recordFrame(store, { direction: 'in', data: '{"accessToken":"abc","mint":"m1"}' }, 1)
    const sample = shapesByFrequency(store)[0]?.samples[0] as Record<string, unknown>
    expect(sample.accessToken).toBe('[redacted]')
    expect(sample.mint).toBe('m1')
  })

  it('records non-JSON frames separately instead of discarding them', () => {
    const store = emptyStore()
    recordFrame(store, { direction: 'in', data: 'ping' }, 1)
    expect(store.totals.unparsed).toBe(1)
    expect(store.unparsedSamples).toEqual(['ping'])
    expect(shapesByFrequency(store)).toHaveLength(0)
  })

  it('caps the shape map and reports what it dropped', () => {
    const store = emptyStore()
    for (let i = 0; i < MAX_SHAPES + 5; i += 1) {
      recordFrame(store, { direction: 'in', data: `{"k${i}":1}` }, i)
    }
    expect(Object.keys(store.shapes)).toHaveLength(MAX_SHAPES)
    expect(store.droppedShapes).toBe(5)
  })
})

describe('noteSocket', () => {
  it('keeps one entry per distinct URL', () => {
    const store = emptyStore()
    noteSocket(store, 'wss://a.axiom.trade')
    noteSocket(store, 'wss://a.axiom.trade')
    noteSocket(store, 'wss://b.axiom.trade')
    expect(store.socketUrls).toEqual(['wss://a.axiom.trade', 'wss://b.axiom.trade'])
  })
})
