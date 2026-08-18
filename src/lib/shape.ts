/**
 * Shape fingerprinting for recon.
 *
 * A busy Pulse feed emits far too many frames to store, and almost all of them
 * are repeats of a handful of structures. Recon therefore groups frames by a
 * signature derived from their structure, counts each group, and keeps only a
 * few samples per group. That yields full schema coverage from a bounded amount
 * of storage — and the counts double as a hint about which rooms are hot.
 */

export interface ShapeSummary {
  signature: string
  /** Top-level keys, or a description for non-object payloads. */
  keys: string[]
}

/**
 * Builds a signature from the payload's structure, not its values.
 *
 * Discriminator-looking fields are an exception: short string values on keys
 * such as `type`, `event` or `room` are folded into the signature, because two
 * frames with identical key sets but different `type` values are two different
 * messages and must not be collapsed into one group.
 */
const DISCRIMINATOR_KEYS = ['type', 'event', 'action', 'room', 'channel', 'topic', 'method', 'op']
const MAX_DISCRIMINATOR_LENGTH = 48

export function shapeOf(payload: unknown): ShapeSummary {
  if (payload === null) return { signature: 'null', keys: [] }
  if (Array.isArray(payload)) {
    const inner = payload.length > 0 ? shapeOf(payload[0]).signature : 'empty'
    return { signature: `array<${inner}>`, keys: [] }
  }
  if (typeof payload !== 'object') {
    return { signature: typeof payload, keys: [] }
  }

  const record = payload as Record<string, unknown>
  const keys = Object.keys(record).sort()

  const discriminators: string[] = []
  for (const key of DISCRIMINATOR_KEYS) {
    const value = record[key]
    if (typeof value === 'string' && value.length <= MAX_DISCRIMINATOR_LENGTH) {
      discriminators.push(`${key}=${value}`)
    }
  }

  const base = `{${keys.join(',')}}`
  return {
    signature: discriminators.length > 0 ? `${base}|${discriminators.join('|')}` : base,
    keys,
  }
}

/**
 * Parses a raw frame. Non-JSON frames are not an error — Axiom may use
 * heartbeats or a binary protocol, and knowing that is itself a recon finding.
 */
export function parseFrame(data: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = data.trimStart()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return { ok: false }
  try {
    return { ok: true, value: JSON.parse(data) }
  } catch {
    return { ok: false }
  }
}
