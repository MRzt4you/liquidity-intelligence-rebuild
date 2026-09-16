import { loadWalletTrades, reconstructPositions, summarizePositions } from '../../../../lib/bitquery-wallet-audit';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const walletRe = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function median(values: number[]) {
  const v = values.filter(Number.isFinite).sort((a,b)=>a-b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
}

function metrics(positions: ReturnType<typeof reconstructPositions>) {
  const closed = positions.filter(p => p.realizedPnlUsd != null);
  return {
    positions: positions.length,
    closed: closed.length,
    open: positions.filter(p => p.stillOpen).length,
    realizedPnlUsd: closed.reduce((s,p)=>s+(p.realizedPnlUsd||0),0),
    dollarsLost: closed.filter(p=>(p.realizedPnlUsd||0)<0).reduce((s,p)=>s+Math.abs(p.realizedPnlUsd||0),0),
    medianHoldMs: median(closed.map(p=>p.holdMs||NaN)),
    medianInitialSizeUsd: median(closed.map(p=>p.totalBuyUsd)),
    medianTokenAgeAtEntryMs: median(closed.map(p=>p.tokenAgeAtFirstBuyMs||NaN)),
    avgBuysPerPosition: positions.length ? positions.reduce((s,p)=>s+p.buyCount,0)/positions.length : null,
    avgSellsPerPosition: positions.length ? positions.reduce((s,p)=>s+p.sellCount,0)/positions.length : null,
    singleExitRate: positions.length ? positions.filter(p=>p.exitStyle==='SINGLE_EXIT').length/positions.length : null,
    staggeredExitRate: positions.length ? positions.filter(p=>p.exitStyle==='STAGGERED_EXIT').length/positions.length : null,
  };
}

export async function GET(request: Request) {
  const u = new URL(request.url);
  const a = u.searchParams.get('walletA')?.trim() || '';
  const b = u.searchParams.get('walletB')?.trim() || '';
  const days = Math.min(30, Math.max(1, Number(u.searchParams.get('days') || 30)));
  if (!walletRe.test(a) || !walletRe.test(b)) return json({ ok:false, error:'walletA and walletB must be valid Solana addresses' },400);
  if (a === b) return json({ ok:false, error:'walletA and walletB must be different' },400);
  try {
    const [ta,tb] = await Promise.all([loadWalletTrades(a,days),loadWalletTrades(b,days)]);
    const pa = reconstructPositions(ta), pb = reconstructPositions(tb);
    const ma = metrics(pa), mb = metrics(pb);
    const differences = [
      ['realizedPnlUsd', ma.realizedPnlUsd, mb.realizedPnlUsd, null],
      ['dollarsLost', ma.dollarsLost, mb.dollarsLost, null],
      ['medianInitialSizeUsd', ma.medianInitialSizeUsd, mb.medianInitialSizeUsd, null],
      ['medianHoldMs', ma.medianHoldMs, mb.medianHoldMs, null],
      ['medianTokenAgeAtEntryMs', ma.medianTokenAgeAtEntryMs, mb.medianTokenAgeAtEntryMs, null],
      ['avgBuysPerPosition', ma.avgBuysPerPosition, mb.avgBuysPerPosition, null],
      ['avgSellsPerPosition', ma.avgSellsPerPosition, mb.avgSellsPerPosition, null],
      ['singleExitRate', ma.singleExitRate, mb.singleExitRate, null],
      ['staggeredExitRate', ma.staggeredExitRate, mb.staggeredExitRate, null],
    ].map(([behavior,aMetric,bMetric])=>({ behavior, walletA:aMetric, walletB:bMetric, difference: typeof aMetric==='number'&&typeof bMetric==='number' ? aMetric-bMetric : null }));
    return json({ ok:true, source:'bitquery-solana-v2', days, generatedAt:new Date().toISOString(), walletA:{address:a,summary:summarizePositions(pa),metrics:ma}, walletB:{address:b,summary:summarizePositions(pb),metrics:mb}, differences, methodology:'Observed on-chain trades only; no psychology, intent, prediction, or estimated missing values.' });
  } catch (e) {
    const message=e instanceof Error?e.message:String(e);
    return json({ok:false,status:message==='BITQUERY_NOT_CONFIGURED'?'NOT_CONFIGURED':'DEGRADED',error:message,source:'bitquery-solana-v2'},message==='BITQUERY_NOT_CONFIGURED'?503:502);
  }
}
