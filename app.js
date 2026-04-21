/* ================================================
   APEX SMC CAPITAL - Application Logic
   ================================================ */

const state = {
   symbols: [
      { ticker: 'BTC/USDT', id: 'BINANCE:BTCUSDT', price: 67445.30, change: 2.34 },
      { ticker: 'ETH/USDT', id: 'BINANCE:ETHUSDT', price: 3421.45, change: -1.28 },
      { ticker: 'EUR/USD',  id: 'BINANCE:EURUSD',  price: 1.0867,  change: 0.15 },
      { ticker: 'GBP/USD',  id: 'BINANCE:GBPUSD',  price: 1.2682,  change: 0.42 },
      { ticker: 'USD/JPY',  id: 'BINANCE:USDJPY',  price: 154.18,  change: -0.23 },
      { ticker: 'XAU/USD',  id: 'BINANCE:GOLD',    price: 2338.20, change: 0.87 },
      { ticker: 'AAPL',     id: 'NASDAQ:AAPL',     price: 189.45,  change: 1.12 },
      { ticker: 'TSLA',     id: 'NYSE:TSLA',       price: 248.30,  change: -0.56 }
   ],
   currentSymbol: 'BINANCE:BTCUSDT',
   currentTimeframe: '60',
   signals: [],
   account: {
      balance: 50000,
      equity: 51847.32,
      dailyLoss: 0.84,
      maxDailyLoss: 5,
      riskPercent: 1,
      openPositions: 3,
      maxPositions: 5
   },
   charts: {}
};

/* ================================================
   INIT
   ================================================ */
document.addEventListener('DOMContentLoaded', () => {
   initSignals();
   initTicker();
   initCharts();
   initToolbar();
   initEventListeners();
   startRealTimeUpdates();
   updateAccountDisplay();
});

/* ================================================
   SIGNALS
   ================================================ */
function initSignals() {
   state.signals = [
      {
         id: 1, symbol: 'BTC/USDT', type: 'long', status: 'open',
         entry: 67234.50, sl: 65890.00, tp: 69500.00,
         current: 67445.30, score: 0.82,
         timeframe: 'H1', timestamp: Date.now() - 3600000,
         concepts: { ob: true, fvg: true, bos: true, choch: false, liq: true, induc: false }
      },
      {
         id: 2, symbol: 'ETH/USDT', type: 'short', status: 'open',
         entry: 3456.78, sl: 3520.00, tp: 3320.00,
         current: 3421.45, score: 0.76,
         timeframe: 'H4', timestamp: Date.now() - 7200000,
         concepts: { ob: true, fvg: false, bos: true, choch: true, liq: true, induc: false }
      },
      {
         id: 3, symbol: 'EUR/USD', type: 'long', status: 'tp',
         entry: 1.0865, sl: 1.0810, tp: 1.0950,
         current: 1.0952, score: 0.89,
         timeframe: 'M15', timestamp: Date.now() - 14400000,
         concepts: { ob: true, fvg: true, bos: true, choch: false, liq: false, induc: true }
      },
      {
         id: 4, symbol: 'XAU/USD', type: 'short', status: 'open',
         entry: 2345.60, sl: 2375.00, tp: 2285.00,
         current: 2338.20, score: 0.71,
         timeframe: 'H1', timestamp: Date.now() - 1800000,
         concepts: { ob: false, fvg: true, bos: true, choch: false, liq: true, induc: true }
      },
      {
         id: 5, symbol: 'GBP/USD', type: 'long', status: 'sl',
         entry: 1.2678, sl: 1.2620, tp: 1.2800,
         current: 1.2615, score: 0.65,
         timeframe: 'H1', timestamp: Date.now() - 28800000,
         concepts: { ob: true, fvg: false, bos: false, choch: true, liq: false, induc: true }
      },
      {
         id: 6, symbol: 'USD/JPY', type: 'short', status: 'open',
         entry: 154.320, sl: 154.850, tp: 153.400,
         current: 154.180, score: 0.78,
         timeframe: 'M5', timestamp: Date.now() - 5400000,
         concepts: { ob: true, fvg: true, bos: false, choch: true, liq: true, induc: false }
      },
      {
         id: 7, symbol: 'TSLA', type: 'long', status: 'open',
         entry: 245.60, sl: 238.50, tp: 260.00,
         current: 248.30, score: 0.74,
         timeframe: 'M15', timestamp: Date.now() - 900000,
         concepts: { ob: true, fvg: true, bos: true, choch: false, liq: false, induc: true }
      },
      {
         id: 8, symbol: 'AAPL', type: 'short', status: 'closed',
         entry: 189.45, sl: 191.20, tp: 185.00,
         current: 185.20, score: 0.81,
         timeframe: 'H1', timestamp: Date.now() - 86400000,
         concepts: { ob: true, fvg: true, bos: true, choch: true, liq: true, induc: false }
      }
   ];
   renderSignals();
}

