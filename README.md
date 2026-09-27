# WIshlist — Builder Role Submission
### Vibe/Vibe Testnet · Robinhood Chain (chain ID 46630)

**Utility:** Stock Trading Spot & Perps with 0% Fees — by holding $WISH.

> **Live:** https://wishlist-trade.netlify.app/
> **Token:** $WISH — `0xbb3e901eA5B5BAd7f982D6C81F70Fc3b365ceAe7` (ERC-20, 1B supply, verified on Blockscout)

## The idea in one line
A full trading terminal (spot + perps, Arcus-style) on Robinhood Chain testnet where the token itself is the access key: **hold ≥ 1,000 $WISH and every spot & perp fee drops to 0%** — real live market data, zero-fee economics, gamified XP.

## The 6 tabs
1. **SPOT** — trading terminal: symbol strip (14 markets), live candle chart (1H/4H/1D/1W), order book, buy/sell panel with quote + fee line. Fee shows `$0.25` for normal users and flips to **`0% · $WISH`** the moment your wallet holds ≥ 1,000 $WISH.
2. **PERPS** — same terminal with LONG/SHORT, 1–50× leverage slider, position size + estimated liquidation math, funding rate read live. Same 0%-fee flip for holders.
3. **PORTFOLIO** — live $WISH balance from the chain (Blockscout), supply share, **0% FEE STATUS card (ACTIVE/INACTIVE)** with the exact top-up needed, trade count, fees-saved total, and an open-positions table with live PnL ticking on real prices.
4. **VAULTS** — three stake pools that make the 0% promise economically coherent: Fee-Subsidy Treasury (backstops waived fees), Spot Liquidity Vault, Perp Insurance Fund.
5. **REWARDS** — XP loop: trades/holds/stakes earn XP → BRONZE→SILVER→GOLD→PLATINUM with escalating perks (0% spot → 0% all → priority RFQ → early listings).
6. **PROFILE** — wallet card, tier, holdings, fee mode, plus the $WISH utility matrix.

## Market data — this is NOT fake
Prices, 24h change, funding rates and OHLCV candles come **live from the public Arcus market-data API** (`api.arcus.xyz`, CORS open) — the actual Robinhood Chain venue for tokenized stocks. NVDA/AAPL/TSLA/META/etc. render at real market prices with real candles; there's an offline snapshot fallback so the chart never breaks.

## The 0% fee engine (the utility, proven in-UI)
- Non-holder: spot 0.05%, perp taker 0.05% — clearly displayed per order.
- Wallet crosses **1,000 $WISH**: balance is read on-chain, both fee lines flip to `0% · $WISH`, eligibility card goes green, every order toast confirms `0% fee ✅ ($WISH)`.
- **25,000+ $WISH** = VIP tier (priority RFQ perk).
- Vaults narrative answers the obvious question ("who eats the fees?"): $WISH stakers do — 8–22% APR funded by launchpad incentives and routing revenue share.

## Wallet / infra
- EIP-1193 modal: MetaMask, Rabby, Coinbase, Trust, Binance, OKX, WalletConnect, with live DETECTED/INSTALL badges + account dropdown (connect another / sign out).
- Auto chain-switch to Robinhood Chain Testnet (46630), adds chain if missing.
- Positions & XP persist in localStorage (testnet demo ledger; swaps to a contract when wired).
- Support bubble bottom-right; zero build step, 4 static files.

## Honest status (testnet)
- Live: real market data, real on-chain $WISH balance & eligibility, fee engine, XP loop, full terminal UX.
- Demo layer: order matching/fills (positions stored client-side) — waiting on the launchpad's venue contracts to settle on-chain.
- APRs and fee tiers are design parameters in `config.js`, trivially pointed at real contracts.

## Files
```
wishlist/
├── index.html  ├── style.css  ├── config.js  ├── app.js  └── README.md / REPORT.md
```
