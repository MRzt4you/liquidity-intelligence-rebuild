# Liquidity Intelligence DApp — Solana + BNB

Rebuild target based on the supplied Liquidity Matrix / Smart Money Scanner reference. The UI keeps the original information architecture while separating the on-chain indexer, signal engine and frontend.

## Included
- Responsive Liquidity Matrix dashboard for Solana / BNB
- Confluence feed, Smart Money wallet ranking and risk-gated pool scanner
- WebSocket event stream from the Fastify API
- Solana and BNB adapter scaffolding
- PostgreSQL/Redis Docker services
- `.env.example` and deployment-ready structure
- Cloudflare Workers + vinext configuration for the Next.js frontend

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

## Cloudflare Workers Builds
Set the Worker project root directory to `apps/web` if Cloudflare asks for a root directory.

Recommended settings:
- Build command: `npm install && npm run build`
- Deploy command: `npm run deploy`
- Production branch: `main`

The frontend is configured for vinext + Cloudflare Workers. Cloudflare account authentication, Worker environment variables, and any custom domain must be configured in the Cloudflare dashboard.

## Backend
The Fastify API remains in `apps/api`. Set `NEXT_PUBLIC_API_URL` in the frontend environment to the deployed API URL. The existing API uses Solana/BNB WebSocket adapters and PostgreSQL/Redis configuration.

## Security
Do not commit secrets. Use `.env` locally and keep `.env.example` as the template.