function renderSignals(filter = 'all') {
   const container = document.getElementById('signalsList');
   if (!container) return;

   let filtered = state.signals;
   if (filter === 'long') filtered = state.signals.filter(s => s.type === 'long' && s.status === 'open');
   else if (filter === 'short') filtered = state.signals.filter(s => s.type === 'short' && s.status === 'open');
   else if (filter === 'closed') filtered = state.signals.filter(s => s.status !== 'open');

   // Update active count badge
   const openCount = state.signals.filter(s => s.status === 'open').length;
   const badge = document.querySelector('.count-badge.open');
   if (badge) badge.textContent = openCount;

   if (filtered.length === 0) {
      container.innerHTML = `
         <div class="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            <span>No signals found</span>
         </div>
      `;
      return;
   }

   container.innerHTML = filtered.map(sig => `
      <div class="signal-card ${sig.status === 'open' ? 'active' : ''}" data-id="${sig.id}">
         <div class="signal-card-header">
            <div style="display:flex;align-items:center;gap:0.5rem;">
               <span class="signal-symbol">${sig.symbol}</span>
               <span class="signal-direction ${sig.type}">${sig.type.toUpperCase()}</span>
            </div>
            <span class="signal-status-badge ${sig.status}">${sig.status.toUpperCase()}</span>
         </div>
         <div class="signal-levels">
            <div class="level">
               <div class="level-label">Entry</div>
               <div class="level-value entry">${formatPrice(sig.entry, sig.symbol)}</div>
            </div>
            <div class="level">
               <div class="level-label">SL</div>
               <div class="level-value sl">${formatPrice(sig.sl, sig.symbol)}</div>
            </div>
            <div class="level">
               <div class="level-label">TP</div>
               <div class="level-value tp">${formatPrice(sig.tp, sig.symbol)}</div>
            </div>
         </div>
         <div class="signal-card-meta">
            <div class="signal-confidence">
               <span>Conf: ${(sig.score * 100).toFixed(0)}%</span>
               <div class="score-bar"><div class="score-fill" style="width:${sig.score * 100}%"></div></div>
            </div>
            <span>${timeAgo(sig.timestamp)} · ${sig.timeframe}</span>
         </div>
      </div>
   `).join('');
}

function formatPrice(price, symbol) {
   if (!symbol || symbol.includes('/')) {
      const base = symbol ? symbol.split('/')[0] : '';
      if (base === 'BTC') return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (base === 'ETH') return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (price > 100) return price.toFixed(2);
      if (price > 10) return price.toFixed(4);
      return price.toFixed(5);
   }
   return price > 100 ? price.toFixed(2) : price.toFixed(4);
}

function timeAgo(timestamp) {
   const secs = Math.floor((Date.now() - timestamp) / 1000);
   if (secs < 60) return `${secs}s`;
   if (secs < 3600) return `${Math.floor(secs / 60)}m`;
   if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
   return `${Math.floor(secs / 86400)}d`;
}

/* ================================================
   TICKER
   ================================================ */
function initTicker() {
   const track = document.getElementById('tickerTrack');
   if (!track) return;

   const pairs = [
      { s: 'BTC/USDT', p: 67445.30, c: 2.34 },
      { s: 'ETH/USDT', p: 3421.45,  c: -1.28 },
      { s: 'EUR/USD',  p: 1.0867,   c: 0.15 },
      { s: 'GBP/USD',  p: 1.2682,   c: 0.42 },
      { s: 'USD/JPY',  p: 154.18,   c: -0.23 },
      { s: 'XAU/USD',  p: 2338.20,  c: 0.87 },
      { s: 'AAPL',     p: 189.45,   c: 1.12 },
      { s: 'TSLA',     p: 248.30,   c: -0.56 },
      { s: 'NVDA',     p: 875.30,   c: 3.45 },
      { s: 'NAS100',   p: 18542.50, c: 1.02 }
   ];

   const all = [...pairs, ...pairs]; // duplicate for seamless loop

   track.innerHTML = all.map(item => `
      <div class="ticker-item">
         <span class="ticker-symbol">${item.s}</span>
         <span class="ticker-price">${formatTickerPrice(item.p)}</span>
         <span class="ticker-change ${item.c >= 0 ? 'up' : 'down'}">
            ${item.c >= 0 ? '+' : ''}${item.c.toFixed(2)}%
         </span>
      </div>
   `).join('');
}

