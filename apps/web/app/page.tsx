'use client';

import PumpTerminal from './pump/page';

/**
 * Production entrypoint for the Liquidity Intelligence terminal.
 *
 * Keep the root route intentionally thin: all terminal state, realtime
 * ingestion, provider diagnostics, token intelligence and visualisation live
 * in the PumpTerminal module so `/` and `/pump` render the same application.
 */
export default function Home() {
  return (
    <div id="liquidity-terminal" data-app="liquidity-intelligence">
      <PumpTerminal />
    </div>
  );
}
