'use client';

import { useState } from 'react';

type Audit = {
  ok: boolean;
  status?: string;
  error?: string;
  wallet?: string;
  summary?: Record<string, unknown>;
  positions?: Array<Record<string, unknown>>;
};

const money = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? `$${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';
};

const duration = (n: unknown) => {
  const ms = Number(n);
  if (!Number.isFinite(ms)) return '—';
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

export default function WalletAuditPage() {
  const [walletA, setWalletA] = useState('');
  const [walletB, setWalletB] = useState('');
  const [auditA, setAuditA] = useState<Audit | null>(null);
  const [auditB, setAuditB] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!walletA.trim()) return;
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch(`/api/intelligence/wallet-audit?wallet=${encodeURIComponent(walletA.trim())}&days=30`, { cache: 'no-store' }).then((r) => r.json()),
        walletB.trim() ? fetch(`/api/intelligence/wallet-audit?wallet=${encodeURIComponent(walletB.trim())}&days=30`, { cache: 'no-store' }).then((r) => r.json()) : Promise.resolve(null),
      ]);
      setAuditA(a);
      setAuditB(b);
    } finally {
      setLoading(false);
    }
  }

  const summary = auditA?.summary || {};
  const positions = Array.isArray(auditA?.positions) ? auditA.positions : [];

  return (
    <main style={{ minHeight: '100vh', background: '#05070b', color: '#eaf2ff', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <div style={{ borderBottom: '1px solid #1d2a38', paddingBottom: 18, marginBottom: 20 }}>
          <small style={{ color: '#6edcff', letterSpacing: 2 }}>SOLANA / WALLET INTELLIGENCE</small>
          <h1 style={{ margin: '8px 0', fontSize: 30 }}>POSITION AUDIT TERMINAL</h1>
          <p style={{ color: '#8392a6', maxWidth: 900 }}>30-day observed on-chain wallet analysis. No predictions, no synthetic trades, and missing data remains unknown.</p>
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 18 }}>
          <input value={walletA} onChange={(e) => setWalletA(e.target.value)} placeholder="Wallet A / target wallet" style={inputStyle} />
          <input value={walletB} onChange={(e) => setWalletB(e.target.value)} placeholder="Wallet B / comparison wallet (optional)" style={inputStyle} />
          <button onClick={run} disabled={loading || !walletA.trim()} style={buttonStyle}>{loading ? 'AUDITING…' : 'RUN 30D AUDIT'}</button>
        </section>

        {auditA && !auditA.ok && <div style={errorStyle}>{auditA.status || 'ERROR'} · {auditA.error || 'Unknown error'}</div>}

        {auditA?.ok && <>
          <section style={gridStyle}>
            {[
              ['POSITIONS', summary.positions],
              ['CLOSED', summary.closed],
              ['PROFITABLE', summary.profitable],
              ['LOSING', summary.losing],
              ['REALIZED PNL', money(summary.realizedPnlUsd)],
              ['DOLLARS LOST', money(summary.dollarsLost)],
              ['MEDIAN HOLD', duration(summary.medianHoldMs)],
              ['MEDIAN ENTRY', money(summary.medianInitialSizeUsd)],
            ].map(([label, value]) => <div key={String(label)} style={cardStyle}><small>{label}</small><strong>{String(value ?? '—')}</strong></div>)}
          </section>

          <section style={{ ...cardStyle, marginTop: 18, padding: 0, overflow: 'auto' }}>
            <div style={{ padding: 16, borderBottom: '1px solid #1d2a38' }}><small>OBSERVED POSITIONS</small></div>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead><tr>{['TOKEN','FIRST BUY','TOKEN AGE','SIZE','SELL','PNL','HOLD','EXIT'].map((x) => <th key={x} style={thStyle}>{x}</th>)}</tr></thead>
              <tbody>{positions.map((p, i) => <tr key={`${String(p.mint)}-${i}`}>
                <td style={tdStyle}><b>{String(p.symbol || 'UNKNOWN')}</b><small style={{ display: 'block', color: '#637286' }}>{String(p.mint || '')}</small></td>
                <td style={tdStyle}>{String(p.firstBuyAt || '—')}</td>
                <td style={tdStyle}>{duration(p.tokenAgeAtFirstBuyMs)}</td>
                <td style={tdStyle}>{money(p.totalBuyUsd)}</td>
                <td style={tdStyle}>{money(p.totalSellUsd)}</td>
                <td style={{ ...tdStyle, color: Number(p.realizedPnlUsd) >= 0 ? '#39f2a1' : '#ff6877' }}>{money(p.realizedPnlUsd)}</td>
                <td style={tdStyle}>{duration(p.holdMs)}</td>
                <td style={tdStyle}>{String(p.exitStyle || 'UNKNOWN')}</td>
              </tr>)}</tbody>
            </table>
          </section>
        </>}

        {auditB?.ok && <section style={{ marginTop: 18, ...cardStyle }}>
          <small>COMPARISON WALLET</small>
          <h2 style={{ margin: '8px 0' }}>{auditB.wallet}</h2>
          <p>Realized PnL: <b>{money(auditB.summary?.realizedPnlUsd)}</b> · Dollars lost: <b>{money(auditB.summary?.dollarsLost)}</b> · Positions: <b>{String(auditB.summary?.positions ?? '—')}</b></p>
          <p style={{ color: '#8392a6' }}>Comparison is intentionally metric-based. The terminal does not infer psychology, intent, or future performance.</p>
        </section>}

        <footer style={{ marginTop: 20, color: '#536274', fontSize: 12 }}>SOURCE: BITQUERY SOLANA V2 · 30D WINDOW · FAIL-CLOSED · NO MOCK DATA</footer>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = { background: '#0a0f16', border: '1px solid #223247', borderRadius: 6, padding: '13px 14px', color: '#eaf2ff', outline: 'none' };
const buttonStyle: React.CSSProperties = { background: '#63e6ff', color: '#031018', border: 0, borderRadius: 6, padding: '0 18px', fontWeight: 800, letterSpacing: 1, cursor: 'pointer' };
const cardStyle: React.CSSProperties = { background: '#090e15', border: '1px solid #1b2939', borderRadius: 8, padding: 16 };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: 12, color: '#64758a', fontSize: 11, borderBottom: '1px solid #1d2a38' };
const tdStyle: React.CSSProperties = { padding: 12, borderBottom: '1px solid #121c28', fontSize: 12 };
const errorStyle: React.CSSProperties = { ...cardStyle, color: '#ff6877', marginBottom: 16 };
