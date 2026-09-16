export const BITQUERY_ENDPOINT = process.env.BITQUERY_GRAPHQL_URL || 'https://streaming.bitquery.io/graphql';

export type WalletTrade = {
  time: string;
  signature: string;
  mint: string;
  symbol: string;
  side: 'buy' | 'sell' | 'unknown';
  tokenAmount: number | null;
  quoteAmountUsd: number | null;
  priceUsd: number | null;
  dex: string | null;
  market: string | null;
};

export type WalletPosition = {
  mint: string;
  symbol: string;
  firstBuyAt: string | null;
  tokenAgeAtFirstBuyMs: number | null;
  totalBuyUsd: number;
  totalSellUsd: number;
  realizedPnlUsd: number | null;
  buyCount: number;
  sellCount: number;
  firstSellAt: string | null;
  lastSellAt: string | null;
  holdMs: number | null;
  exitStyle: 'SINGLE_EXIT' | 'STAGGERED_EXIT' | 'PARTIAL_EXIT' | 'STILL_OPEN' | 'UNKNOWN';
  stillOpen: boolean;
  trades: WalletTrade[];
};

const WALLET_TRADES_QUERY = `
query WalletTrades($wallet: String!, $since: DateTime!) {
  Solana(dataset: realtime) {
    DEXTradeByTokens(
      where: {
        Transaction: {
          Signer: { is: $wallet }
          Result: { Success: true }
        }
        Block: { Time: { since: $since } }
      }
      orderBy: { descending: Block_Time }
      limit: { count: 5000 }
    ) {
      Block { Time }
      Transaction { Signature Signer }
      Trade {
        Account { Owner }
        Currency { MintAddress Symbol Name }
        Side {
          Type
          Amount
          AmountInUSD
          Currency { MintAddress Symbol Name }
        }
        Amount
        AmountInUSD
        PriceInUSD
        Dex { ProtocolName }
        Market { MarketAddress }
      }
    }
  }
}
`;

const CREATION_QUERY = `
query PumpCreation($mint: String!) {
  Solana {
    TokenSupplyUpdates(
      where: {
        Instruction: {
          Program: {
            Address: { is: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P" }
            Method: { in: ["create", "create_v2"] }
          }
        }
        TokenSupplyUpdate: { Currency: { MintAddress: { is: $mint } } }
        Transaction: { Result: { Success: true } }
      }
      limit: { count: 1 }
      orderBy: { ascending: Block_Time }
    ) {
      Block { Time }
      TokenSupplyUpdate { Currency { MintAddress Symbol Name } }
      Transaction { Signature Signer }
    }
  }
}
`;

type BitqueryResponse<T> = { data?: T; errors?: Array<{ message?: string }> };

async function bitquery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const token = process.env.BITQUERY_TOKEN;
  if (!token) throw new Error('BITQUERY_NOT_CONFIGURED');

  const response = await fetch(BITQUERY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  const payload = (await response.json()) as BitqueryResponse<T>;
  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.map((x) => x.message).filter(Boolean).join('; ') || `BITQUERY_HTTP_${response.status}`);
  }
  if (!payload.data) throw new Error('BITQUERY_EMPTY_DATA');
  return payload.data;
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function loadWalletTrades(wallet: string, days = 30): Promise<WalletTrade[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const data = await bitquery<{ Solana?: { DEXTradeByTokens?: any[] } }>(WALLET_TRADES_QUERY, { wallet, since });
  return (data.Solana?.DEXTradeByTokens || []).map((row) => ({
    time: String(row.Block?.Time || ''),
    signature: String(row.Transaction?.Signature || ''),
    mint: String(row.Trade?.Currency?.MintAddress || ''),
    symbol: String(row.Trade?.Currency?.Symbol || row.Trade?.Currency?.Name || 'UNKNOWN'),
    side: row.Trade?.Side?.Type === 'buy' || row.Trade?.Side?.Type === 'sell' ? row.Trade.Side.Type : 'unknown',
    tokenAmount: numberOrNull(row.Trade?.Amount ?? row.Trade?.Side?.Amount),
    quoteAmountUsd: numberOrNull(row.Trade?.AmountInUSD ?? row.Trade?.Side?.AmountInUSD),
    priceUsd: numberOrNull(row.Trade?.PriceInUSD),
    dex: row.Trade?.Dex?.ProtocolName ? String(row.Trade.Dex.ProtocolName) : null,
    market: row.Trade?.Market?.MarketAddress ? String(row.Trade.Market.MarketAddress) : null,
  })).filter((x) => x.mint && x.time && x.signature);
}

