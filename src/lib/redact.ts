/**
 * Credential scrubbing for recorded frames.
 *
 * Axiom's socket carries whatever Axiom decides to put on it, which may include
 * session material. Recon samples are written to disk and pasted into docs, so
 * nothing sensitive may survive this function. See invariant 3 in CLAUDE.md.
 *
 * Deliberately conservative in one direction and not the other: it is fine to
 * redact something harmless, and never fine to leak a token. But note that
 * "key" alone is NOT a denied substring — `pubkey`, `publicKey` and friends are
 * wallet addresses, which are exactly the fields recon needs to find.
 */

const DENIED_KEY_PATTERNS = [
  /^authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /password/i,
  /secret/i,
  /(^|[^a-z])jwt([^a-z]|$)/i,
  /bearer/i,
  /(access|refresh|session|id|auth|api|csrf|xsrf)[-_]?token/i,
  /token[-_]?(id|value)/i,
  /^token$/i,
  /api[-_]?key/i,
  /private[-_]?key/i,
  /^signature$/i,
  /credential/i,
]

/** A JWT is recognisable regardless of the field it arrives in. */
const JWT_PATTERN = /^ey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./

export const REDACTED = '[redacted]'

export function isDeniedKey(key: string): boolean {
  return DENIED_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

export function looksLikeCredential(value: string): boolean {
  return JWT_PATTERN.test(value)
}

export interface RedactOptions {
  /** Strings longer than this are truncated. Keeps samples readable and small. */
  maxStringLength?: number
  /** Guard against pathological nesting in an unknown third-party payload. */
  maxDepth?: number
}

/**
 * Deep-copies a parsed payload, replacing credential-ish values and truncating
 * long strings. Returns plain JSON-safe data.
 */
export function redact(value: unknown, options: RedactOptions = {}): unknown {
  const maxStringLength = options.maxStringLength ?? 256
  const maxDepth = options.maxDepth ?? 12
  return walk(value, maxStringLength, maxDepth, 0)
}

function walk(value: unknown, maxStringLength: number, maxDepth: number, depth: number): unknown {
  if (depth > maxDepth) return '[depth-limit]'

  if (typeof value === 'string') {
    if (looksLikeCredential(value)) return REDACTED
    return truncate(value, maxStringLength)
  }

  if (value === null || typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map((item) => walk(item, maxStringLength, maxDepth, depth + 1))
  }

  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    out[key] = isDeniedKey(key) ? REDACTED : walk(item, maxStringLength, maxDepth, depth + 1)
  }
  return out
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}…[+${value.length - max}]`
}
