CREATE TABLE IF NOT EXISTS tokens (
  id BIGSERIAL PRIMARY KEY,
  chain TEXT NOT NULL,
  address TEXT NOT NULL,
  symbol TEXT,
  name TEXT,
  decimals INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(chain,address)
);

CREATE TABLE IF NOT EXISTS pools (
  id BIGSERIAL PRIMARY KEY,
  chain TEXT NOT NULL,
  dex TEXT NOT NULL,
  address TEXT NOT NULL,
  token0 TEXT,
  token1 TEXT,
  liquidity_usd NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(chain,address)
);

CREATE TABLE IF NOT EXISTS swaps (
  id BIGSERIAL PRIMARY KEY,
  chain TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  pool_address TEXT,
  wallet TEXT,
  side TEXT,
  amount_usd NUMERIC DEFAULT 0,
  block_number BIGINT,
  slot BIGINT,
  event_time TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_scores (
  chain TEXT NOT NULL,
  wallet TEXT NOT NULL,
  win_rate NUMERIC DEFAULT 0,
  pnl_usd NUMERIC DEFAULT 0,
  early_entries INT DEFAULT 0,
  smart_score NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(chain,wallet)
);

CREATE TABLE IF NOT EXISTS signals (
  id BIGSERIAL PRIMARY KEY,
  chain TEXT NOT NULL,
  token TEXT NOT NULL,
  state TEXT NOT NULL,
  score NUMERIC NOT NULL,
  risk_flags JSONB DEFAULT '[]',
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
