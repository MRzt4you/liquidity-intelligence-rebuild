# Realtime Multi-Source Data Matrix

## Objective

Build a real-time Solana/Pump.fun intelligence pipeline with no dummy/mock market values. Every displayed metric must have a source, timestamp, and provider status. The system is decision-support only; it must not execute trades automatically.

## Source hierarchy

### Tier A — primary realtime event sources

1. **PumpAPI Stream**
   - WebSocket: `wss://stream.pumpapi.io/`
   - Reported coverage: Solana transfers, Pump.fun, PumpSwap, Raydium Launchpad, Raydium CPMM, Meteora launchpads/DAMM.
   - Event classes include create, buy, sell, migration, pool creation, liquidity add/remove.
   - Advantage: normalized event stream, simple WebSocket client.
   - Caveat: provider terms, availability, schema and commercial limits must be verified before production dependence.

2. **Yellowstone gRPC + sol-parser-sdk / parser-proxy-ws**
   - Self-controlled low-level stream.
   - Supports PumpFun/PumpSwap plus Raydium, Orca and Meteora.
   - Best source for auditability and independent verification.
   - Requires long-lived infrastructure and a Yellowstone-compatible endpoint.

3. **Bitquery Pump.fun WebSocket/GraphQL subscriptions**
   - Managed indexed stream.
   - Supports Pump.fun/PumpSwap APIs and GraphQL subscriptions/webhooks.
   - Strong option for independent cross-checking and historical querying.
   - Requires Bitquery credentials/plan.

4. **Birdeye WebSocket**
   - Real-time token price, transactions, new listings, new pairs, large trades and wallet transactions.
   - `SUBSCRIBE_TOKEN_NEW_LISTING` supports meme-platform filtering and `pump_dot_fun` source filtering.
   - Good enrichment/failover source.
   - Requires API key and plan supporting WebSockets.

### Tier B — market enrichment

5. **DEX Screener**
   - Token/pair lookup, USD price, liquidity, volume, price changes, FDV/market cap, pair metadata and boosts.
   - Token endpoint supports up to 30 addresses per request.
   - Current documented limits: 300 rpm for pair/token endpoints; 60 rpm for profiles/boosts/orders.
   - Never treat boosts/ads as a trading signal.

6. **Jupiter Price API**
   - Cross-market price/liquidity reference.
   - Use only when current API credentials and endpoint requirements are configured.
   - Compare with DEX Screener and on-chain derived price; large disagreement becomes a warning, not a buy signal.

### Tier C — security/risk

7. **GoPlus Security API for Solana**
   - Token security and risk intelligence.
   - Use to identify authority, liquidity and token-security risks.
   - Security results lower confidence; they do not create a positive signal.

8. **RugCheck / equivalent risk provider**
   - Optional secondary risk source.
   - Do not fabricate results when unavailable.

### Tier D — social intelligence

9. **X API v2**
   - Search/read posts, users, trends and real-time filtered streams.
   - Useful for creator/social links, narrative velocity and mentions.
   - Social activity is confirmation/context only, never sufficient to approve a token.
   - Requires X developer credentials and pay-per-use access.

10. **GitHub/open-source research**
   - Use repositories such as OpenPump API, pump.fun Meter, 0xfnzero parser-proxy-ws and sol-parser-sdk as implementation references.
   - Open-source code is not automatically a production data provider. Validate license, uptime, schema stability and upstream dependencies.

## Recommended production architecture

```text
PumpAPI Stream ───────┐
Yellowstone/parser ───┼──> Event Normalizer ──> Durable Event Log
Bitquery stream ──────┤             │
Birdeye WS ───────────┘             ├──> Token State
                                     ├──> Wallet State
                                     ├──> Trade Flow
                                     ├──> Rotation Graph
                                     └──> Replay/Resync

Token State ──> DEX Screener
             ─> Jupiter
             ─> GoPlus
             ─> optional RugCheck
             ─> X/social enrichment

All sources ──> Confluence/Risk Engine ──> UI
```

## Event normalization contract

Every event entering the engine should contain at least:

- `provider`
- `providerEventId` or transaction signature
- `chain`
- `slot`
- `blockTime`
- `receivedAt`
- `txSignature`
- `eventType`
- `mint`
- `wallet` / `trader`
- `side` where applicable
- `solAmount` / quote amount
- token amount where available
- source confidence
- raw payload hash

Deduplicate by `(chain, txSignature, eventIndex/eventId)` rather than wallet/mint alone.

## Provider agreement model

Do not average contradictory provider values blindly.

Example:

- On-chain trade: authoritative for the actual transaction.
- PumpAPI/Bitquery: normalized event confirmation.
- DEX Screener/Jupiter: market-price enrichment.
- GoPlus/RugCheck: security context.
- X: social context.

A token can be shown while degraded, but every metric must expose `source`, `observedAt`, and `stale` state internally.

## Scoring policy

Hard gates:

- event is valid and successfully decoded
- transaction is confirmed/finalized according to configured policy
- mint is valid
- no severe security block
- data freshness below configured threshold

Score contributors:

- early buy flow
- unique buyer breadth
- buy/sell imbalance
- acceleration of volume
- bonding-curve progress
- wallet quality/rotation
- liquidity
- market-cap growth
- cross-provider price agreement
- social/narrative velocity

Never approve solely because a token has a high social score, DEX boost, large single trade, or one provider's quality score.

## Required operational states

- `LIVE`: primary stream connected and event lag below threshold.
- `DEGRADED`: primary stream unavailable but a secondary stream is active.
- `STALE`: last event exceeds configured freshness threshold.
- `REPLAYING`: historical resync is running.
- `OFFLINE`: no trusted data source is active.

The UI must never label a polling `getSignaturesForAddress` loop as true `LIVE`.

## Current repo gap

`apps/web/app/api/live/tokens/route.ts` currently queries `getSignaturesForAddress` and `getTransaction`, then enriches with DEX Screener. This is a polling/recent-history path, not a persistent realtime stream. Its provider status fields also indicate environment-variable presence for several providers without actually invoking those providers.

The next implementation step is to move ingestion into a long-lived worker/service and keep the Cloudflare web layer as the read/API/UI edge.

## Security rules

- API keys stay server-side.
- Never expose provider credentials to browser JavaScript.
- Never use a provider's promotional/boost field as proof of token quality.
- Never fill missing provider data with mock values.
- Preserve raw event hashes/signatures for replay/audit.
- Keep social and security data clearly separated from on-chain facts.

## Source references

- DEX Screener API reference: https://docs.dexscreener.com/api/reference
- Birdeye WebSocket: https://docs.birdeye.so/docs/websocket
- Birdeye new token listing: https://docs.birdeye.so/reference/new-token-listing
- GoPlus Token Security: https://docs.gopluslabs.io/reference/tokensecurityusingget_1
- Bitquery Pump.fun API: https://docs.bitquery.io/docs/blockchain/Solana/Pumpfun/
- PumpAPI stream reference implementation/docs: https://github.com/gyurasitszoltan/pump.footprint/blob/main/pumpapi.io_stream_docs.md
- Pump.fun Meter: https://github.com/Solana-Trading-Lab/pump.fun.meter
- 0xfnzero parser-proxy-ws: https://github.com/0xfnzero/parser-proxy-ws
- 0xfnzero sol-parser-sdk: https://github.com/0xfnzero/sol-parser-sdk
- OpenPump API: https://github.com/open-pump/openpump-api
- X API: https://docs.x.com/x-api/overview