function formatTickerPrice(price) {
   if (price > 10000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
   if (price > 100) return price.toFixed(2);
   if (price > 1) return price.toFixed(4);
   return price.toFixed(5);
}

/* ================================================
   CHARTS
   ================================================ */
function initCharts() {
   // Hero chart
   const heroContainer = document.getElementById('heroChart');
   if (heroContainer) {
      const chart = LightweightCharts.createChart(heroContainer, {
         width: heroContainer.clientWidth,
         height: 480,
         layout: {
            background: { type: 'solid', color: '#131b2a' },
            textColor: '#8b9ab5'
         },
         grid: {
            vertLines: { color: '#1e2a3f' },
            horzLines: { color: '#1e2a3f' }
         },
         crosshair: {
            vertLine: { color: '#00d4aa', width: 1, style: 2 },
            horzLine: { color: '#00d4aa', width: 1, style: 2 }
         },
         timeScale: {
            borderColor: '#1e2a3f',
            timeVisible: true
         },
         rightPriceScale: { borderColor: '#1e2a3f' }
      });

      const candleData = generateCandleData(200, 67000, 1500);
      const candleSeries = chart.addCandlestickSeries({
         upColor: '#00d4aa', downColor: '#ff4757',
         borderUpColor: '#00d4aa', borderDownColor: '#ff4757',
         wickUpColor: '#00d4aa', wickDownColor: '#ff4757'
      });
      candleSeries.setData(candleData);

      const volumeSeries = chart.addHistogramSeries({
         color: '#26a69a', priceFormat: { type: 'volume' },
         priceScaleId: '', scaleMargins: { top: 0.85, bottom: 0 }
      });
      volumeSeries.setData(generateVolumeData(200));

      // EMAs
      chart.addLineSeries({ color: '#0ea5e9', lineWidth: 1, priceLineVisible: false })
           .setData(calculateEMA(candleData, 20));
      chart.addLineSeries({ color: '#8b5cf6', lineWidth: 1, priceLineVisible: false })
           .setData(calculateEMA(candleData, 50));

      window.addEventListener('resize', () => chart.applyOptions({ width: heroContainer.clientWidth }));
   }

   // Main chart
   const mainContainer = document.getElementById('mainChart');
   const loading = document.getElementById('chartLoading');
   if (mainContainer) {
      const chart = LightweightCharts.createChart(mainContainer, {
         width: mainContainer.clientWidth,
         height: 420,
         layout: {
            background: { type: 'solid', color: '#131b2a' },
            textColor: '#8b9ab5'
         },
         grid: {
            vertLines: { color: '#1e2a3f' },
            horzLines: { color: '#1e2a3f' }
         },
         crosshair: {
            vertLine: { color: '#00d4aa', width: 1, style: 2 },
            horzLine: { color: '#00d4aa', width: 1, style: 2 }
         },
         timeScale: {
            borderColor: '#1e2a3f',
            timeVisible: true
         },
         rightPriceScale: { borderColor: '#1e2a3f' }
      });

      state.charts.main = chart;
      state.charts.mainCandles = chart.addCandlestickSeries({
         upColor: '#00d4aa', downColor: '#ff4757',
         borderUpColor: '#00d4aa', borderDownColor: '#ff4757',
         wickUpColor: '#00d4aa', wickDownColor: '#ff4757'
      });
      state.charts.mainCandles.setData(generateCandleData(300, 67000, 1500));

      // SMC markers
      state.charts.mainCandles.setMarkers(generateSMCMarkers(generateCandleData(300, 67000, 1500)));

      // Support / Resistance lines
      const data = generateCandleData(300, 67000, 1500);
      const srSupport = chart.addLineSeries({
         color: '#00d4aa', lineWidth: 1,
         lineStyle: 2, priceLineVisible: false,
         axisLabelVisible: true, title: 'Support'
      });
      srSupport.setData(data.map(d => ({ time: d.time, value: 65000 })));

      const srResistance = chart.addLineSeries({
         color: '#ff4757', lineWidth: 1,
         lineStyle: 2, priceLineVisible: false,
         axisLabelVisible: true, title: 'Resistance'
      });
      srResistance.setData(data.map(d => ({ time: d.time, value: 69000 })));

      if (loading) loading.style.display = 'none';

      window.addEventListener('resize', () => chart.applyOptions({ width: mainContainer.clientWidth }));
   }

   // Equity chart
   const equityContainer = document.getElementById('equityChart');
   if (equityContainer) {
      const chart = LightweightCharts.createChart(equityContainer, {
         width: equityContainer.clientWidth,
         height: 160,
         layout: {
            background: { type: 'solid', color: '#151d2e' },
            textColor: '#8b9ab5'
         },
         grid: { vertLines: { visible: false }, horzLines: { color: '#1e2a3f' } },
         timeScale: { visible: false },
         rightPriceScale: { visible: false },
         crosshair: { mode: 0 }
      });

      chart.addAreaSeries({
         lineColor: '#00d4aa', topColor: 'rgba(0,212,170,0.3)',
         bottomColor: 'rgba(0,212,170,0)', lineWidth: 2
      }).setData(generateEquityCurve(90));
   }
}

function generateCandleData(count, basePrice, volatility) {
   const data = [];
   let time = Math.floor(Date.now() / 1000) - (count * 3600);
   let price = basePrice;
   for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.48) * volatility;
      const open = price, close = price + change;
      const high = Math.max(open, close) + Math.random() * volatility * 0.3;
      const low = Math.min(open, close) - Math.random() * volatility * 0.3;
      data.push({ time, open, high, low, close });
      price = close; time += 3600;
   }
   return data;
}

