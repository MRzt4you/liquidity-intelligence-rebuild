# Stampede Fusion

Liquidity Intelligence now adapts the useful Stampede concepts to Solana/Pump.fun rather than importing its chain-specific ingestion unchanged.

## Production data contract

`Pump.fun/Solana logs -> getTransaction -> token activity -> wallet actions -> rotation engine -> live terminal`

There is no demo/mock fallback in the production scanner. If the API has no chain data, the UI shows an empty/waiting state.

## Rotation model

The engine records observed wallet actions and detects a destination token when the same wallet sells another observed token and buys the destination within five minutes. The radar reports the number of distinct rotating wallets and the strongest observed origin tokens.

This is an observation/ranking signal, not proof that a particular sale funded a particular purchase.

## Live API

- `GET /api/live/tokens` returns the current in-memory live token state.
- `GET /api/live/events` returns recent live events.
- WebSocket broadcasts chain status, Pump.fun events, decoded token activity, and token snapshots.

## UI

- Early Launch Radar
- Wallet Rotation Flow graph
- Rotation leaderboard
- Live Pump.fun event stream
- Token detail drawer with CA copy
- Pump.fun and DexScreener CA-specific links
- Explicit LIVE ONLY / NO MOCK indicators

## Important deployment requirement

The web app must receive `NEXT_PUBLIC_API_URL` pointing at the deployed Fastify API. Deploying `apps/web` to Cloudflare alone does not deploy the Node/Fastify API process. Keep Solana RPC/WebSocket credentials on the API side, never in the browser.