export async function loadPumpCreationTime(mint: string): Promise<string | null> {
  const data = await bitquery<{ Solana?: { TokenSupplyUpdates?: any[] } }>(CREATION_QUERY, { mint });
  return data.Solana?.TokenSupplyUpdates?.[0]?.Block?.Time ? String(data.Solana.TokenSupplyUpdates[0].Block.Time) : null;
}

export function reconstructPositions(trades: WalletTrade[], creationTimes = new Map<string, string>()): WalletPosition[] {
  const groups = new Map<string, WalletTrade[]>();
  for (const trade of [...trades].sort((a, b) => Date.parse(a.time) - Date.parse(b.time))) {
    const bucket = groups.get(trade.mint) || [];
    bucket.push(trade);
    groups.set(trade.mint, bucket);
  }

  return [...groups.entries()].map(([mint, rows]) => {
    const buys = rows.filter((x) => x.side === 'buy');
    const sells = rows.filter((x) => x.side === 'sell');
    const firstBuy = buys[0] || null;
    const lastSell = sells.at(-1) || null;
    const firstSell = sells[0] || null;
    const totalBuyUsd = buys.reduce((s, x) => s + (x.quoteAmountUsd || 0), 0);
    const totalSellUsd = sells.reduce((s, x) => s + (x.quoteAmountUsd || 0), 0);
    const netToken = buys.reduce((s, x) => s + (x.tokenAmount || 0), 0) - sells.reduce((s, x) => s + (x.tokenAmount || 0), 0);
    const stillOpen = Math.abs(netToken) > Math.max(1e-12, buys.reduce((s, x) => s + Math.abs(x.tokenAmount || 0), 0) * 0.001);
    const sellTimes = new Set(sells.map((x) => x.time.slice(0, 19)));
    const exitStyle = stillOpen ? (sells.length ? 'PARTIAL_EXIT' : 'STILL_OPEN') : sells.length <= 1 ? 'SINGLE_EXIT' : sellTimes.size > 1 ? 'STAGGERED_EXIT' : 'PARTIAL_EXIT';
    const created = creationTimes.get(mint);
    const firstBuyMs = firstBuy ? Date.parse(firstBuy.time) : NaN;
    const createdMs = created ? Date.parse(created) : NaN;

    return {
      mint,
      symbol: firstBuy?.symbol || rows[0]?.symbol || 'UNKNOWN',
      firstBuyAt: firstBuy?.time || null,
      tokenAgeAtFirstBuyMs: Number.isFinite(firstBuyMs) && Number.isFinite(createdMs) && firstBuyMs >= createdMs ? firstBuyMs - createdMs : null,
      totalBuyUsd,
      totalSellUsd,
      realizedPnlUsd: sells.length ? totalSellUsd - totalBuyUsd : null,
      buyCount: buys.length,
      sellCount: sells.length,
      firstSellAt: firstSell?.time || null,
      lastSellAt: lastSell?.time || null,
      holdMs: firstBuy && lastSell ? Math.max(0, Date.parse(lastSell.time) - Date.parse(firstBuy.time)) : null,
      exitStyle,
      stillOpen,
      trades: rows,
    };
  });
}

export function summarizePositions(positions: WalletPosition[]) {
  const closed = positions.filter((x) => x.realizedPnlUsd != null);
  const sortedHolds = closed.map((x) => x.holdMs).filter((x): x is number => x != null).sort((a, b) => a - b);
  const median = (values: number[]) => values.length ? values[Math.floor(values.length / 2)] : null;
  const profitable = closed.filter((x) => (x.realizedPnlUsd || 0) > 0);
  const losing = closed.filter((x) => (x.realizedPnlUsd || 0) < 0);
  const dollarsLost = losing.reduce((s, x) => s + Math.abs(x.realizedPnlUsd || 0), 0);
  return {
    positions: positions.length,
    closed: closed.length,
    open: positions.length - closed.length,
    profitable: profitable.length,
    losing: losing.length,
    realizedPnlUsd: closed.reduce((s, x) => s + (x.realizedPnlUsd || 0), 0),
    dollarsLost,
    medianHoldMs: median(sortedHolds),
    medianInitialSizeUsd: median(closed.map((x) => x.totalBuyUsd).sort((a, b) => a - b)),
    medianTokenAgeAtEntryMs: median(closed.map((x) => x.tokenAgeAtFirstBuyMs).filter((x): x is number => x != null).sort((a, b) => a - b)),
    exitStyles: Object.fromEntries(['SINGLE_EXIT', 'STAGGERED_EXIT', 'PARTIAL_EXIT', 'STILL_OPEN', 'UNKNOWN'].map((style) => [style, positions.filter((x) => x.exitStyle === style).length])),
  };
}

export const walletAuditQuery = WALLET_TRADES_QUERY;
