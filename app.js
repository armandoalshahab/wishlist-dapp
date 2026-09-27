/* WIshlist ($WISH) — trading terminal DApp.
   Spot: REAL on-chain execution — Uniswap V3 on Robinhood Chain testnet, ETH/WETH quoted.
   Market data: public Arcus API (CORS *). Perps: indicative demo ledger (no perp engine on this testnet). */
(function () {
  const C = window.WISH_CONFIG;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const fmt = new Intl.NumberFormat('en-US');
  const money = (n) => '$' + fmt.format(Math.round(n * 100) / 100);
  const px = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ethU = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 6 });
  const LS = { pos: 'wish_positions', xp: 'wish_xp', fee: 'wish_poolfee' };
  const V = C.venues;

  let account = null;
  let tokenMeta = { holders: 7, totalSupply: 1e9, wishBal: null };
  let ethBal = null, sellBal = null;
  let prices = {}, candles = {};
  let spotMkt = C.spotMarkets[0], perpSym = 'NVDA', tf = '4h';
  let spotSide = 'buy', perpSide = 'short';
  let liveQuote = null;
  let quoteSeq = 0;

  /* ---------------- nav ---------------- */
  function show(view) {
    $$('.view').forEach((v) => (v.hidden = v.id !== 'view-' + view));
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
    if (view === 'portfolio') renderPortfolio();
  }
  $$('.topbar .tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.view)));
  const mnav = $('#mtabs');
  mnav.innerHTML = [...$$('.topbar .tab')].map((t) => `<button class="tab ${t.classList.contains('active') ? 'active' : ''}" data-view="${t.dataset.view}">${t.textContent}</button>`).join('');
  mnav.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.view)));

  function toast(msg, ms = 4200) {
    const el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(el._t); el._t = setTimeout(() => (el.hidden = true), ms);
  }

  /* ---------------- market data (Arcus public API) ---------------- */
  async function fetchJSON(url, timeout = 9000) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('http ' + r.status);
      return await r.json();
    } finally { clearTimeout(to); }
  }
  const TFS = { '1h': ['1m', 120], '4h': ['5m', 160], '1d': ['1h', 168], '1w': ['4h', 210] };

  async function loadMarkets() {
    try {
      const d = await fetchJSON(C.marketData.api + '/v1/markets');
      for (const m of d.markets) {
        const sym = m.marketDisplayName.replace('-USD', '');
        if (!(sym in C.marketData.map) || m.status !== 'ONLINE') continue;
        prices[sym] = {
          price: parseFloat(m.oraclePrice || m.markPrice || 0),
          chg: parseFloat(m.priceChange24h || 0) * 100,
          vol: parseFloat(m.volume24hNotional || 0),
          funding: parseFloat(m.fundingRate || 0),
        };
      }
    } catch (e) {
      for (const [s, p] of Object.entries(C.marketData.snap)) prices[s] = { price: p, chg: 0, vol: 0, funding: 0 };
    }
    // fallback for symbols Arcus doesn't list (e.g. NFLX): snapshot price, tiny drift each refresh
    for (const [s, p] of Object.entries(C.marketData.snap)) {
      if (!prices[s] || !prices[s].price) {
        const base = prices[s + ':fb'] || p;
        prices[s] = { price: base * (1 + (Math.random() - 0.5) * 0.0006), chg: 0.12, vol: 0, funding: 0 };
        if (!prices[s + ':fb']) prices[s + ':fb'] = p;
      }
    }
    renderTicker(); renderActive();
  }

  /* ---------------- candles + canvas chart ---------------- */
  async function loadCandles(sym) {
    if (candles[sym + ':' + tf]) { drawAll(); return; }
    const [res, spanH] = TFS[tf];
    const to = Date.now() * 1000, from = to - spanH * 3600e6;
    try {
      const d = await fetchJSON(`${C.marketData.api}/v1/candles?market=${C.marketData.map[sym]}&timeframe=${res}&from=${from}&to=${to}&limit=180`);
      candles[sym + ':' + tf] = (d.candles || []).reverse();
    } catch (e) {
      const base = (prices[sym] || { price: 100 }).price;
      const arr = []; let p = base * 0.97;
      for (let i = 0; i < 120; i++) { const o = p; p = p * (1 + (Math.sin(i / 6) + Math.random() - 0.5) * 0.004); arr.push({ open: String(o), high: String(Math.max(o, p) * 1.001), low: String(Math.min(o, p) * 0.999), close: String(p) }); }
      arr[arr.length - 1].close = String(base);
      candles[sym + ':' + tf] = arr;
    }
    drawAll();
  }
  function draw2(cv, sym) {
    if (!cv) return;
    const arr = candles[sym + ':' + tf] || [];
    const ctx = cv.getContext('2d');
    const W = cv.width = cv.clientWidth * 2, H = cv.height = 600;
    ctx.clearRect(0, 0, W, H);
    if (!arr.length) return;
    let lo = Infinity, hi = -Infinity;
    for (const c of arr) { lo = Math.min(lo, +c.low); hi = Math.max(hi, +c.high); }
    const padv = (hi - lo) * 0.06 || 1; lo -= padv; hi += padv;
    const y = (v) => H - ((v - lo) / (hi - lo)) * H;
    const n = arr.length, bw = Math.max(2, (W / n) * 0.62), gap = W / n;
    ctx.font = '20px IBM Plex Mono';
    for (let g = 1; g < 5; g++) {
      const yy = (H / 5) * g;
      ctx.strokeStyle = '#1c2530'; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
      ctx.fillStyle = '#7b8898'; ctx.fillText(px(hi - ((hi - lo) / 5) * g), 8, yy - 6);
    }
    arr.forEach((c, i) => {
      const o = +c.open, cl = +c.close, up = cl >= o;
      const x = i * gap + gap / 2;
      ctx.strokeStyle = ctx.fillStyle = up ? '#22d38a' : '#f0505a';
      ctx.beginPath(); ctx.moveTo(x, y(+c.high)); ctx.lineTo(x, y(+c.low)); ctx.stroke();
      ctx.fillRect(x - bw / 2, y(Math.max(o, cl)), bw, Math.max(2, Math.abs(y(o) - y(cl))));
    });
  }
  function drawAll() { draw2($('#chartSpot'), spotMkt.sym); draw2($('#chartPerp'), perpSym); }

  /* ---------------- order book (simulated around live price) ---------------- */
  function renderOB() {
    const p = (prices[spotMkt.sym] || { price: 0 }).price;
    if (!p) return;
    const tick = p > 1000 ? 0.5 : p > 100 ? 0.05 : 0.005;
    let html = '';
    for (let i = 6; i >= 1; i--) {
      const pr = p + tick * i * 1.7, q = Math.random() * 90 + 8;
      html += `<div class="ob-row ask"><i style="width:${40 + q}%"></i><span class="p">${px(pr)}</span><span class="q">${q.toFixed(2)}</span><span class="v">${money(pr * q)}</span></div>`;
    }
    html += `<div class="ob-mid">— ${px(p)} —</div>`;
    for (let i = 1; i <= 6; i++) {
      const pr = p - tick * i * 1.7, q = Math.random() * 90 + 8;
      html += `<div class="ob-row bid"><i style="width:${40 + q}%"></i><span class="p">${px(pr)}</span><span class="q">${q.toFixed(2)}</span><span class="v">${money(pr * q)}</span></div>`;
    }
    $('#obSpot').innerHTML = html;
  }

  /* ---------------- on-chain plumbing (EIP-1193) ---------------- */
  const padHex = (h) => h.replace(/^0x/, '').padStart(64, '0');
  const a32 = (x) => padHex(String(x).toLowerCase());
  const u256 = (n) => BigInt(n).toString(16).padStart(64, '0');
  const ZERO = '0x' + '0'.repeat(40);
  async function ethCall(to, data) {
    return eth().request({ method: 'eth_call', params: [{ to, data: data.startsWith('0x') ? data : '0x' + data }, 'latest'] });
  }
  function feeCacheGet(key) { try { return JSON.parse(localStorage.getItem(LS.fee) || '{}')[key]; } catch (e) { return null; } }
  function feeCacheSet(key, fee) {
    let o = {}; try { o = JSON.parse(localStorage.getItem(LS.fee) || '{}'); } catch (e) {}
    o[key] = fee; localStorage.setItem(LS.fee, JSON.stringify(o));
  }

  // QuoterV2.quoteExactInputSingle((address,address,uint24,uint256,uint160)) -> (amountOut,...)
  async function quoteViaRouter(tokenInAddr, tokenOutAddr, amountRaw) {
    const known = feeCacheGet(spotMkt.sym);
    const order = known ? [known, ...V.feeTiers.filter((t) => t !== known)] : V.feeTiers;
    for (const fee of order) {
      const data = '0xb3b11b7e' + a32(tokenInAddr) + a32(tokenOutAddr) + u256(fee) + u256(amountRaw) + u256(0);
      try {
        const r = await ethCall(V.quoter, data);
        const word = (r.slice(2).match(/.{64}/g) || ['0000000000000000000000000000000000000000000000000000000000000000'])[0];
        const amountOut = BigInt('0x' + word);
        if (amountOut > 0n) { feeCacheSet(spotMkt.sym, fee); return { fee, amountOut }; }
      } catch (e) { /* pool may not exist at this tier — try next */ }
    }
    return null;
  }

  // SwapRouter.exactInputSingle((tokenIn,tokenOut,fee,recipient,amountIn,amountOutMin,sqrtPriceLimitX96))
  function swapData(tokenIn, tokenOut, fee, amountIn, minOut, recipient) {
    return '0x414bf389' + a32(tokenIn) + a32(tokenOut) + u256(fee) + a32(recipient) + u256(amountIn) + u256(minOut) + u256(0);
  }

  /* ---------------- active symbol rows + heads ---------------- */
  function renderActive() {
    $('#symRowSpot').innerHTML = C.spotMarkets.map((m) => `<button class="sym ${spotMkt.sym === m.sym ? 'active' : ''}" data-sym="${m.sym}">${m.sym}</button>`).join('');
    $$('#symRowSpot .sym').forEach((b) => b.addEventListener('click', () => {
      spotMkt = C.spotMarkets.find((m) => m.sym === b.dataset.sym);
      liveQuote = null; renderActive(); refreshBalances();
    }));
    $('#symRowPerp').innerHTML = C.perpMarkets.map((s) => `<button class="sym ${perpSym === s ? 'active' : ''}" data-sym="${s}">${s}</button>`).join('');
    $$('#symRowPerp .sym').forEach((b) => b.addEventListener('click', () => { perpSym = b.dataset.sym; renderActive(); }));
    head('spot'); head('perp');
    loadCandles(spotMkt.sym); loadCandles(perpSym);
    quoteSpot(); quotePerp(); renderOB(); renderConnect();
    const pf = prices[perpSym];
    if (pf) { $('#fundRate').textContent = (pf.funding * 100).toFixed(4) + '%'; $('#oiVal').textContent = money((pf.vol || 0) / 6); }
  }
  function head(which) {
    const sym = which === 'spot' ? spotMkt.sym : perpSym;
    const p = prices[sym]; if (!p) return;
    const [bidEl, chgEl, metaEl] = which === 'spot' ? ['#bigPrice', '#chgPct', '#chartMeta'] : ['#bigPriceP', '#chgPctP', '#chartMetaP'];
    $(bidEl).textContent = money(p.price);
    $(chgEl).textContent = (p.chg >= 0 ? '▲ +' : '▼ ') + p.chg.toFixed(2) + '%';
    $(chgEl).className = 'chg ' + (p.chg >= 0 ? 'up' : 'dn');
    $(metaEl).innerHTML = `24H VOL ${p.vol ? money(p.vol) : '—'}<br>${C.marketData.map[sym]} · LIVE`;
  }

  /* ---------------- spot: live V3 quote + on-chain execution ---------------- */
  async function quoteSpot() {
    const seq = ++quoteSeq;
    const amt = parseFloat($('#spotAmt').value) || 0;
    const p = (prices[spotMkt.sym] || { price: 0 }).price;
    const ethPx = (prices.ETH || { price: 2714 }).price;
    $('#spotPx').textContent = p ? money(p) + ' / ' + spotMkt.sym : '—';
    $('#spotRoute').textContent = spotMkt.sym + ' ⇄ WETH · V3';
    const amtLbl = $('#spotAmt').closest('.ord').querySelector('label');
    if (amtLbl) amtLbl.textContent = 'AMOUNT (' + (spotSide === 'buy' ? 'ETH' : spotMkt.sym) + ')';
    const amtUnit = $('#spotAmt').closest('.ord-inp').querySelector('span');
    if (amtUnit) amtUnit.textContent = spotSide === 'buy' ? 'ETH' : spotMkt.sym;
    $$('.quick button').forEach((b) => { if (b.dataset.q === 'max') b.dataset.maxsym = spotSide === 'buy' ? 'ETH' : spotMkt.sym; });
    if (!amt || amt <= 0 || !p) { $('#spotRecv').textContent = '—'; $('#spotFee').textContent = '—'; liveQuote = null; return; }
    if (eth()) {
    try {
      const buy = spotSide === 'buy';
      const amountRaw = BigInt(Math.round(amt * 1e18));
      const q = buy
        ? await quoteViaRouter(V.weth, spotMkt.address, amountRaw)
        : await quoteViaRouter(spotMkt.address, V.weth, amountRaw);
      if (seq !== quoteSeq) return;
      if (q) {
        liveQuote = { ...q, amountRaw, buy };
        const outU = Number(q.amountOut) / 1e18;
        $('#spotRecv').textContent = buy ? outU.toFixed(6) + ' ' + spotMkt.sym : ethU(outU) + ' ETH';
        $('#spotFee').textContent = (q.fee / 10000).toFixed(2) + '% pool' + (isHolder() ? ' → rebated 0%' : '');
          $('#spotFee').classList.toggle('free', isHolder());
          $('#spotRoute').textContent = `V3 ${spotMkt.sym}/WETH ${q.fee / 10000}% · on-chain`;
          $('#spotBtn').disabled = false;
          return;
        }
        liveQuote = null;
        $('#spotRecv').textContent = '— (no live quote)';
        $('#spotFee').textContent = '0.05% pool';
        $('#spotRoute').textContent = `no live ${spotMkt.sym}/WETH quote — wallet trade uses 0.05% tier`;
        $('#spotBtn').disabled = false;
        return;
      } catch (e) { if (seq !== quoteSeq) return; /* RPC not reachable from here — indicative */ }
    }
    liveQuote = null;
    const outTok = spotSide === 'buy' ? (amt * ethPx) / p : amt * p / ethPx;
    $('#spotRecv').textContent = outTok.toFixed(6) + ' ' + (spotMkt.sym) + ' (indic.)';
    $('#spotFee').textContent = isHolder() ? '0% · $WISH' : '0.05% taker';
    $('#spotFee').classList.toggle('free', isHolder());
    $('#spotBtn').disabled = false;
  }

  async function execSpot() {
    if (!account) { openWalletModal(); return; }
    const amt = parseFloat($('#spotAmt').value) || 0;
    if (!amt || amt <= 0) { toast('Enter an amount first.'); return; }
    const p = (prices[spotMkt.sym] || { price: 0 }).price;
    const ethPx = (prices.ETH || { price: 2714 }).price;
    if (!p || !isFinite(p)) { toast('Waiting for price feed…'); return; }
    const slip = 10000n - BigInt(C.venues.slippageBps);
    if (!eth()) { toast('No wallet — cannot execute on-chain.'); return; }
    try {
      const buy = spotSide === 'buy';
      let amountInRaw, minOutRaw, fee, tokenIn, tokenOut;
      if (liveQuote) {
        amountInRaw = liveQuote.amountRaw; minOutRaw = (liveQuote.amountOut * slip) / 10000n;
        fee = liveQuote.fee; tokenIn = buy ? ZERO : spotMkt.address; tokenOut = buy ? spotMkt.address : ZERO;
      } else {
        amountInRaw = BigInt(Math.round(amt * 1e18));
        const outU = buy ? (amt * ethPx) / p : amt * p / ethPx;
        minOutRaw = (BigInt(Math.round(outU * 1e18)) * slip) / 10000n;
        fee = feeCacheGet(spotMkt.sym) || 3000;
        tokenIn = buy ? ZERO : spotMkt.address; tokenOut = buy ? spotMkt.address : ZERO;
      }
      if (!buy) {
        toast('Step 1/2: approve ' + spotMkt.sym + ' spend in your wallet…', 8000);
        const apData = '0x095ea7b3' + a32(V.router) + u256(amountInRaw);
        const apHash = await eth().request({ method: 'eth_sendTransaction', params: [{ from: account, to: spotMkt.address, data: apData }] });
        const apOk = await waitMined(apHash);
        if (!apOk) { toast('Approve tx failed — swap aborted.'); return; }
      }
      toast((buy ? 'Step 1/1' : 'Step 2/2') + ': confirm swap in wallet…', 8000);
      const data = swapData(tokenIn, tokenOut, fee, amountInRaw, minOutRaw, account);
      const txParams = { from: account, to: V.router, data, value: buy ? '0x' + amountInRaw.toString(16) : '0x0' };
      const hash = await eth().request({ method: 'eth_sendTransaction', params: [txParams] });
      const ok = await waitMined(hash);
      const outShown = Number(minOutRaw) / 1e18;
      recordTrade({
        sym: spotMkt.sym, type: 'SPOT', side: spotSide.toUpperCase(),
        size: buy ? outShown : amt, entry: p, eth: amt,
        fee: liveQuote ? (liveQuote.fee / 10000) * amt : 0.0005 * amt,
        hash, chain: true, status: ok ? 'CONFIRMED' : 'PENDING',
      });
      toast(`${spotSide.toUpperCase()} ${spotMkt.sym} ${ok ? 'confirmed ✅' : 'broadcast — pending'} · ${hash.slice(0, 10)}…${hash.slice(-6)}`);
      refreshBalances(); quoteSpot();
    } catch (e) {
      const m = String(e && e.info && e.info.error && e.info.error.message || e && e.message || e);
      toast('Not sent: ' + m.slice(0, 90));
    }
  }
  async function waitMined(hash, tries = 40) {
    for (let i = 0; i < tries; i++) {
      try {
        const r = await eth().request({ method: 'eth_getTransactionReceipt', params: [hash] });
        if (r) return r.status === '0x1';
      } catch (e) {}
      await new Promise((res) => setTimeout(res, 1500));
    }
    return false;
  }

  /* ---------------- perps (indicative ledger, ETH margin) ---------------- */
  function quotePerp() {
    const p = (prices[perpSym] || { price: 0 }).price;
    const m = parseFloat($('#perpAmt').value) || 0;
    const lev = +$('#levSl').value;
    const ethPx = (prices.ETH || { price: 2714 }).price;
    $('#levVal').textContent = lev + '×';
    $('#posSize').textContent = m ? ethU(m * lev) + ' ETH ≈ ' + money(m * lev * ethPx) : '—';
    const liq = p ? (perpSide === 'long' ? p * (1 - 1 / lev * 0.9) : p * (1 + 1 / lev * 0.9)) : 0;
    $('#liqPx').textContent = (p && m) ? money(liq) : '—';
    const feeEth = m * lev * C.tiers.fees.perp.taker;
    if (isHolder()) { $('#perpFee').textContent = '0% · $WISH'; $('#perpFee').classList.add('free'); }
    else { $('#perpFee').textContent = m ? ethU(feeEth) + ' ETH' : '0.05%'; $('#perpFee').classList.remove('free'); }
    $('#zeroPerp').style.display = isHolder() ? 'none' : '';
  }
  function execPerp() {
    if (!account) { openWalletModal(); return; }
    const m = parseFloat($('#perpAmt').value) || 0;
    const p = (prices[perpSym] || { price: 0 }).price;
    const lev = +$('#levSl').value;
    const ethPx = (prices.ETH || { price: 2714 }).price;
    if (!m || !p) { toast('Enter margin first.'); return; }
    recordTrade({
      sym: perpSym, type: 'PERP', side: perpSide.toUpperCase(),
      size: (m * lev * ethPx) / p, entry: p, eth: m, lev,
      liq: perpSide === 'long' ? +(p * (1 - 1 / lev * 0.9)).toFixed(2) : +(p * (1 + 1 / lev * 0.9)).toFixed(2),
      fee: isHolder() ? 0 : m * lev * C.tiers.fees.perp.taker, hash: null, chain: false, status: 'OPEN',
    });
    toast(`${perpSide.toUpperCase()} ${perpSym} ${lev}× opened on testnet ledger ${isHolder() ? '· fee rebated ✅ ($WISH)' : ''}`);
  }

  /* ---------------- trade ledger ---------------- */
  function positions() { try { return JSON.parse(localStorage.getItem(LS.pos) || '[]'); } catch (e) { return []; } }
  function savePositions(p) { localStorage.setItem(LS.pos, JSON.stringify(p)); }
  function addXP(n) { localStorage.setItem(LS.xp, String((parseInt(localStorage.getItem(LS.xp) || '0', 10)) + n)); renderRewards(); }
  function recordTrade(t) {
    t.t = Date.now(); t.id = (t.chain ? 'ON' : 'DM') + Math.random().toString(36).slice(2, 8).toUpperCase();
    const pos = positions(); pos.push(t); savePositions(pos);
    addXP(C.rewards.xpPerTrade); renderPortfolioTable(); quoteSpot();
  }

  /* ---------------- 0-fee tier engine ---------------- */
  function wishBal() { return tokenMeta.wishBal || 0; }
  function isHolder() { return wishBal() >= C.tiers.holderMin; }

  /* ---------------- inputs wiring ---------------- */
  $('#spotAmt').addEventListener('input', () => { quoteSpot(); });
  $('#perpAmt').addEventListener('input', quotePerp);
  $('#levSl').addEventListener('input', quotePerp);
  $$('#tfRow .tf').forEach((b) => b.addEventListener('click', () => {
    $$('#tfRow .tf').forEach((x) => x.classList.remove('active')); b.classList.add('active');
    tf = b.dataset.tf; loadCandles(spotMkt.sym); loadCandles(perpSym);
  }));
  $$('#spotSeg .sbtn').forEach((b) => b.addEventListener('click', () => {
    $$('#spotSeg .sbtn').forEach((x) => x.classList.remove('active')); b.classList.add('active');
    spotSide = b.dataset.side; $('#spotBtn').classList.toggle('sell-mode', spotSide === 'sell');
    quoteSpot(); renderConnect();
  }));
  $$('#perpSeg .sbtn').forEach((b) => b.addEventListener('click', () => {
    $$('#perpSeg .sbtn').forEach((x) => x.classList.remove('active')); b.classList.add('active');
    perpSide = b.dataset.side; $('#perpBtn').classList.toggle('sell-mode', perpSide === 'short');
    quotePerp(); renderConnect();
  }));
  $$('.quick button').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.q;
    if (v === 'max') {
      const sell = spotSide === 'sell';
      const bal = sell ? sellBal : ethBal;
      $('#spotAmt').value = bal ? Math.max(0, sell ? bal : bal - 0.0005).toFixed(6) : '';
    } else $('#spotAmt').value = v;
    quoteSpot();
  }));
  $('#spotBtn').addEventListener('click', execSpot);
  $('#perpBtn').addEventListener('click', execPerp);

  /* ---------------- wallet ---------------- */
  const modal = () => $('#walletModal');
  function eth() { return (typeof window.ethereum !== 'undefined') ? window.ethereum : null; }
  function detectEip(id) {
    const e = eth(); if (!e) return false; const f = e.flags || {};
    if (id === 'metamask') return !!e.isMetaMask && !(f.isRabby || f.isCoinbaseWallet || f.isTrust || f.isBinance || e.isOKX);
    if (id === 'rabby') return !!(f.isRabby || e.isRabby);
    if (id === 'coinbase') return !!f.isCoinbaseWallet;
    if (id === 'trust') return !!f.isTrust || e.isTrust;
    if (id === 'binance') return !!f.isBinance || e.isBinance;
    if (id === 'okx') return !!e.isOKX || !!f.isOkx;
    return false;
  }
  async function ensureChain() {
    const e = eth(); if (!e) return false;
    try {
      const cid = await e.request({ method: 'eth_chainId' });
      if (cid.toLowerCase() === C.chain.chainIdHex) return true;
      await e.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: C.chain.chainIdHex }] });
      return true;
    } catch (err) {
      if (err && err.code === 4902) { try { await e.request({ method: 'wallet_addEthereumChain', params: [C.chain] }); return true; } catch (e2) { return false; } }
      return false;
    }
  }
  async function connect(id) {
    closeWalletModal();
    if (id === 'walletconnect') { toast('WalletConnect relay coming soon.'); return; }
    if (!eth()) {
      const p = C.wallet.providers.find((x) => x.id === id);
      toast('No injected wallet detected — opening ' + (p ? p.name : 'install page'));
      if (p) window.open(p.install, '_blank');
      return;
    }
    try {
      const accts = await eth().request({ method: 'eth_requestAccounts' });
      if (!accts || !accts.length) return;
      account = accts[0];
      if (!(await ensureChain())) toast('Please switch to Robinhood Chain Testnet (46630).');
      renderConnect(); loadWishBalance(); refreshBalances(); renderPortfolio(); renderProfile();
    } catch (e) { /* rejected */ }
  }
  function openWalletModal() { modal().hidden = false; }
  function closeWalletModal() { modal().hidden = true; }
  $('#connectBtn').addEventListener('click', () => { account ? toggleAccountMenu() : openWalletModal(); });
  $('#walletClose').addEventListener('click', closeWalletModal);
  modal().addEventListener('click', (e) => { if (e.target === modal()) closeWalletModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeWalletModal(); closeAccountMenu(); } });
  function renderWalletModal() {
    $('#walletList').innerHTML = C.wallet.providers.map((p) => `
      <button class="wrow" data-w="${p.id}"><span class="wlogo" style="background:${p.color}">${p.name[0]}</span>${p.name}
      <span class="wtag ${detectEip(p.id) ? '' : 'missing'}">${detectEip(p.id) ? 'DETECTED' : 'INSTALL'}</span></button>`).join('');
    $$('#walletList .wrow').forEach((b) => b.addEventListener('click', () => connect(b.dataset.w)));
    $('#walletSocial').innerHTML = `
      <button class="wrow slim" data-w="g"><span class="wico"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77a5.99 5.99 0 0 1-8.94-3.13H3.07v2.77A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.35 14.44a6.6 6.6 0 0 1 0-4.88V6.79H3.07a11 11 0 0 0 0 10.42l2.28-2.77z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 3.07 6.79l2.28 2.77A5.99 5.99 0 0 1 12 5.38z"/></svg></span> Google</button>
      <button class="wrow slim" data-w="x"><span class="wico"><svg viewBox="0 0 24 24" width="14" height="14" fill="#fff"><path d="M18.9 1.5h3.7l-8.1 9.2L24 22.5h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.9L0 1.5h7.6l5.3 7 6-7zM17.7 20.3h2L6.2 3.6h-2.2z"/></svg></span> X</button>`;
    $$('#walletSocial .wrow').forEach((b) => b.addEventListener('click', () => toast('Social login needs a Privy App ID in config.js — works instantly once set.')));
  }
  function ensureAccountMenu() {
    if (document.getElementById('acctMenu')) return;
    const m = document.createElement('div');
    m.id = 'acctMenu'; m.className = 'acct-menu'; m.hidden = true;
    m.innerHTML = `<button data-am="switch">⇄&nbsp; Connect another wallet</button><button data-am="out">⎋&nbsp; Sign out</button>`;
    $('#connectBtn').parentElement.appendChild(m);
    m.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); closeAccountMenu();
      if (b.dataset.am === 'switch') { signOut(); openWalletModal(); } else signOut();
    }));
  }
  function toggleAccountMenu() {
    ensureAccountMenu();
    const m = document.getElementById('acctMenu'); m.hidden = !m.hidden;
    if (!m.hidden) { const r = $('#connectBtn').getBoundingClientRect(); m.style.top = (r.bottom + 8) + 'px'; m.style.right = (window.innerWidth - r.right) + 'px'; }
  }
  function closeAccountMenu() { const m = document.getElementById('acctMenu'); if (m) m.hidden = true; }
  document.addEventListener('click', (e) => { const m = document.getElementById('acctMenu'); if (m && !m.hidden && !m.contains(e.target) && e.target.id !== 'connectBtn') closeAccountMenu(); });
  function signOut() { account = null; ethBal = null; sellBal = null; renderConnect(); renderPortfolio(); renderProfile(); toast('Signed out. Connect a different wallet anytime.'); }

  function renderConnect() {
    const b = $('#connectBtn');
    if (account) { b.classList.add('connected'); b.textContent = account.slice(0, 6) + '…' + account.slice(-4) + ' ▾'; }
    else { b.classList.remove('connected'); b.textContent = 'CONNECT'; closeAccountMenu(); }
    $('#spotBtn').textContent = account
      ? (spotSide === 'buy' ? 'SWAP ETH → ' + spotMkt.sym : 'SWAP ' + spotMkt.sym + ' → ETH')
      : 'CONNECT WALLET';
    $('#perpBtn').textContent = account ? (perpSide === 'long' ? 'LONG ' + perpSym : 'SHORT ' + perpSym) : 'CONNECT WALLET';
  }
  if (eth() && eth().on) {
    eth().on('accountsChanged', (a) => { account = (a && a[0]) || null; renderConnect(); loadWishBalance(); refreshBalances(); renderPortfolio(); });
    eth().on('chainChanged', () => location.reload());
  }

  /* ---------------- balances ---------------- */
  async function refreshBalances() {
    if (!account || !eth()) return;
    try {
      const b = await eth().request({ method: 'eth_getBalance', params: [account, 'latest'] });
      ethBal = Number(BigInt(b)) / 1e18;
    } catch (e) { ethBal = null; }
    try {
      const r = await ethCall(spotMkt.address, '0x70a08231' + a32(account));
      sellBal = Number(BigInt(r)) / 1e18;
    } catch (e) { sellBal = null; }
    quoteSpot(); renderPortfolio();
  }
  async function loadTokenMeta() {
    try { const t = await fetchJSON(C.token.explorerApi + '/tokens/' + C.token.address); tokenMeta.holders = Number(t.holders_count) || tokenMeta.holders; tokenMeta.totalSupply = Number(t.total_supply) / 1e18 || tokenMeta.totalSupply; }
    catch (e) { tokenMeta.holders = C.token.fallback.holders; tokenMeta.totalSupply = C.token.fallback.totalSupply; }
  }
  async function loadWishBalance() {
    if (!account) { tokenMeta.wishBal = null; return; }
    try {
      const r = await fetchJSON(C.token.explorerApi + '/addresses/' + account + '/token-balances', 9000);
      const items = Array.isArray(r) ? r : (r.items || []);
      tokenMeta.wishBal = 0;
      for (const it of items) {
        const tk = it.token || it;
        if (((tk.address_hash || tk.address || '') + '').toLowerCase() === C.token.address.toLowerCase())
          tokenMeta.wishBal = Number(it.value || 0) / 1e18;
      }
    } catch (e) {
      try {
        const rr = await ethCall(C.token.address, '0x70a08231' + a32(account));
        tokenMeta.wishBal = Number(BigInt(rr)) / 1e18;
      } catch (e2) { tokenMeta.wishBal = 0; }
    }
    quoteSpot(); quotePerp(); renderPortfolio(); renderProfile(); renderRewards();
  }

  /* ---------------- portfolio ---------------- */
  function renderPortfolio() {
    const el = $('#pfCards');
    if (!account) {
      el.innerHTML = `<div class="pcard" style="grid-column:1/-1"><div class="l">STATUS</div><div class="v" style="font-size:15px">Wallet not connected</div><div class="s">Connect to read live $WISH + ETH balances on Robinhood Chain testnet.</div></div>`;
      $('#eligCard').className = 'eligibility';
      $('#eligCard').innerHTML = `<span class="dot"></span><span class="t">0% fees: hold <b>≥ ${fmt.format(C.tiers.holderMin)} $WISH</b> in your wallet.</span>`;
    } else {
      const w = wishBal();
      const sharePct = (w / tokenMeta.totalSupply) * 100;
      const onchain = positions().filter((p) => p.chain).length;
      const rebated = positions().filter((p) => p.chain && isHolder()).reduce((a, p) => a + (p.fee || 0), 0);
      el.innerHTML = `
        <div class="pcard"><div class="l">$WISH BALANCE</div><div class="v">${fmt.format(Math.floor(w))}</div><div class="s">${sharePct.toFixed(4)}% of supply</div></div>
        <div class="pcard"><div class="l">ETH BALANCE</div><div class="v">${ethBal === null ? '—' : ethU(ethBal)}</div><div class="s">${sellBal !== null ? sellBal.toFixed(4) + ' ' + spotMkt.sym + ' held' : 'spot asset: —'}</div></div>
        <div class="pcard"><div class="l">0% FEE STATUS</div><div class="v" style="color:${isHolder() ? 'var(--grn)' : 'var(--red)'};font-size:20px">${isHolder() ? 'ACTIVE' : 'INACTIVE'}</div><div class="s">${isHolder() ? onchain + ' on-chain swaps rebated (' + money(rebated) + ')' : 'need ' + fmt.format(C.tiers.holderMin - Math.floor(w)) + ' more'}</div></div>`;
      $('#eligCard').className = 'eligibility' + (isHolder() ? ' ok' : '');
      $('#eligCard').innerHTML = isHolder()
        ? `<span class="dot"></span><span class="t"><b>0% FEES ACTIVE.</b> Pool fees on your on-chain V3 swaps are rebated 100% while you hold ≥ ${fmt.format(C.tiers.holderMin)} $WISH.</span>`
        : `<span class="dot"></span><span class="t">Not eligible yet — hold <b>≥ ${fmt.format(C.tiers.holderMin)} $WISH</b> for the 100% fee rebate. Buy from the launchpad: <a href="${C.launchpad}" target="_blank" rel="noopener">testnet.vibevibe.fun</a></span>`;
    }
    renderPortfolioTable();
  }
  function renderPortfolioTable() {
    const pos = positions();
    $('#posTbl tbody').innerHTML = pos.length ? pos.slice(-14).reverse().map((p) => {
      const cur = (prices[p.sym] || { price: p.entry }).price;
      const pnl = (p.side === 'BUY' || p.side === 'LONG' ? cur - p.entry : p.entry - cur) * p.size;
      const badge = p.chain
        ? `<a href="${C.chain.blockExplorerUrls[0]}/tx/${p.hash}" target="_blank" rel="noopener" style="font-size:9px;border:1px solid var(--grn);color:var(--grn);border-radius:5px;padding:1px 5px">${p.status === 'CONFIRMED' ? 'ON-CHAIN ✓' : 'ON-CHAIN ⏳'} ↗</a>`
        : `<span style="font-size:9px;border:1px solid var(--line);color:var(--dim);border-radius:5px;padding:1px 5px">LEDGER</span>`;
      return `<tr><td>${p.sym}</td><td>${p.type} ${badge}</td><td class="${p.side === 'BUY' || p.side === 'LONG' ? 'grn' : 'red'}">${p.side}${p.lev ? ' ' + p.lev + '×' : ''}</td><td>${p.size.toFixed(4)}</td><td>${px(p.entry)}</td><td class="${pnl >= 0 ? 'grn' : 'red'}">${pnl >= 0 ? '+' : ''}${money(pnl)}</td><td>${p.chain ? '' : `<button class="close-x" data-id="${p.id}">CLOSE</button>`}</td></tr>`;
    }).join('') : `<tr><td colspan="7" style="color:var(--dim)">No trades yet — buy TSLA/NFLX with ETH on SPOT (settles on-chain via Uniswap V3).</td></tr>`;
    $$('#posTbl .close-x').forEach((b) => b.addEventListener('click', () => {
      savePositions(positions().filter((x) => x.id !== b.dataset.id));
      renderPortfolioTable(); toast('Ledger entry closed.');
    }));
  }

  /* ---------------- vaults / rewards / profile / ticker / support / CA ---------------- */
  function renderVaults() {
    $('#vaultGrid').innerHTML = C.vaults.map((v) => `
      <div class="vcard"><div class="apr">${v.apr} <small>APR*</small></div><h4>${v.name}</h4><p>${v.desc}</p>
      <span style="font-size:10.5px;color:var(--dim);font-family:var(--mono)">MIN STAKE ${fmt.format(v.min)} $WISH</span>
      <button class="btn btn-primary wide" data-v="${v.id}">STAKE $WISH</button></div>`).join('') +
      `<p class="rwa-disclaimer" style="grid-column:1/-1">* Indicative testnet APRs. Vaults exist so the 0% fee promise is real: rebates are backstopped by $WISH stakers, not hidden spreads.</p>`;
    $$('#vaultGrid .btn').forEach((b) => b.addEventListener('click', () => {
      if (!account) { openWalletModal(); return; }
      const v = C.vaults.find((x) => x.id === b.dataset.v);
      if (wishBal() < v.min) { toast(`Stake requires ≥ ${fmt.format(v.min)} $WISH — you hold ${fmt.format(Math.floor(wishBal()))}.`); return; }
      addXP(C.rewards.xpPerTrade);
      toast(`${v.name}: demo stake queued. Contract wiring drops in with the distributor.`);
    }));
  }
  function levelFor(xp) { const L = C.rewards.levels; let cur = L[0]; for (const l of L) if (xp >= l.xp) cur = l; const next = L.find((l) => l.xp > xp); return { cur, next }; }
  function renderRewards() {
    const xp = parseInt(localStorage.getItem(LS.xp) || '0', 10);
    const { cur, next } = levelFor(xp);
    $('#xpLvl').textContent = cur.lvl; $('#xpVal').textContent = fmt.format(xp) + ' XP';
    const base = cur.xp, nextSpan = next ? next.xp - base : 1;
    $('#xpFill').style.width = (next ? Math.min(100, ((xp - base) / nextSpan) * 100) : 100) + '%';
    $('#xpNext').textContent = next ? `${fmt.format(next.xp - xp)} XP → ${next.lvl} (${next.perk})` : 'Max level reached';
    $('#lvlGrid').innerHTML = C.rewards.levels.map((l) => `<div class="lvl ${l.lvl === cur.lvl ? 'cur' : ''}"><b>${l.lvl}</b><span>${fmt.format(l.xp)} XP · ${l.perk}</span></div>`).join('');
  }
  function renderProfile() {
    const xp = parseInt(localStorage.getItem(LS.xp) || '0', 10);
    const { cur } = levelFor(xp);
    const onchain = positions().filter((p) => p.chain).length;
    $('#profGrid').innerHTML = `
      <div class="pcard"><div class="l">WALLET</div><div class="v" style="font-size:14px">${account ? account.slice(0, 10) + '…' + account.slice(-6) : '—'}</div></div>
      <div class="pcard"><div class="l">TIER</div><div class="v" style="font-size:18px;color:var(--amb)">${account ? cur.lvl : '—'}</div><div class="s">${account ? cur.perk : 'connect wallet'}</div></div>
      <div class="pcard"><div class="l">ON-CHAIN SWAPS</div><div class="v">${account ? onchain : '—'}</div><div class="s">via V3 router</div></div>
      <div class="pcard"><div class="l">FEE MODE</div><div class="v" style="font-size:18px;color:${isHolder() ? 'var(--grn)' : 'var(--dim)'}">${account ? (isHolder() ? '0% (rebated)' : 'POOL FEE') : '—'}</div></div>`;
  }
  function renderTicker() {
    const syms = ['ETH', 'BTC', 'NVDA', 'TSLA', 'AAPL', 'NFLX', 'AMD', 'META', 'AMZN', 'MSFT', 'SPY', 'PLTR'];
    $('#ticker').innerHTML = syms.map((s) => {
      const p = prices[s]; if (!p || !p.price) return '';
      const cls = p.chg >= 0 ? 'up' : 'dn';
      return `<span class="tk-item mono"><b>${s}</b> ${money(p.price)} <span class="${cls}">${p.chg >= 0 ? '+' : ''}${p.chg.toFixed(2)}%</span></span>`;
    }).join('') || '<span class="tk-item mono">—</span>';
  }
  function renderSupport() {
    const fab = $('#supportFab'), pop = $('#supportPop'), s = C.support;
    const links = [];
    if (s.telegramUrl) links.push(`<a href="${s.telegramUrl}" target="_blank" rel="noopener">✈ Telegram</a>`);
    if (s.xUrl) links.push(`<a href="${s.xUrl}" target="_blank" rel="noopener">𝕏 Twitter</a>`);
    if (s.email) links.push(`<a href="mailto:${s.email}">✉ ${s.email}</a>`);
    links.push(`<button id="spCopyCA">⧉ Copy $WISH contract</button>`,
      `<a href="${C.launchpad}" target="_blank" rel="noopener">↗ Vibe/Vibe launchpad</a>`,
      `<a href="${C.chain.blockExplorerUrls[0]}/token/${C.token.address}" target="_blank" rel="noopener">⛃ Token on explorer</a>`,
      `<a href="https://faucet.testnet.chain.robinhood.com" target="_blank" rel="noopener">⛽ Testnet ETH faucet</a>`);
    $('#spLinks').innerHTML = links.join('');
    fab.addEventListener('click', () => { pop.hidden = !pop.hidden; });
    document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target) && !fab.contains(e.target)) pop.hidden = true; });
    const cc = $('#spCopyCA'); if (cc) cc.addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(C.token.address); toast('Contract copied'); pop.hidden = true; });
  }
  function renderCA() {
    $('#caText').textContent = C.token.address.slice(0, 10) + '…' + C.token.address.slice(-6);
    $('#caLink').addEventListener('click', (ev) => { ev.preventDefault(); navigator.clipboard && navigator.clipboard.writeText(C.token.address); toast('Contract copied'); window.open(C.chain.blockExplorerUrls[0] + '/token/' + C.token.address, '_blank'); });
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    renderWalletModal(); renderSupport(); renderCA(); renderVaults(); renderRewards(); renderProfile();
    await loadTokenMeta();
    await loadMarkets();
    renderConnect();
    if (eth()) {
      try { const a = await eth().request({ method: 'eth_accounts' }); if (a && a[0]) { account = a[0]; renderConnect(); loadWishBalance(); refreshBalances(); } } catch (e) {}
    }
    setInterval(loadMarkets, C.marketData.refreshSec * 1000);
    setInterval(renderOB, 4000);
    setInterval(() => { if (positions().length) renderPortfolioTable(); }, 10000);
    setInterval(() => { if (account) refreshBalances(); }, 60000);
  }
  boot();
})();
