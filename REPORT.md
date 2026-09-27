# WIshlist — Builder Role Report
### Vibe/Vibe RWA Testnet · Robinhood Chain (chain ID 46630)

**One-liner:** A stock trading terminal (spot + perps) on Robinhood Chain testnet where holding $WISH makes every trade fee-free — spot swaps settle on-chain through real Uniswap V3 venues.

---

## Links

| Item | URL / Value |
|---|---|
| Live DApp | https://wishlist-trade.netlify.app/ |
| $WISH contract (CA) | `0xbb3e901eA5B5BAd7f982D6C81F70Fc3b365ceAe7` |
| Token on explorer | https://explorer.testnet.chain.robinhood.com/token/0xbb3e901eA5B5BAd7f982D6C81F70Fc3b365ceAe7 |
| Launchpad (buy $WISH) | https://testnet.vibevibe.fun/ |
| Chain | Robinhood Chain Testnet · 46630 (0xb626) |

## Token

- **Name / symbol:** WIshlist ($WISH) · ERC-20 · 18 decimals
- **Total supply:** 1,000,000,000 (verified on Blockscout, 27 Sep 2026)
- **Holders at time of writing:** 7 (early — launchpad bonding still open)

## Utility — "Stock Trading Spot & Perps with 0% Fees"

The whole point of $WISH: **hold ≥ 1,000 $WISH → 100% fee rebate on every trade in the app.**

The DApp reads your $WISH balance on-chain the moment you connect. Eligible wallets see the fee line flip to `0% · $WISH` on both venues, live. Non-holders pay standard fees (0.05% taker perps / pool fee spot). Higher tiers (25,000+ $WISH = VIP) unlock priority routing and higher leverage in the roadmap.

## Product — 6 tabs

1. **SPOT** — ETH ⇄ tokenized stocks (NFLX, TSLA, AMZN, PLTR, AMD). **Real on-chain execution**: live quotes pulled from the Uniswap V3 Quoter on Robinhood testnet, swaps sent through the V3 SwapRouter with 0.5% slippage protection, tx hash + explorer link attached to every fill. Sell side handles the ERC-20 approve step automatically.
2. **PERPS** — 14 markets (NVDA, TSLA, BTC, ETH, SPY…), 1–50× leverage, liquidation price, funding rate, margin in ETH. Honest labeling: indicative testnet ledger (no perp engine is deployed on this chain yet — the UI states this).
3. **PORTFOLIO** — live $WISH + ETH + spot-asset balances, 0% fee eligibility card, full trade history with ON-CHAIN ✓ badges linking to the explorer.
4. **VAULTS** — three staking vaults that make the 0% promise economically real: Fee-Subsidy Treasury (backs the rebates), Spot Liquidity Vault (seeds V3 pools), Perp Insurance Fund (first-loss backstop).
5. **REWARDS** — XP/level loop (BRONZE→PLATINUM): trade = 10 XP, hold = 1 XP/day; levels stack perks on top of the fee rebate.
6. **PROFILE** — tier, on-chain swap count, fee mode at a glance.

## Market data is genuinely live

Prices, candles (1H/4H/1D/1W), 24h change, volume and funding rates stream from the public Arcus market-data API (CORS-open, no key needed) every 20s — so charts and order flow reflect real market prices while trading settles on the testnet.

## How to buy $WISH (user flow)

1. Go to **https://testnet.vibevibe.fun/**, find **WIshlist ($WISH)** in the launchpad, buy with testnet ETH (bonding curve; pool graduates to the DEX router once filled).
2. Need gas? Testnet ETH from **https://faucet.testnet.chain.robinhood.com** (link is also in the DApp's support panel).
3. Open **https://wishlist-trade.netlify.app/** → Connect Wallet (MetaMask/Rabby/etc., auto-switches to chain 46630).
4. Hold ≥ 1,000 $WISH → the fee line flips to **0% · $WISH** → trade spot with ETH (settles on-chain via V3 pool), perps on the ledger.

## Architecture notes (technical credibility)

- Zero build step: static HTML/CSS/JS, one config file (`config.js`) — venues, markets, tiers all parameterized.
- V3 venue probing: pool fee tier discovered per token via `getPool()` against the testnet Factory, cached in localStorage; quotes iterate tiers (1.00% / 0.30% / 0.10% / 0.05% / 0.01%).
- Trade payload: `SwapRouter02.exactInputSingle` with `msg.value` ETH for buys; `approve` + swap for sells; minOut = quoted amount × (1 − 0.5%).
- Graceful degradation: if a pool has no liquidity yet, the UI shows an indicative quote and the swap still routes to the wallet — no dead buttons, no fake "confirmed" (on-chain fills are receipt-verified before the ✓ badge).

## Honest caveats (stated up front)

- **Perps are a labeled demo ledger** — there is no perpetual DEX engine on Robinhood testnet to integrate with yet; the venue UI, margin math and $WISH fee rebate are fully wired so it drops onto a real engine when one exists.
- **NFLX/WETH is currently the deep V3 pool** on this testnet; other spot pairs show indicative until their pools are seeded (the Spot Liquidity Vault is the planned mechanism).
- Vault staking and XP are testnet-state (localStorage) — distributor/vault contracts are the next build milestone.

## Roadmap

1. Wire vault + rebate contracts (rebates paid from Fee-Subsidy Treasury in $WISH).
2. Seed V3 pools for TSLA/AMZN/PLTR/AMD so every spot pair is fully on-chain.
3. Perp engine integration as soon as one is available on Robinhood Chain.
4. Referral XP + listing-vote governance for $WISH holders.
