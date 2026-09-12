# Multi-source intelligence

The terminal treats Solana/Pump.fun on-chain events as the primary source of truth. DexScreener is market enrichment; Jupiter is an independent price cross-check; Birdeye is an optional paid real-time market/wallet feed; GoPlus is an optional security cross-check; Helius/LaserStream and Yellowstone are optional streaming transports. Missing credentials never produce fabricated values.

## Source roles
- Solana RPC: authoritative transaction/log retrieval and replay fallback.
- Pump.fun: bonding-curve lifecycle and trade events.
- DexScreener: DEX pair, liquidity, volume, price change, FDV/market cap, transaction counts.
- Jupiter: independent price reference and price-dislocation detection.
- Birdeye: optional real-time new-pair, transactions, wallet and meme feeds.
- GoPlus: optional Solana token-security risk layer.
- RugCheck: optional independent mint/authority/holder/liquidity risk layer.
- Helius LaserStream / Yellowstone: optional low-latency streaming transports; credentials/infrastructure are required.

## Signal policy
A provider is never treated as a buy signal by itself. Boosts/ads are metadata. Security findings reduce confidence. Price disagreement is surfaced as a warning. Missing data is `null`/`—`, never zero-filled.

## Production environment
Optional secrets belong only in server-side environment variables:
- `SOLANA_RPC_URL`
- `HELIUS_API_KEY`
- `BIRDEYE_API_KEY`
- `GOPLUS_API_KEY`
- `RUGCHECK_API_URL`
- `YELLOWSTONE_GRPC_URL`

The browser must never receive provider API keys.