function generateVolumeData(count) {
   const data = [];
   const baseTime = Math.floor(Date.now() / 1000) - (count * 3600);
   for (let i = 0; i < count; i++) {
      data.push({
         time: baseTime + (i * 3600),
         value: Math.random() * 1000000 + 500000,
         color: Math.random() > 0.5 ? 'rgba(0,212,170,0.4)' : 'rgba(255,71,87,0.4)'
      });
   }
   return data;
}

function generateEquityCurve(days) {
   const data = [];
   let time = Math.floor(Date.now() / 1000) - (days * 86400);
   let equity = 45000;
   for (let i = 0; i < days; i++) {
      equity += (Math.random() - 0.42) * 800;
      data.push({ time, value: equity });
      time += 86400;
   }
   return data;
}

function calculateEMA(data, period) {
   const multiplier = 2 / (period + 1);
   let result = [];
   let avg = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
   data.forEach((d, i) => {
      avg = i < period - 1 ? null : i === period - 1 ? avg : (d.close - avg) * multiplier + avg;
      result.push({ time: d.time, value: avg });
   });
   return result;
}

function generateSMCMarkers(data) {
   const concepts = ['OB', 'FVG', 'BOS', 'Liq', 'Ind'];
   const colors = { OB: '#00d4aa', FVG: '#0ea5e9', BOS: '#8b5cf6', Liq: '#ffc107', Ind: '#ff4757' };
   const markers = [];
   for (let i = 20; i < data.length - 10; i += Math.floor(Math.random() * 15) + 8) {
      const c = concepts[Math.floor(Math.random() * concepts.length)];
      markers.push({
         time: data[i].time,
         position: data[i].close > data[i].open ? 'aboveBar' : 'belowBar',
         color: colors[c],
         shape: 'arrowUp',
         text: c[0]
      });
   }
   return markers;
}

/* ================================================
   TOOLBAR
   ================================================ */
