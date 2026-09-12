# Liquidity Intelligence DApp — Solana + BNB

Rebuild target based on the supplied Liquidity Matrix / Smart Money Scanner reference. The UI keeps the original information architecture while separating the on-chain indexer, signal engine and frontend.

## Included
- Responsive Liquidity Matrix dashboard for Solana / BNB
- Confluence feed, Smart Money wallet ranking and risk-gated pool scanner
- WebSocket event stream from the Fastify API
- Solana and BNB adapter scaffolding
- PostgreSQL/Redis Docker services
- `.env.example` and deployment-ready structure

## Run
```bash
cd apps/api && npm install && npm run dev
cd apps/web && npm install && npm run dev
```

For production, set `NEXT_PUBLIC_API_URL` to the deployed API URL and configure the chain RPC/WebSocket credentials in `.env`.

## Security
Do not commit secrets. Use `.env` locally and keep `.env.example` as the template.
