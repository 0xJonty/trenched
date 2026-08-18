/** Chains Axiom exposes. Values are placeholders until M1 recon confirms how
 *  Axiom identifies chains in its feed — see docs/axiom-feed.md. */
export const CHAINS = ['solana', 'bnb', 'robinhood', 'ethereum'] as const
export type Chain = (typeof CHAINS)[number]

/** The three things v1 alerts on. */
export const EVENT_KINDS = ['bonded', 'migrated', 'dev-deploy'] as const
export type EventKind = (typeof EVENT_KINDS)[number]

/** A normalised event, independent of whatever shape Axiom's payload takes.
 *  Only `lib/feed-schema.ts` is allowed to produce these. */
export interface TrenchedEvent {
  kind: EventKind
  chain: Chain | 'unknown'
  /** Contract / mint address. The dedupe key, combined with `kind`. */
  address: string
  name?: string
  symbol?: string
  /** Deployer wallet, when the feed carries one. */
  creator?: string
  /** Milliseconds since epoch, stamped on receipt (not from the payload). */
  receivedAt: number
}

/** Socials pulled from a token payload or, failing that, the DOM. */
export interface TokenSocials {
  address: string
  twitter?: string
  twitterCommunity?: string
  website?: string
}

export interface TrackedWallet {
  address: string
  label: string
  chain: Chain
  enabled: boolean
}
