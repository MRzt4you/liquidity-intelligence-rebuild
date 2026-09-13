# Realtime ingestion architecture

## Goal

The web application must not claim LIVE when it is only polling recent RPC history. The current token route is a request-time `getSignaturesForAddress` + `getTransaction` reader. This document defines the production ingestion target without inventing provider credentials.

## Source hierarchy

1. Solana/Pump.fun on-chain events — authoritative event source.
2. Persistent Solana stream — preferred transport: Helius transactionSubscribe or Yellowstone/Geyser through a long-lived worker/service.
3. PumpAPI/Birdeye/Bitquery — optional secondary realtime feeds and cross-checks.
4. DexScreener/Jupiter — market-price/liquidity enrichment, never the primary Pump.fun event source.
5. GoPlus/RugCheck — security enrichment, never a buy signal.
6. X/social sources — narrative metadata only.

## Event contract

Every normalized event should contain:

- provider
- chain
- program
- eventType: NEW | BUY | SELL | GRADUATION | LIQUIDITY_ADD | LIQUIDITY_REMOVE | UNKNOWN
- signature
- slot
- blockTime
- receivedAt
- mint when known
- wallet when known
- SOL amount when known
- raw/source metadata

The signature is the primary deduplication key. `(signature,eventType,mint,wallet)` can be used as a defensive secondary key.

## Persistent stream requirements

A production consumer must:

- maintain one persistent WebSocket/gRPC connection;
- reconnect with exponential backoff;
- record the last processed slot/signature;
- deduplicate events;
- survive provider disconnects without clearing state;
- resync a bounded historical range after reconnect;
- expose ingestion lag and last error;
- never turn missing provider data into zeroes;
- distinguish LIVE, DEGRADED, STALE and OFFLINE.

## Cloudflare boundary

The Next/Vinext Cloudflare Worker is request-oriented. It should serve the UI/read API, not pretend that a request-scoped fetch is a durable market-data stream. A persistent consumer should live in a long-lived runtime or a Cloudflare Durable Object where the provider WebSocket and state lifecycle are supported. The Worker can read normalized state from durable storage.

## Multi-source confidence

Providers are corroborating observations, not interchangeable truth. Example:

- Pump.fun on-chain: BUY 2.4 SOL
- secondary stream: BUY 2.4 SOL
- market provider: price/liquidity

This becomes 2 independent event observations plus market enrichment. It must not be presented as three independent on-chain trades.

## No credentials, no fabrication

Provider adapters may exist without credentials, but an unavailable adapter must report `available:false`. Environment variables are server-side only. The frontend must never receive provider secrets.

## Migration plan

### Stage A — current RPC reader

Keep it as a recovery/replay endpoint. It is not the realtime source.

### Stage B — persistent primary stream

Implement Helius `transactionSubscribe` or Yellowstone/Geyser adapter. Normalize Pump.fun Create/Trade/Complete events into the common event contract.

### Stage C — durable state

Store cursor, normalized events, token aggregates, provider health and last-seen timestamps. Add replay/resync after reconnect.

### Stage D — enrichment

Batch DexScreener, use Jupiter only with a valid current API credential, and optionally attach Birdeye/GoPlus/RugCheck data when configured.

### Stage E — UI truthfulness

Display the actual ingestion source, source count, last event age, lag, and health state. Never display LIVE solely because the HTTP route responded successfully.