function initToolbar() {
   // Timeframe buttons
   document.querySelectorAll('.toolbar-group .toolbar-btn[data-tf]').forEach(btn => {
      btn.addEventListener('click', () => {
         document.querySelectorAll('.toolbar-btn[data-tf]').forEach(b => b.classList.remove('active'));
         btn.classList.add('active');
         state.currentTimeframe = btn.dataset.tf;
         showToast(`Timeframe: ${btn.textContent}`, 'info');
      });
   });

   // Indicator buttons (toggle)
   document.querySelectorAll('.indicator-btn').forEach(btn => {
      btn.addEventListener('click', () => {
         btn.classList.toggle('active');
         showToast(`Indicator toggled`, 'info');
      });
   });

   // Symbol buttons
   document.querySelectorAll('.sym-btn').forEach(btn => {
      btn.addEventListener('click', () => {
         document.querySelectorAll('.sym-btn').forEach(b => b.classList.remove('active'));
         btn.classList.add('active');
         state.currentSymbol = btn.dataset.sym;
         const sym = state.symbols.find(s => s.id === btn.dataset.sym);
         if (sym) {
            document.getElementById('currentSymbolName').textContent = sym.ticker;
            document.getElementById('currentSymbolPrice').textContent = formatTickerPrice(sym.price);
            const changeEl = document.getElementById('currentSymbolChange');
            changeEl.textContent = `${sym.change >= 0 ? '+' : ''}${sym.change.toFixed(2)}%`;
            changeEl.className = `symbol-change ${sym.change >= 0 ? 'up' : 'down'}`;
         }
         showToast(`Switched to ${btn.dataset.sym}`, 'info');
      });
   });

   // Analytics period
   document.getElementById('analyticsPeriod')?.addEventListener('change', (e) => {
      showToast(`Analytics: ${e.target.options[e.target.selectedIndex].text}`, 'info');
   });
}

function toggleFullscreen() {
   if (!document.fullscreenElement) {
      document.getElementById('mainChart')?.parentElement?.requestFullscreen?.();
   } else {
      document.exitFullscreen?.();
   }
}

/* ================================================
   EVENT LISTENERS
   ================================================ */
function initEventListeners() {
   // Signal filters
   document.querySelectorAll('.signals-filters .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
         document.querySelectorAll('.signals-filters .filter-btn').forEach(b => b.classList.remove('active'));
         btn.classList.add('active');
         renderSignals(btn.dataset.filter);
      });
   });

   // Nav smooth scroll
   document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
         e.preventDefault();
         const target = document.querySelector(link.getAttribute('href'));
         if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
         }
      });
   });

   // Risk inputs
   ['riskPercent', 'maxDailyLoss'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', updateAccountDisplay);
   });
}

/* ================================================
   ACCOUNT / RISK
   ================================================ */
function updateAccountDisplay() {
   const el = id => document.getElementById(id);
   const a = state.account;

   if (el('accountBalance')) el('accountBalance').textContent = `$${a.balance.toLocaleString()}`;
   if (el('accountEquity')) el('accountEquity').textContent = `$${a.equity.toLocaleString()}`;
   if (el('currentDrawdown')) el('currentDrawdown').textContent = `-${a.dailyLoss.toFixed(2)}%`;

   const dailyRiskPct = (a.dailyLoss / a.maxDailyLoss * 100).toFixed(1);
   if (el('dailyRiskUsed')) el('dailyRiskUsed').textContent = `${dailyRiskPct}%`;
   if (el('dailyRiskFill')) el('dailyRiskFill').style.width = `${dailyRiskPct}%`;

   const posPct = (a.openPositions / a.maxPositions * 100).toFixed(0);
   if (el('openPositions')) el('openPositions').textContent = `${a.openPositions} / ${a.maxPositions}`;
   if (el('positionsFill')) el('positionsFill').style.width = `${posPct}%`;

   // Risk badge
   const badge = document.getElementById('riskBadge');
   if (badge) {
      badge.className = `risk-badge ${a.dailyLoss >= a.maxDailyLoss ? 'danger' : 'safe'}`;
      badge.textContent = a.dailyLoss >= a.maxDailyLoss ? 'LIMIT REACHED' : 'PROTECTED';
   }
}

function calculatePositionSize() {
   const account = parseFloat(document.getElementById('calcAccount')?.value) || 50000;
   const entry = parseFloat(document.getElementById('calcEntry')?.value);
   const sl = parseFloat(document.getElementById('calcSL')?.value);
   const risk = parseFloat(document.getElementById('calcRisk')?.value) || 1;

   if (!entry || !sl) {
      showToast('Enter entry and stop loss prices', 'warning');
      return;
   }

   const riskAmount = account * (risk / 100);
   const slDist = Math.abs(entry - sl);
   const lotSize = riskAmount / (slDist * 10);

   const result = document.getElementById('calcLotSize');
   if (result) result.textContent = lotSize.toFixed(2);

   showToast(`Lot size: ${lotSize.toFixed(2)} | Risk: $${riskAmount.toFixed(2)}`, 'success');
}

