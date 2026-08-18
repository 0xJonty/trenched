/**
 * The recon store: what M1 exists to produce.
 *
 * Frames are grouped by shape signature, counted, and sampled. The result is
 * exported as JSON and turned into docs/axiom-feed.md by hand — that document,
 * not this store, is the deliverable. Everything downstream reads the schema
 * from `feed-schema.ts`, which is written against these captures.
 */
import type { FrameDirection } from './protocol.ts'
import { parseFrame, shapeOf } from './shape.ts'
import { redact } from './redact.ts'

export const MAX_SAMPLES_PER_SHAPE = 3
export const MAX_SHAPES = 120

export interface ShapeRecord {
  signature: string
  direction: FrameDirection
  keys: string[]
  count: number
  firstSeen: number
  lastSeen: number
  /** Redacted, truncated examples. Never raw frames. */
  samples: unknown[]
}

export interface ReconStore {
  recording: boolean
  socketUrls: string[]
  totals: { in: number; out: number; unparsed: number }
  /** Keyed by `${direction}:${signature}`. */
  shapes: Record<string, ShapeRecord>
  /** Examples of frames that were not JSON — heartbeats, binary, etc. */
  unparsedSamples: string[]
  droppedShapes: number
}

export function emptyStore(): ReconStore {
  return {
    recording: false,
    socketUrls: [],
    totals: { in: 0, out: 0, unparsed: 0 },
    shapes: {},
    unparsedSamples: [],
    droppedShapes: 0,
  }
}

/**
 * Folds one frame into the store. Mutates and returns `store` — this runs once
 * per frame in the service worker, so it avoids copying the whole store.
 */
export function recordFrame(
  store: ReconStore,
  frame: { direction: FrameDirection; data: string },
  now: number,
): ReconStore {
  store.totals[frame.direction] += 1

  const parsed = parseFrame(frame.data)
  if (!parsed.ok) {
    store.totals.unparsed += 1
    if (store.unparsedSamples.length < MAX_SAMPLES_PER_SHAPE) {
      store.unparsedSamples.push(frame.data.slice(0, 256))
    }
    return store
  }

  const shape = shapeOf(parsed.value)
  const key = `${frame.direction}:${shape.signature}`
  const existing = store.shapes[key]

  if (existing) {
    existing.count += 1
    existing.lastSeen = now
    if (existing.samples.length < MAX_SAMPLES_PER_SHAPE) {
      existing.samples.push(redact(parsed.value))
    }
    return store
  }

  // A cap matters here: an unbounded shape map is a memory leak driven by a
  // third party's payloads. Dropping is recorded so it is never silent.
  if (Object.keys(store.shapes).length >= MAX_SHAPES) {
    store.droppedShapes += 1
    return store
  }

  store.shapes[key] = {
    signature: shape.signature,
    direction: frame.direction,
    keys: shape.keys,
    count: 1,
    firstSeen: now,
    lastSeen: now,
    samples: [redact(parsed.value)],
  }
  return store
}

export function noteSocket(store: ReconStore, url: string): ReconStore {
  if (!store.socketUrls.includes(url)) store.socketUrls.push(url)
  return store
}

/** Shapes ordered by how often they were seen — the useful reading order. */
export function shapesByFrequency(store: ReconStore): ShapeRecord[] {
  return Object.values(store.shapes).sort((a, b) => b.count - a.count)
}
