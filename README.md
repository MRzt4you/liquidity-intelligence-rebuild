# Liquidity Intelligence DApp — Solana + BNB

A real-time on-chain intelligence terminal focused on early Solana launches, Pump.fun/PumpSwap flow, liquidity, wallet rotation and market enrichment. The live UI is **real-data only**: no seeded/demo token rows are used by the production live endpoints.

## Live architecture

- **Primary realtime:** Solami Blur decoded WebSocket when `SOLAMI_API_KEY` is configured.
- **Fallback realtime:** standard Solana JSON-RPC WebSocket subscriptions for Pump.fun and PumpSwap.
- **Snapshot/history:** Solana HTTP RPC with verified Pump.fun event decoding.
- **Market enrichment:** DexScreener token/pair data.
- **UI:** Bloomberg-terminal × cyberpunk style with early-launch radar, flow/rotation, event feed and liquidity board.
- **Safety:** no automatic trade execution. The scanner ranks and explains observed market flow only.

Solami Blur is used for decoded `token_create`, `swap`, `liquidity` and `pool_create` events; the adapter normalizes provider envelopes and keeps API credentials server-side.

## Production environment

Required for the preferred realtime path:

```text
SOLAMI_API_KEY=<raw API key only>
SOLAMI_DATA_WS_URL=wss://ws.solami.dev/data/subscribe?chain=solana
SOLANA_RPC_URL=<dedicated Solana HTTPS RPC>
```

Optional fallback:

```text
SOLANA_WS_URLS=<standard Solana JSON-RPC WSS>,<second WSS>
```

Never use `NEXT_PUBLIC_` for credentials. On Cloudflare, store credential-bearing values as Secrets.

## Local development

```bash
cd apps/api && npm install && npm run dev
cd apps/web && npm install && npm run dev
```

For the Cloudflare frontend:

```bash
cd apps/web
npm install
npm run build
npm run deploy
```

## Cloudflare Workers build

Set the Worker project root to `apps/web`.

- Build command: `npm install && npm run build`
- Deploy command: `npm run deploy`
- Production branch: `main`

After deployment, verify `/api/live/health` and the browser WebSocket state. A successful upload only proves the Worker bundle was deployed; realtime readiness still depends on valid provider configuration and an authenticated upstream stream.

## Data truth rules

- No mock/seeded live rows.
- A launch is treated as fresh only after verified on-chain creation evidence.
- Wallet rotation is an observed relationship, not causal proof.
- Provider configuration is not reported as live until the realtime path is actually connected.
- Reconnects use bounded backoff and preserve browser-side deduplication.

See `docs/REALTIME_BUILD_CHECKLIST.md` for the production verification checklist.

## Backend

The Fastify API remains in `apps/api` for chain adapters and signal services. The Cloudflare frontend uses same-origin `/api/live` routes by default.

## Security

Do not commit secrets. Use `.env` locally and keep `.env.example` as the template. Rotate any credential that has been exposed outside the secret store.