function runRiskCalculation() {
   const account = parseFloat(document.getElementById('modalAccount')?.value) || 50000;
   const entry = parseFloat(document.getElementById('modalEntry')?.value);
   const sl = parseFloat(document.getElementById('modalSL')?.value);
   const tp = parseFloat(document.getElementById('modalTP')?.value);
   const risk = parseFloat(document.getElementById('modalRisk')?.value) || 1;

   if (!entry || !sl || !tp) {
      showToast('Fill in all price fields', 'warning');
      return;
   }

   const riskAmt = account * (risk / 100);
   const rr = Math.abs(tp - entry) / Math.abs(entry - sl);
   const ev = (rr * 0.784) - (1 * 0.216);

   const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

   set('modalPositionSize', `${(riskAmt / Math.abs(entry - sl)).toFixed(2)} lots`);
   set('modalRiskAmount', `$${riskAmt.toFixed(2)}`);
   set('modalRewardAmount', `$${(riskAmt * rr).toFixed(2)}`);
   set('modalRR', `${rr.toFixed(2)}:1`);
   set('modalExpected', ev > 0 ? `+${(ev * 100).toFixed(1)}% EV` : `${(ev * 100).toFixed(1)}% EV`);
}

/* ================================================
   AUTH / MODALS
   ================================================ */
function openRiskModal() {
   document.getElementById('riskModal')?.classList.add('active');
}

function closeRiskModal() {
   document.getElementById('riskModal')?.classList.remove('active');
}

function openAuthModal() {
   document.getElementById('authModal')?.classList.add('active');
   showLogin();
}

function closeAuthModal() {
   document.getElementById('authModal')?.classList.remove('active');
}

function showLogin() {
   document.getElementById('authModalTitle').textContent = 'Client Portal';
   document.getElementById('loginView').classList.remove('hidden');
   document.getElementById('registerView').classList.add('hidden');
   document.getElementById('successView').classList.add('hidden');
}

function showRegister() {
   document.getElementById('authModalTitle').textContent = 'Create Account';
   document.getElementById('loginView').classList.add('hidden');
   document.getElementById('registerView').classList.remove('hidden');
   document.getElementById('successView').classList.add('hidden');
}

function showSuccess(name) {
   document.getElementById('authModalTitle').textContent = 'Success';
   document.getElementById('loginView').classList.add('hidden');
   document.getElementById('registerView').classList.add('hidden');
   document.getElementById('successView').classList.remove('hidden');
   const nameEl = document.getElementById('newUserName');
   if (nameEl) nameEl.textContent = name || 'Trader';
}

