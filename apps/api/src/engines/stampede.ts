export type LiveToken = {
  mint: string;
  symbol: string;
  createdAt: number;
  lastSeen: number;
  buys: number;
  sells: number;
  volumeSol: number;
  buySol: number;
  sellSol: number;
  buyers: Set<string>;
  sellers: Set<string>;
  wallets: Set<string>;
  score: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
};

type WalletAction = { wallet: string; mint: string; side: 'BUY' | 'SELL'; sol: number; ts: number; signature: string };

export class StampedeEngine {
  private tokens = new Map<string, LiveToken>();
  private actions: WalletAction[] = [];
  private maxActions = 5000;

  observe(a: WalletAction) {
    if (!a.wallet || !a.mint) return;
    const now = Date.now();
    let t = this.tokens.get(a.mint);
    if (!t) {
      t = { mint: a.mint, symbol: a.mint.slice(0, 6), createdAt: now, lastSeen: now, buys: 0, sells: 0, volumeSol: 0, buySol: 0, sellSol: 0, buyers: new Set(), sellers: new Set(), wallets: new Set(), score: 0, risk: 'UNKNOWN' };
      this.tokens.set(a.mint, t);
    }
    t.lastSeen = now;
    t.wallets.add(a.wallet);
    t.volumeSol += Math.abs(a.sol);
    if (a.side === 'BUY') { t.buys++; t.buySol += Math.abs(a.sol); t.buyers.add(a.wallet); }
    else { t.sells++; t.sellSol += Math.abs(a.sol); t.sellers.add(a.wallet); }
    this.actions.unshift(a);
    if (this.actions.length > this.maxActions) this.actions.length = this.maxActions;
  }

  private rotationFor(mint: string) {
    const cutoff = Date.now() - 30 * 60_000;
    const incoming = new Set<string>();
    const origins = new Map<string, number>();
    for (const a of this.actions) {
      if (a.ts < cutoff || a.mint !== mint || a.side !== 'BUY') continue;
      for (const prior of this.actions) {
        if (prior.wallet !== a.wallet || prior.side !== 'SELL' || prior.ts >= a.ts || a.ts - prior.ts > 5 * 60_000) continue;
        incoming.add(a.wallet);
        origins.set(prior.mint, (origins.get(prior.mint) || 0) + 1);
        break;
      }
    }
    return { wallets: incoming.size, origins: [...origins.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5) };
  }

  snapshot(limit = 100) {
    return [...this.tokens.values()].map(t => {
      const age = Math.max(0, Date.now() - t.createdAt);
      const buyRatio = t.buySol + t.sellSol > 0 ? t.buySol / (t.buySol + t.sellSol) : 0;
      const rotation = this.rotationFor(t.mint);
      const activity = Math.min(25, Math.log10(1 + t.volumeSol) * 8);
      const breadth = Math.min(20, t.wallets.size * 1.5);
      const flow = buyRatio * 30;
      const fresh = age < 5 * 60_000 ? 20 : age < 30 * 60_000 ? 12 : 5;
      const rotationScore = Math.min(15, rotation.wallets * 2);
      const score = Math.round(Math.min(100, activity + breadth + flow + fresh + rotationScore));
      const risk = t.sells > t.buys * 1.5 ? 'HIGH' : t.wallets.size < 3 ? 'UNKNOWN' : buyRatio > .6 ? 'LOW' : 'MEDIUM';
      return { mint:t.mint, symbol:t.symbol, ageMs:age, buys:t.buys, sells:t.sells, volumeSol:+t.volumeSol.toFixed(4), buySol:+t.buySol.toFixed(4), sellSol:+t.sellSol.toFixed(4), buyers:t.buyers.size, sellers:t.sellers.size, wallets:t.wallets.size, rotationWallets:rotation.wallets, rotationOrigins:rotation.origins, score, risk, lastSeen:t.lastSeen };
    }).sort((a,b)=>b.score-a.score).slice(0,limit);
  }
}
