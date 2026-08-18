import { describe, expect, it } from 'vitest'
import { REDACTED, isDeniedKey, looksLikeCredential, redact, truncate } from '../src/lib/redact.ts'

describe('isDeniedKey', () => {
  it('denies credential-bearing field names', () => {
    for (const key of [
      'Authorization',
      'cookie',
      'password',
      'clientSecret',
      'accessToken',
      'refresh_token',
      'token',
      'apiKey',
      'privateKey',
      'signature',
    ]) {
      expect(isDeniedKey(key), key).toBe(true)
    }
  })

  it('allows wallet address fields — recon exists to find these', () => {
    for (const key of ['pubkey', 'publicKey', 'creator', 'dev', 'mint', 'tokenAddress', 'keys']) {
      expect(isDeniedKey(key), key).toBe(false)
    }
  })
})

describe('looksLikeCredential', () => {
  it('spots a JWT regardless of the field it arrives in', () => {
    expect(
      looksLikeCredential('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123'),
    ).toBe(true)
  })

  it('does not flag a base58 address that merely starts with letters', () => {
    expect(looksLikeCredential('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')).toBe(false)
  })
})

describe('redact', () => {
  it('scrubs denied keys but keeps the wallet fields intact', () => {
    const out = redact({
      type: 'new_pair',
      mint: 'So11111111111111111111111111111111111111112',
      creator: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      auth: { accessToken: 'abc', cookie: 'session=1' },
    }) as Record<string, unknown>

    expect(out.mint).toBe('So11111111111111111111111111111111111111112')
    expect(out.creator).toBe('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')
    expect(out.auth).toEqual({ accessToken: REDACTED, cookie: REDACTED })
  })

  it('scrubs a JWT sitting in an innocuously named field', () => {
    const out = redact({ meta: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig' }) as Record<
      string,
      unknown
    >
    expect(out.meta).toBe(REDACTED)
  })

  it('walks arrays', () => {
    const out = redact([{ password: 'hunter2' }, { symbol: 'BONK' }]) as Record<string, unknown>[]
    expect(out[0]?.password).toBe(REDACTED)
    expect(out[1]?.symbol).toBe('BONK')
  })

  it('truncates long strings rather than storing them whole', () => {
    const out = redact({ description: 'x'.repeat(400) }, { maxStringLength: 20 }) as Record<
      string,
      unknown
    >
    expect(String(out.description)).toContain('[+380]')
  })

  it('stops at the depth limit instead of recursing forever', () => {
    let nested: Record<string, unknown> = { end: 'value' }
    for (let i = 0; i < 30; i += 1) nested = { nested }
    expect(() => redact(nested, { maxDepth: 5 })).not.toThrow()
    expect(JSON.stringify(redact(nested, { maxDepth: 5 }))).toContain('depth-limit')
  })
})

describe('truncate', () => {
  it('leaves short strings alone', () => {
    expect(truncate('short', 10)).toBe('short')
  })
})