function togglePassword(inputId) {
   const input = document.getElementById(inputId);
   if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

function checkPasswordStrength() {
   const pw = document.getElementById('regPassword')?.value || '';
   const fill = document.getElementById('strengthFill');
   const text = document.getElementById('strengthText');

   if (!fill || !text) return;

   fill.className = 'strength-fill';
   if (pw.length < 4) { text.textContent = 'Too short'; }
   else if (pw.length < 8) { fill.classList.add('weak'); text.textContent = 'Weak'; text.style.color = 'var(--loss)'; }
   else if (pw.length < 12) { fill.classList.add('fair'); text.textContent = 'Fair'; text.style.color = 'var(--warning)'; }
   else { fill.classList.add('strong'); text.textContent = 'Strong'; text.style.color = 'var(--profit)'; }
}

function checkPasswordMatch() {
   const pw = document.getElementById('regPassword')?.value;
   const confirm = document.getElementById('regConfirmPassword')?.value;
   const indicator = document.getElementById('matchIndicator');

   if (!indicator) return;

   if (confirm.length > 0) {
      indicator.classList.remove('hidden');
      if (pw === confirm) {
         indicator.classList.add('match');
         indicator.textContent = '✓';
      } else {
         indicator.classList.remove('match');
         indicator.textContent = '✕';
      }
   } else {
      indicator.classList.add('hidden');
   }

   updateRegisterBtn();
}

function updateRegisterBtn() {
   const name = document.getElementById('regName')?.value?.trim();
   const email = document.getElementById('regEmail')?.value?.trim();
   const pw = document.getElementById('regPassword')?.value;
   const confirm = document.getElementById('regConfirmPassword')?.value;
   const terms = document.getElementById('agreeTerms')?.checked;
   const risk = document.getElementById('agreeRisk')?.checked;

   const btn = document.getElementById('registerBtn');
   if (!btn) return;

   const valid = name && email && pw?.length >= 8 && pw === confirm && terms && risk;
   btn.disabled = !valid;
}

function handleLogin() {
   const email = document.getElementById('loginEmail')?.value?.trim();
   const password = document.getElementById('loginPassword')?.value;
   const errorEl = document.getElementById('loginError');
   const errorText = document.getElementById('loginErrorText');

   if (!email || !password) {
      if (errorEl) errorEl.classList.remove('hidden');
      if (errorText) errorText.textContent = 'Please enter email and password';
      return;
   }

   // Demo: accept any login
   if (errorEl) errorEl.classList.add('hidden');
   showToast('Login successful! Redirecting...', 'success');
   setTimeout(() => closeAuthModal(), 800);
}

function handleRegister() {
   const name = document.getElementById('regName')?.value?.trim();
   const email = document.getElementById('regEmail')?.value?.trim();
   const pw = document.getElementById('regPassword')?.value;
   const confirm = document.getElementById('regConfirmPassword')?.value;
   const terms = document.getElementById('agreeTerms')?.checked;
   const risk = document.getElementById('agreeRisk')?.checked;

   if (!name || !email || !pw || pw !== confirm || !terms || !risk) {
      showToast('Please complete all fields correctly', 'error');
      return;
   }

   showToast('Account created successfully!', 'success');
   setTimeout(() => showSuccess(name), 500);
}

// Attach listeners to register form fields
document.addEventListener('DOMContentLoaded', () => {
   ['regName', 'regEmail', 'regPassword', 'regConfirmPassword', 'agreeTerms', 'agreeRisk'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateRegisterBtn);
      document.getElementById(id)?.addEventListener('change', updateRegisterBtn);
   });
});

/* ================================================
   TOAST
   ================================================ */
function showToast(message, type = 'success') {
   const container = document.getElementById('toastContainer');
   if (!container) return;

   const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
   const toast = document.createElement('div');
   toast.className = `toast ${type}`;
   toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
   `;

   container.appendChild(toast);
   setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
   }, 3500);
}

/* ================================================
   REAL-TIME UPDATES
   ================================================ */
function startRealTimeUpdates() {
   // Ticker live updates
   setInterval(() => {
      const track = document.getElementById('tickerTrack');
      if (!track) return;
      track.querySelectorAll('.ticker-item').forEach(item => {
         const priceEl = item.querySelector('.ticker-price');
         const changeEl = item.querySelector('.ticker-change');
         if (priceEl) {
            const p = parseFloat(priceEl.textContent.replace(/,/g, ''));
            const delta = (Math.random() - 0.5) * p * 0.001;
            priceEl.textContent = formatTickerPrice(p + delta);
         }
         if (changeEl) {
            const c = parseFloat(changeEl.textContent);
            changeEl.textContent = `${c >= 0 ? '+' : ''}${(c + (Math.random() - 0.5) * 0.05).toFixed(2)}%`;
         }
      });
   }, 3000);

   // Live signal price updates
   setInterval(() => {
      state.signals.forEach(sig => {
         if (sig.status === 'open') {
            sig.current += (Math.random() - 0.5) * sig.entry * 0.002;
         }
      });
      const activeFilter = document.querySelector('.signals-filters .filter-btn.active')?.dataset.filter || 'all';
      renderSignals(activeFilter);
   }, 5000);

   // Hero stats
   setInterval(() => {
      const els = ['totalSignals', 'winRate', 'avgRR', 'dailyReturn'];
      const vals = [
         `${247 + Math.floor(Math.random() * 3)}`,
         `${(78 + Math.random() * 2).toFixed(1)}%`,
         `${(2.2 + Math.random() * 0.4).toFixed(1)}:1`,
         `+${(3 + Math.random() * 2).toFixed(1)}%`
      ];
      els.forEach((id, i) => {
         const el = document.getElementById(id);
         if (el) el.textContent = vals[i];
      });
   }, 10000);
}

/* ================================================
   UTILS
   ================================================ */
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
