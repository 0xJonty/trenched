# Axiom feed schema

**Status: not yet captured.** This document is the deliverable of M1 and the gate for M2.
Until every question below is answered from a real recording, `src/lib/feed-schema.ts` must
not be written — no field name in this codebase may come from guesswork.

Axiom publishes no developer documentation. [docs.axiom.trade](https://docs.axiom.trade/llms.txt)
is entirely user-facing, and axiom.trade itself is behind Cloudflare and cannot be inspected
by tooling. Everything here has to be observed in a real browser session.

## How to capture

1. `npm run build`
2. Load `dist/` unpacked at `chrome://extensions` (Developer mode on).
3. Open the extension's options page and press **Start recording**.
4. Open <https://axiom.trade> and sit on **Pulse**. Leave it running long enough to see coins
   move through New Pairs → Final Stretch → Migrated.
5. Switch chains — Solana, BNB, Robinhood Chain, Ethereum — so chain identifiers get captured.
6. Open a token page too, so token-detail frames and any socials payload are recorded.
7. **Stop recording**, then **Export JSON**. Samples are redacted and truncated on the way
   into storage, but read the export before pasting any of it anywhere public.

Frames are grouped by structural signature and counted, so a long session produces a bounded
export rather than a firehose dump.

## Questions this document must answer

### Transport

- [ ] Socket URL(s), including how the cluster host is chosen (`cluster3/5/7` appear in
      community SDKs — confirm what this browser session actually uses).
- [ ] Does the app open one socket per page load, or tear down and rebuild on navigation?
      This decides whether the tap re-subscribes per socket or once. See concern 3 in the plan.
- [ ] Are frames JSON, or is some other encoding in use? Check the "Non-JSON frames" panel.
- [ ] Is there a heartbeat, and does the server expect a reply?

### Subscription

- [ ] Exact shape of the outbound subscribe frame (captured under direction `out`).
- [ ] Room / channel names for New Pairs, Final Stretch (bonding), and Migrated.
- [ ] Is a room per chain, or is chain a field inside a shared room?
- [ ] Does the server acknowledge a subscription, and what does a rejection look like?

### Events

- [ ] Discriminator field that separates a new pair from a bond from a migration.
- [ ] **Does a new-pair payload carry the creator / deployer wallet?** This is the single most
      important question in M1. If it does not, M3 needs a same-origin token-detail lookup to
      resolve it — still Axiom-only, but an extra request per new pair.
- [ ] Contract/mint address field name — the dedupe key.
- [ ] Chain identifier field and its exact values for all four chains.
- [ ] Name and symbol field names.
- [ ] Anything usable as an event timestamp, and whether it is trustworthy.

### Token page

- [ ] URL pattern for an individual token page, per chain.
- [ ] Where socials live: in a socket/API payload, or only in the DOM?
- [ ] Field names for X account, X community, and website.
- [ ] A stable anchor in the DOM to inject the research button next to.

## Findings

_Fill in as they are captured. Record the actual observed values, not paraphrases._

### Transport

### Subscription

### Events

### Token page

## Notes on volatility

Anything recorded here is an observation of a third-party system on one day, not a contract.
When it changes, re-run the capture and update `feed-schema.ts` / `selectors.ts` — those two
modules exist precisely so that nothing else has to change.
