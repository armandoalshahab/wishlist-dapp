/* ============================================================
   WIshlist ($WISH) — config
   Utility: Stock Trading Spot & Perps with 0% Fees
   Robinhood Chain Testnet (46630) · Vibe/Vibe launchpad
   Quote asset: ETH/WETH — spot executes on real Uniswap V3 venues
   ============================================================ */
window.WISH_CONFIG = {
  chain: {
    chainId: 46630,
    chainIdHex: "0xb626",
    chainName: "Robinhood Chain Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.testnet.chain.robinhood.com"],
    blockExplorerUrls: ["https://explorer.testnet.chain.robinhood.com"],
  },

  token: {
    address: "0xbb3e901eA5B5BAd7f982D6C81F70Fc3b365ceAe7",
    symbol: "WISH",
    name: "WIshlist",
    decimals: 18,
    explorerApi: "https://explorer.testnet.chain.robinhood.com/api/v2",
    // Verified on Blockscout, 27 Sep 2026:
    fallback: { holders: 7, totalSupply: 1000000000 },
  },

  // ---- real venues on Robinhood Chain TESTNET (community Uniswap V3 deployment) ----
  venues: {
    weth: "0x7943e237c7F95DA44E0301572D358911207852Fa",
    router: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",   // V3 SwapRouter
    quoter: "0xcf05Fc31A6B693DD0bEB76e958ae4BCD490dc985",   // QuoterV2
    feeTiers: [10000, 3000, 1000, 500, 100],                // probed per pool, cached
    slippageBps: 50,          // 0.5% minimum-out protection
  },

  // Stock tokens that exist on this testnet (faucet set). Trading needs a WETH pool.
  spotMarkets: [
    { sym: "NFLX", address: "0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93" },
    { sym: "TSLA", address: "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E" },
    { sym: "AMZN", address: "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02" },
    { sym: "PLTR", address: "0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0" },
    { sym: "AMD",  address: "0x71178BAc73cBeb415514eB542a8995b82669778d" },
  ],

  // perps: no perp engine on this testnet yet — UI labels it indicative (margin priced in ETH)
  perpMarkets: ["NVDA", "TSLA", "AAPL", "AMD", "META", "MSFT", "AMZN", "PLTR", "BTC", "ETH", "SOL", "GOOGL", "NFLX", "SPY"],

  // Live prices/candles from the public Arcus market-data API (CORS *).
  marketData: {
    api: "https://api.arcus.xyz",
    map: {
      NVDA: "NVDA-USD", TSLA: "TSLA-USD", AAPL: "AAPL-USD", AMD: "AMD-USD",
      MSFT: "MSFT-USD", GOOGL: "GOOGL-USD", META: "META-USD", AMZN: "AMZN-USD",
      MU: "MU-USD", PLTR: "PLTR-USD", INTC: "INTC-USD", SPY: "SPY-USD",
      QQQ: "QQQ-USD", BTC: "BTC-USD", ETH: "ETH-USD", SOL: "SOL-USD", NFLX: "NFLX-USD",
    },
    snap: {
      NVDA: 225.07, TSLA: 373.08, AAPL: 340.64, AMD: 628.4, MSFT: 517.9,
      GOOGL: 343.4, META: 746.2, AMZN: 249.9, MU: 1080.9, PLTR: 190.1,
      INTC: 123.0, SPY: 770.6, QQQ: 744.4, BTC: 84785, ETH: 2714, SOL: 120.5, NFLX: 950,
    },
    refreshSec: 20,
  },

  // ---- $WISH utility tiers ----
  tiers: {
    holderMin: 1000,        // >= 1,000 $WISH = app rebates 100% of fees
    vipMin: 25000,          // >= 25,000 = VIP (priority routing + higher leverage)
    fees: {
      spot:  { wish: 0 },                       // pool fee shown from the real tier; holders get 0% via rebate
      perp:  { maker: 0.0002, taker: 0.0005, wish: 0 },
    },
  },

  vaults: [
    { id: "fee", name: "Fee-Subsidy Treasury", desc: "Backstop that pays the rebates behind the $WISH 0% promise so holders truly trade free.", apr: "12–18%", min: 1000 },
    { id: "liq", name: "Spot Liquidity Vault", desc: "Seeds V3 pools (NFLX/TSLA/AMZN/PLTR/AMD vs WETH) on Robinhood Chain testnet. LPs share swap fees.", apr: "8–14%", min: 500 },
    { id: "ins", name: "Perp Insurance Fund", desc: "Coverage pool for socialized losses when the perp venue lands on testnet. Staked $WISH is first-loss backstop.", apr: "15–22%", min: 5000 },
  ],

  rewards: {
    xpPerTrade: 10,
    xpPerHoldDay: 1,
    levels: [
      { lvl: "BRONZE", xp: 0, perk: "0% fee rebate" },
      { lvl: "SILVER", xp: 500, perk: "0% rebate + vault boosts" },
      { lvl: "GOLD", xp: 2500, perk: "+ priority RFQ quotes" },
      { lvl: "PLATINUM", xp: 10000, perk: "+ early new-listings access" },
    ],
  },

  wallet: {
    privyAppId: "",
    providers: [
      { id: "metamask", name: "MetaMask", color: "#f6851b", install: "https://metamask.io/download/" },
      { id: "rabby", name: "Rabby", color: "#9772ff", install: "https://rabby.io/" },
      { id: "coinbase", name: "Coinbase Wallet", color: "#0052ff", install: "https://www.coinbase.com/wallet" },
      { id: "trust", name: "Trust Wallet", color: "#2b75cd", install: "https://www.trustwallet.com/" },
      { id: "binance", name: "Binance Wallet", color: "#f0b90b", install: "https://web3.binance.com/" },
      { id: "okx", name: "OKX Wallet", color: "#ffffff", install: "https://www.okx.com/web3" },
      { id: "walletconnect", name: "WalletConnect", color: "#3b99fc", install: "https://walletconnect.com/" },
    ],
  },

  support: { telegramUrl: "", discordUrl: "", xUrl: "", email: "" },
  launchpad: "https://testnet.vibevibe.fun/",
};
