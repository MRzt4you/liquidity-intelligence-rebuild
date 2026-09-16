import { loadPumpCreationTime, loadWalletTrades, reconstructPositions, summarizePositions } from '../../../../../../lib/bitquery-wallet-audit';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get('wallet')?.trim();
  const days = Math.min(30, Math.max(1, Number(url.searchParams.get('days') || 30)));

  if (!wallet) return json({ ok: false, error: 'wallet is required' }, 400);
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) return json({ ok: false, error: 'invalid Solana wallet address' }, 400);

  try {
    const trades = await loadWalletTrades(wallet, days);
    const uniqueMints = [...new Set(trades.map((x) => x.mint))].slice(0, 100);
    const creationPairs = await Promise.all(uniqueMints.map(async (mint) => {
      try { return [mint, await loadPumpCreationTime(mint)] as const; } catch { return [mint, null] as const; }
    }));
    const creationTimes = new Map(creationPairs.filter((x): x is readonly [string, string] => !!x[1]));
    const positions = reconstructPositions(trades, creationTimes);

    return json({
      ok: true,
      source: 'bitquery-solana-v2',
      wallet,
      days,
      generatedAt: new Date().toISOString(),
      methodology: {
        observed: ['trade timestamp', 'token mint', 'buy/sell side', 'token amount', 'USD notional', 'DEX', 'transaction signature'],
        calculated: ['position grouping by mint', 'realized PnL from observed buy/sell USD notionals', 'holding duration', 'exit style', 'token age when creation event is available'],
        failClosed: true,
        missingValues: 'null/UNKNOWN; never estimated',
      },
      summary: summarizePositions(positions),
      positions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'BITQUERY_NOT_CONFIGURED') {
      return json({ ok: false, status: 'NOT_CONFIGURED', error: message, source: 'bitquery-solana-v2' }, 503);
    }
    return json({ ok: false, status: 'DEGRADED', error: message, source: 'bitquery-solana-v2' }, 502);
  }
}
