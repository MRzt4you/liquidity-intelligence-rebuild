# Realtime build checklist

## Production data path

1. Browser connects to same-origin `/api/live/stream`.
2. Cloudflare Worker opens Solami Blur when `SOLAMI_API_KEY` is configured.
3. Solami Blur is filtered to token launches, PumpSwap swaps, liquidity and pool events.
4. Incoming decoded events are normalized by `apps/web/lib/solami-blur.ts`.
5. Existing UI event decoding remains as a compatibility bridge.
6. `/api/live/tokens` provides a recent verified snapshot and DexScreener enrichment.
7. The browser resynchronizes periodically so a reconnect does not leave stale rankings.

## Provider priority

- Primary: Solami Blur decoded market-data WebSocket.
- Fallback: configured standard Solana JSON-RPC WebSockets.
- Final fallback: public Solana WebSockets.
- Snapshot/history: configured Solana HTTP RPC.
- Market enrichment: DexScreener.

## Truthfulness rules

- No generated/demo token rows are allowed in the live UI.
- A token is not considered a fresh launch unless its on-chain create event is verified.
- Rotation is an observed wallet-flow relationship, not causal proof.
- Provider availability is reported separately from actual realtime stream state.
- API keys never use `NEXT_PUBLIC_` variables and are never sent to the browser.

## Cloudflare deployment

After changing Worker/server code, deploy the latest `main` build. Then verify `/api/live/health` and the browser stream. A successful Cloudflare deployment alone proves the bundle was uploaded; it does not prove that an upstream WebSocket is authenticated and receiving events.
