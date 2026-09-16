# Bitquery Wallet Intelligence

This repository now contains a fail-closed wallet audit layer for Solana.

## Routes

- UI: `/wallet-audit`
- API: `/api/intelligence/wallet-audit?wallet=<SOLANA_ADDRESS>&days=30`

## What it measures

For observed DEX activity in the configured 30-day window:

- first buy timestamp
- token mint / symbol
- initial and total buy notional
- total sell notional
- realized PnL from observed buy/sell USD notionals
- buy/sell count
- first/last exit
- holding duration
- exit style: `SINGLE_EXIT`, `STAGGERED_EXIT`, `PARTIAL_EXIT`, `STILL_OPEN`, `UNKNOWN`
- token age at first buy when a Pump.fun creation event is available
- DEX and transaction signatures for auditability

Missing data is returned as `null` or `UNKNOWN`. The engine never invents a price, token age, PnL, trade, or wallet behavior.

## Bitquery V2

The implementation uses the Solana V2 GraphQL endpoint. The default repo configuration points at the Asia endpoint for lower latency from Indonesia:

`https://asia.streaming.bitquery.io/graphql`

A different regional endpoint can be supplied with `BITQUERY_GRAPHQL_URL`.

## Authentication

Set the server-side environment variable:

`BITQUERY_TOKEN=<oauth bearer token>`

Never expose this as `NEXT_PUBLIC_BITQUERY_TOKEN`.

The MCP connector and the application API are separate integration paths. Claude can use the Bitquery MCP through OAuth for ad-hoc investigation; the deployed application needs its own server-side Bitquery credential if it is going to query Bitquery directly.

## MCP investigation prompt

```text
Wallet: <WALLET_ADDRESS>

Analyze all completed token positions opened during the last 30 days.

Use only observed on-chain data.

For every position calculate:
- first buy timestamp
- token age at first buy
- first buy size
- total capital deployed
- number of buys
- number of sells
- last sell timestamp
- holding duration
- exit style: SINGLE_EXIT / STAGGERED_EXIT / PARTIAL_EXIT / STILL_OPEN
- realized PnL
- ROI when denominators are observed

Do not predict future performance.
Do not infer intent.
Do not estimate missing values.
Mark unavailable fields UNKNOWN.

Return a structured table first, then summarize:
- profitable-position characteristics
- losing-position characteristics
- median holding time
- median initial position size
- median token age at first entry
- exit patterns

Explicitly separate OBSERVED DATA, CALCULATED METRICS, and INTERPRETATION.
```

## Wallet comparison prompt

```text
Now repeat the exact same analysis for:

<MY_WALLET_ADDRESS>

Compare the two wallets using observed metrics only.

For each measurable behavioral difference return:
- behavior
- Wallet A metric
- Wallet B metric
- difference
- realized-dollar impact when calculable
- affected positions
- evidence

Rank only by measurable realized-dollar impact.
Do not make predictions or infer psychology.
```

## Architecture

```text
PumpPortal WS
      +
Solana WS / RPC
      +
DexScreener
      +
Bitquery V2
      |
      v
EVENT NORMALIZER
      |
      +----> REALTIME TOKEN INTELLIGENCE
      |
      +----> WALLET POSITION RECONSTRUCTION
      |
      +----> HISTORICAL WALLET AUDIT
      |
      v
LIQUIDITY INTELLIGENCE TERMINAL
```

Bitquery is an enrichment / historical intelligence layer. It does not replace the existing realtime event pipeline.
