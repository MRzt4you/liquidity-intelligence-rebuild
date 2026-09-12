export type Event = {
  devBuyUsd?: number;
  smartMoneyCount?: number;
  smartMoneyPnlUsd?: number;
  liquidityUsd?: number;
  tokenAgeSec?: number;
  holderConcentrationPct?: number;
  mintAuthorityDisabled?: boolean;
  freezeAuthorityDisabled?: boolean;
  volumeAcceleration?: number;
};

export class SignalEngine {
  private items: any[] = [];

  score(e: Event) {
    const risk: string[] = [];
    if (e.holderConcentrationPct != null && e.holderConcentrationPct > 35) risk.push('CONCENTRATED_HOLDERS');
    if (e.mintAuthorityDisabled === false) risk.push('MINT_AUTHORITY_ACTIVE');
    if (e.freezeAuthorityDisabled === false) risk.push('FREEZE_AUTHORITY_ACTIVE');
    if (e.liquidityUsd != null && e.liquidityUsd < 10000) risk.push('LOW_LIQUIDITY');

    let score = 0;
    if ((e.devBuyUsd || 0) > 0) score += 20;
    if ((e.smartMoneyCount || 0) >= 2) score += 25;
    if ((e.smartMoneyPnlUsd || 0) > 0) score += 15;
    if ((e.volumeAcceleration || 0) > 0) score += 15;
    if (e.tokenAgeSec != null && e.tokenAgeSec <= 120) score += 15;
    if (!risk.length) score += 10;

    score = Math.max(0, Math.min(100, score - risk.length * 10));
    return { score, riskFlags:risk, state: score >= 70 && risk.length <= 1 ? 'ACTIVE':'WATCH' };
  }

  push(x:any) { this.items.unshift(x); this.items = this.items.slice(0,100); }
  recent() { return this.items; }
}
