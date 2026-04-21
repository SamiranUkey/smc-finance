/* ================================================
   APEX SMC CAPITAL - Application Logic
   ================================================ */

// ================================================
// GLOBALS & STATE
// ================================================
const state = {
   symbols: ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT', 'BINANCE:EURUSD', 'BINANCE:GBPUSD', 
             'BINANCE:USDJPY', 'BINANCE:GOLD', 'NASDAQ:AAPL', 'NYSE:TSLA'],
   currentSymbol: 'BINANCE:BTCUSDT',
   currentTimeframe: '60',
   signals: [],
   positions: [],
   account: {
      balance: 50000,
      equity: 51847.32,
      dailyLoss: 0,
      maxDailyLoss: 5,
      riskPercent: 1,
      openPositions: 3,
      maxPositions: 5
   },
   charts: {},
   indicators: {}
};

// ================================================
// INITIALIZATION
// ================================================
document.addEventListener('DOMContentLoaded', () => {
   initializeSignals();
   initializeCharts();
   initializeTicker();
   initializeEventListeners();
   startRealTimeUpdates();
});

// ================================================
// SIGNAL DATA (Demo - would be API-driven in production)
// ================================================
function initializeSignals() {
   state.signals = [
      {
         id: 1,
         symbol: 'BTC/USDT',
         type: 'long',
         status: 'open',
         entry: 67234.50,
         sl: 65890.00,
         tp: 69500.00,
         current: 67445.30,
         score: 0.82,
         timestamp: Date.now() - 3600000,
         timeframe: 'H1',
         concepts: { ob: true, fvg: true, bos: true, choch: false, liq: true, induc: false }
      },
      {
         id: 2,
         symbol: 'ETH/USDT',
         type: 'short',
         status: 'open',
         entry: 3456.78,
         sl: 3520.00,
         tp: 3320.00,
         current: 3421.45,
         score: 0.76,
         timestamp: Date.now() - 7200000,
         timeframe: 'H4',
         concepts: { ob: true, fvg: false, bos: true, choch: true, liq: true, induc: false }
      },
      {
         id: 3,
         symbol: 'EUR/USD',
         type: 'long',
         status: 'tp',
         entry: 1.0865,
         sl: 1.0810,
         tp: 1.0950,
         current: 1.0952,
         score: 0.89,
         timestamp: Date.now() - 14400000,
         timeframe: 'M15',
         concepts: { ob: true, fvg: true, bos: true, choch: false, liq: false, induc: true }
      },
      {
         id: 4,
         symbol: 'XAU/USD',
         type: 'short',
         status: 'open',
         entry: 2345.60,
         sl: 2375.00,
         tp: 2285.00,
         current: 2338.20,
         score: 0.71,
         timestamp: Date.now() - 1800000,
         timeframe: 'H1',
         concepts: { ob: false, fvg: true, bos: true, choch: false, liq: true, induc: true }
      },
      {
         id: 5,
         symbol: 'GBP/USD',
         type: 'long',
         status: 'sl',
         entry: 1.2678,
         sl: 1.2620,
         tp: 1.2800,
         current: 1.2615,
         score: 0.65,
         timestamp: Date.now() - 28800000,
         timeframe: 'H1',
         concepts: { ob: true, fvg: false, bos: false, choch: true, liq: false, induc: true }
      },
      {
         id: 6,
         symbol: 'USD/JPY',
         type: 'short',
         status: 'open',
         entry: 154.320,
         sl: 154.850,
         tp: 153.400,
         current: 154.180,
         score: 0.78,
         timestamp: Date.now() - 5400000,
         timeframe: 'M5',
         concepts: { ob: true, fvg: true, bos: false, choch: true, liq: true, induc: false }
      },
      {
         id: 7,
         symbol: 'TSLA',
         type: 'long',
         status: 'open',
         entry: 245.60,
         sl: 238.50,
         tp: 260.00,
         current: 248.30,
         score: 0.74,
         timestamp: Date.now() - 900000,
         timeframe: 'M15',
         concepts: { ob: true, fvg: true, bos: true, choch: false, liq: false, induc: true }
      },
      {
         id: 8,
         symbol: 'AAPL',
         type: 'short',
         status: 'closed',
         entry: 189.45,
         sl: 191.20,
         tp: 185.00,
         current: 185.20,
         score: 0.81,
         timestamp: Date.now() - 86400000,
         timeframe: 'H1',
         concepts: { ob: true, fvg: true, bos: true, choch: true, liq: true, induc: false }
      }
   ];
   
   renderSignals();
}

// ================================================
// CHART INITIALIZATION (Lightweight Charts)
// ================================================
function initializeCharts() {
   // Hero chart
   const heroContainer = document.getElementById('heroChart');
   if (heroContainer) {
      state.charts.hero = LightweightCharts.createChart(heroContainer, {
         width: heroContainer.clientWidth,
         height: 500,
         layout: {
            background: { type: 'solid', color: '#141c28' },
            textColor: '#94a3b8'
         },
         grid: {
            vertLines: { color: '#1e293b' },
            horzLines: { color: '#1e293b' }
         },
         crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: { color: '#00d4aa', width: 1, style: 2 },
            horzLine: { color: '#00d4aa', width: 1, style: 2 }
         },
         timeScale: {
            borderColor: '#1e293b',
            timeVisible: true
         },
         rightPriceScale: {
            borderColor: '#1e293b'
         }
      });
      
      // Generate demo candlestick data
      const candleData = generateCandleData(200, 67000, 1500);
      const volumeData = generateVolumeData(200);
      
      const candleSeries = state.charts.hero.addCandlestickSeries({
         upColor: '#00d4aa',
         downColor: '#ff4757',
         borderUpColor: '#00d4aa',
         borderDownColor: '#ff4757',
         wickUpColor: '#00d4aa',
         wickDownColor: '#ff4757'
      });
      candleSeries.setData(candleData);
      
      const volumeSeries = state.charts.hero.addHistogramSeries({
         color: '#26a69a',
         priceFormat: { type: 'volume' },
         priceScaleId: '',
         scaleMargins: { top: 0.85, bottom: 0 }
      });
      volumeSeries.setData(volumeData);
      
      // Add EMA overlays
      const ema20 = calculateEMA(candleData, 20);
      const ema50 = calculateEMA(candleData, 50);
      
      state.charts.hero.addLineSeries({
         color: '#0ea5e9',
         lineWidth: 1,
         priceLineVisible: false
      }).setData(ema20);
      
      state.charts.hero.addLineSeries({
         color: '#8b5cf6',
         lineWidth: 1,
         priceLineVisible: false
      }).setData(ema50);
      
      // Handle resize
      window.addEventListener('resize', () => {
         if (state.charts.hero) {
            state.charts.hero.applyOptions({ width: heroContainer.clientWidth });
         }
      });
   }
   
   // Main chart
   const mainContainer = document.getElementById('mainChart');
   if (mainContainer) {
      state.charts.main = LightweightCharts.createChart(mainContainer, {
         width: mainContainer.clientWidth,
         height: 450,
         layout: {
            background: { type: 'solid', color: '#141c28' },
            textColor: '#94a3b8'
         },
         grid: {
            vertLines: { color: '#1e293b' },
            horzLines: { color: '#1e293b' }
         },
         crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal
         },
         timeScale: {
            borderColor: '#1e293b',
            timeVisible: true
         },
         rightPriceScale: {
            borderColor: '#1e293b'
         }
      });
      
      const candleData = generateCandleData(300, 67000, 1500);
      const candleSeries = state.charts.main.addCandlestickSeries({
         upColor: '#00d4aa',
         downColor: '#ff4757',
         borderUpColor: '#00d4aa',
         borderDownColor: '#ff4757',
         wickUpColor: '#00d4aa',
         wickDownColor: '#ff4757'
      });
      candleSeries.setData(candleData);
      
      // Add SMC pattern markers
      const markers = generateSMCMarkers(candleData);
      candleSeries.setMarkers(markers);
      
      // Resistance/support lines
      const supportLine = {
         price: 65000,
         color: '#00d4aa',
         lineWidth: 1,
         lineStyle: LightweightCharts.LineStyle.Dashed,
         axisLabelVisible: true,
         title: 'Support'
      };
      const resistanceLine = {
         price: 69000,
         color: '#ff4757',
         lineWidth: 1,
         lineStyle: LightweightCharts.LineStyle.Dashed,
         axisLabelVisible: true,
         title: 'Resistance'
      };
      state.charts.main.addLineSeries(supportLine).setData([
         { time: candleData[0].time, value: 65000 },
         { time: candleData[candleData.length-1].time, value: 65000 }
      ]);
      state.charts.main.addLineSeries(resistanceLine).setData([
         { time: candleData[0].time, value: 69000 },
         { time: candleData[candleData.length-1].time, value: 69000 }
      ]);
      
      window.addEventListener('resize', () => {
         if (state.charts.main) {
            state.charts.main.applyOptions({ width: mainContainer.clientWidth });
         }
      });
   }
   
   // Equity chart
   const equityContainer = document.getElementById('equityChart');
   if (equityContainer) {
      state.charts.equity = LightweightCharts.createChart(equityContainer, {
         width: equityContainer.clientWidth,
         height: 200,
         layout: {
            background: { type: 'solid', color: '#1a2332' },
            textColor: '#94a3b8'
         },
         grid: {
            vertLines: { visible: false },
            horzLines: { color: '#1e293b' }
         },
         timeScale: { visible: false },
         rightPriceScale: { visible: false },
         crosshair: { mode: LightweightCharts.CrosshairMode.Hidden }
      });
      
      const equityData = generateEquityCurve(90);
      const equitySeries = state.charts.equity.addAreaSeries({
         lineColor: '#00d4aa',
         topColor: 'rgba(0, 212, 170, 0.4)',
         bottomColor: 'rgba(0, 212, 170, 0.0)',
         lineWidth: 2
      });
      equitySeries.setData(equityData);
   }
}

// ================================================
// DATA GENERATORS
// ================================================
function generateCandleData(count, basePrice, volatility) {
   const data = [];
   let time = Math.floor(Date.now() / 1000) - (count * 3600);
   let price = basePrice;
   
   for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.48) * volatility;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * (volatility * 0.3);
      const low = Math.min(open, close) - Math.random() * (volatility * 0.3);
      
      data.push({
         time: time,
         open: open,
         high: high,
         low: low,
         close: close
      });
      
      price = close;
      time += 3600; // Hour candles
   }
   
   return data;
}

function generateVolumeData(count) {
   const data = [];
   for (let i = 0; i < count; i++) {
      data.push({
         time: Math.floor(Date.now() / 1000) - ((count - i) * 3600),
         value: Math.random() * 1000000 + 500000,
         color: Math.random() > 0.5 ? 'rgba(0, 212, 170, 0.5)' : 'rgba(255, 71, 87, 0.5)'
      });
   }
   return data;
}

function generateEquityCurve(days) {
   const data = [];
   let time = Math.floor(Date.now() / 1000) - (days * 86400);
   let equity = 45000;
   
   for (let i = 0; i < days; i++) {
      const change = (Math.random() - 0.42) * 800; // Slight positive bias
      equity += change;
      
      data.push({
         time: time,
         value: equity
      });
      
      time += 86400;
   }
   
   return data;
}

function calculateEMA(data, period) {
   const ema = [];
   const multiplier = 2 / (period + 1);
   let sum = 0;
   
   for (let i = 0; i < period && i < data.length; i++) {
      sum += data[i].close;
   }
   let avg = sum / period;
   
   for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
         ema.push({ time: data[i].time, value: null });
      } else if (i === period - 1) {
         ema.push({ time: data[i].time, value: avg });
      } else {
         avg = (data[i].close - avg) * multiplier + avg;
         ema.push({ time: data[i].time, value: avg });
      }
   }
   
   return ema;
}

function generateSMCMarkers(candleData) {
   const markers = [];
   const concepts = ['Order Block', 'FVG', 'BOS', 'Liquidity Sweep', 'Inducement'];
   const colors = {
      'Order Block': '#00d4aa',
      'FVG': '#0ea5e9',
      'BOS': '#8b5cf6',
      'Liquidity Sweep': '#ffc107',
      'Inducement': '#ff4757'
   };
   
   // Place markers randomly on some candles
   for (let i = 20; i < candleData.length - 10; i += Math.floor(Math.random() * 15) + 10) {
      const concept = concepts[Math.floor(Math.random() * concepts.length)];
      markers.push({
         time: candleData[i].time,
         position: candleData[i].close > candleData[i].open ? 'aboveBar' : 'belowBar',
         color: colors[concept],
         shape: 'arrowUp',
         text: concept.charAt(0)
      });
   }
   
   return markers;
}

// ================================================
// TICKER
// ================================================
function initializeTicker() {
   const tickerTrack = document.getElementById('tickerTrack');
   if (!tickerTrack) return;
   
   const tickerData = [
      { symbol: 'BTC/USDT', price: 67445.30, change: 2.34 },
      { symbol: 'ETH/USDT', price: 3421.45, change: -1.28 },
      { symbol: 'EUR/USD', price: 1.0867, change: 0.15 },
      { symbol: 'GBP/USD', price: 1.2682, change: 0.42 },
      { symbol: 'USD/JPY', price: 154.18, change: -0.23 },
      { symbol: 'XAU/USD', price: 2338.20, change: 0.87 },
      { symbol: 'AAPL', price: 189.45, change: 1.12 },
      { symbol: 'TSLA', price: 248.30, change: -0.56 },
      { symbol: 'NVDA', price: 875.30, change: 3.45 },
      { symbol: 'NAS100', price: 18542.50, change: 1.02 }
   ];
   
   // Duplicate for seamless loop
   const allData = [...tickerData, ...tickerData];
   
   tickerTrack.innerHTML = allData.map(item => `
      <div class="ticker-item">
         <span class="ticker-symbol">${item.symbol}</span>
         <span class="ticker-price">${formatPrice(item.price)}</span>
         <span class="ticker-change ${item.change >= 0 ? 'up' : 'down'}">
            ${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%
         </span>
      </div>
   `).join('');
}

function formatPrice(price) {
   if (price > 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
   if (price > 1) return price.toFixed(4);
   return price.toFixed(5);
}

// ================================================
// SIGNALS RENDERING
// ================================================
function renderSignals(filter = 'all') {
   const container = document.getElementById('signalsList');
   if (!container) return;
   
   let filtered = state.signals;
   if (filter === 'long') filtered = state.signals.filter(s => s.type === 'long');
   else if (filter === 'short') filtered = state.signals.filter(s => s.type === 'short');
   else if (filter === 'closed') filtered = state.signals.filter(s => s.status === 'closed' || s.status === 'tp' || s.status === 'sl');
   
   container.innerHTML = filtered.map(signal => `
      <div class="signal-card ${signal.status === 'open' ? 'active' : ''}" data-id="${signal.id}">
         <div class="signal-header">
            <div>
               <span class="signal-symbol">${signal.symbol}</span>
               <span class="signal-direction ${signal.type}">${signal.type.toUpperCase()}</span>
               ${signal.status !== 'open' ? `<span class="signal-status ${signal.status}">${signal.status.toUpperCase()}</span>` : ''}
            </div>
            <span class="signal-time">${formatTimeAgo(signal.timestamp)}</span>
         </div>
         <div class="signal-levels">
            <div class="level">
               <div class="level-label">Entry</div>
               <div class="level-value entry">${formatSignalPrice(signal.entry, signal.symbol)}</div>
            </div>
            <div class="level">
               <div class="level-label">Stop Loss</div>
               <div class="level-value sl">${formatSignalPrice(signal.sl, signal.symbol)}</div>
            </div>
            <div class="level">
               <div class="level-label">Take Profit</div>
               <div class="level-value tp">${formatSignalPrice(signal.tp, signal.symbol)}</div>
            </div>
         </div>
         <div class="signal-meta">
            <div class="signal-score">
               <span>Confidence</span>
               <div class="score-bar">
                  <div class="score-fill" style="width: ${signal.score * 100}%"></div>
               </div>
               <span>${(signal.score * 100).toFixed(0)}%</span>
            </div>
            <span>${signal.timeframe}</span>
         </div>
         ${signal.concepts ? `
         <div class="signal-concepts">
            ${Object.entries(signal.concepts).filter(([k, v]) => v).map(([concept]) => 
               `<span class="concept-tag ${concept}">${concept.toUpperCase()}</span>`
            ).join('')}
         </div>
         ` : ''}
      </div>
   `).join('');
}

function formatSignalPrice(price, symbol) {
   if (symbol.includes('/')) {
      const [base] = symbol.split('/');
      if (base === 'BTC' || base === 'ETH') return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return price.toFixed(5);
   }
   if (price > 100) return price.toFixed(2);
   if (price > 10) return price.toFixed(4);
   return price.toFixed(5);
}

function formatTimeAgo(timestamp) {
   const seconds = Math.floor((Date.now() - timestamp) / 1000);
   if (seconds < 60) return `${seconds}s ago`;
   if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
   if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
   return `${Math.floor(seconds / 86400)}d ago`;
}

// ================================================
// RISK CALCULATOR
// ================================================
function calculatePositionSize() {
   const account = parseFloat(document.getElementById('calcAccount').value) || 50000;
   const entry = parseFloat(document.getElementById('calcEntry').value);
   const sl = parseFloat(document.getElementById('calcSL').value);
   const risk = parseFloat(document.getElementById('calcRisk').value) || 1;
   
   if (!entry || !sl) {
      showToast('Please enter entry and stop loss prices', 'warning');
      return;
   }
   
   const riskAmount = account * (risk / 100);
   const slDistance = Math.abs(entry - sl);
   const pipValue = slDistance;
   
   // Simplified lot size calculation (varies by asset class)
   let lotSize = riskAmount / (slDistance * 10); // Rough approximation
   
   document.getElementById('calcLotSize').textContent = lotSize.toFixed(2);
   
   showToast(`Position size: ${lotSize.toFixed(2)} lots. Risk: $${riskAmount.toFixed(2)}`, 'success');
}

function runRiskCalculation() {
   const account = parseFloat(document.getElementById('modalAccount').value) || 50000;
   const entry = parseFloat(document.getElementById('modalEntry').value);
   const sl = parseFloat(document.getElementById('modalSL').value);
   const tp = parseFloat(document.getElementById('modalTP').value);
   const risk = parseFloat(document.getElementById('modalRisk').value) || 1;
   
   if (!entry || !sl || !tp) {
      showToast('Please fill in all price fields', 'warning');
      return;
   }
   
   const riskAmount = account * (risk / 100);
   const rewardAmount = account * (Math.abs(tp - entry) / entry) * (account / account);
   const rr = Math.abs(tp - entry) / Math.abs(entry - sl);
   
   const expectedValue = (rr * (78.4 / 100)) - (1 * (21.6 / 100)); // Based on win rate
   
   document.getElementById('modalPositionSize').textContent = `${(riskAmount / Math.abs(entry - sl)).toFixed(2)} lots`;
   document.getElementById('modalRiskAmount').textContent = `$${riskAmount.toFixed(2)}`;
   document.getElementById('modalRewardAmount').textContent = `$${rewardAmount.toFixed(2)}`;
   document.getElementById('modalRR').textContent = `${rr.toFixed(2)}:1`;
   document.getElementById('modalExpected').textContent = expectedValue > 0 ? 
      `+${(expectedValue * 100).toFixed(1)}% EV` : `${(expectedValue * 100).toFixed(1)}% EV`;
}

// ================================================
// EVENT LISTENERS
// ================================================
function initializeEventListeners() {
   // Signal filters
   document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
         document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
         e.target.classList.add('active');
         renderSignals(e.target.dataset.filter);
      });
   });
   
   // Auth tabs
   document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
         document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
         e.target.classList.add('active');
         
         const tabName = e.target.dataset.tab;
         document.getElementById('loginForm').classList.toggle('hidden', tabName !== 'login');
         document.getElementById('registerForm').classList.toggle('hidden', tabName !== 'register');
      });
   });
   
   // Nav smooth scroll
   document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
         const target = e.target.getAttribute('href');
         if (target.startsWith('#')) {
            e.preventDefault();
            document.querySelector(target).scrollIntoView({ behavior: 'smooth' });
         }
      });
   });
   
   // Risk calculator inputs
   ['calcAccount', 'calcEntry', 'calcSL', 'calcRisk'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', calculatePositionSize);
   });
}

// ================================================
// MODAL FUNCTIONS
// ================================================
function openRiskModal() {
   document.getElementById('riskModal').classList.add('active');
}

function closeRiskModal() {
   document.getElementById('riskModal').classList.remove('active');
}

function openAuthModal() {
   document.getElementById('authModal').classList.add('active');
}

function closeAuthModal() {
   document.getElementById('authModal').classList.remove('active');
}

// ================================================
// TOAST NOTIFICATIONS
// ================================================
function showToast(message, type = 'success') {
   const container = document.getElementById('toastContainer');
   const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
   
   const toast = document.createElement('div');
   toast.className = `toast ${type}`;
   toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <div class="toast-content">
         <span class="toast-message">${message}</span>
      </div>
   `;
   
   container.appendChild(toast);
   
   setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
   }, 4000);
}

// ================================================
// REAL-TIME UPDATES
// ================================================
function startRealTimeUpdates() {
   // Update ticker prices every 3 seconds
   setInterval(() => {
      const tickerTrack = document.getElementById('tickerTrack');
      if (tickerTrack) {
         const items = tickerTrack.querySelectorAll('.ticker-item');
         items.forEach(item => {
            const priceEl = item.querySelector('.ticker-price');
            const changeEl = item.querySelector('.ticker-change');
            if (priceEl) {
               const currentPrice = parseFloat(priceEl.textContent.replace(/,/g, ''));
               const change = (Math.random() - 0.5) * currentPrice * 0.001;
               const newPrice = currentPrice + change;
               priceEl.textContent = formatPrice(newPrice);
            }
            if (changeEl) {
               const currentChange = parseFloat(changeEl.textContent);
               changeEl.textContent = `${currentChange >= 0 ? '+' : ''}${(currentChange + (Math.random() - 0.5) * 0.1).toFixed(2)}%`;
            }
         });
      }
   }, 3000);
   
   // Update signal prices every 5 seconds
   setInterval(() => {
      state.signals.forEach(signal => {
         if (signal.status === 'open') {
            const move = (Math.random() - 0.5) * signal.entry * 0.002;
            signal.current += move;
         }
      });
      renderSignals(document.querySelector('.filter-btn.active')?.dataset.filter || 'all');
   }, 5000);
   
   // Update hero stats periodically
   setInterval(() => {
      const signals = 247 + Math.floor(Math.random() * 3);
      const winRate = (78 + Math.random() * 2).toFixed(1);
      const avgRR = (2.2 + Math.random() * 0.4).toFixed(1);
      const dailyReturn = (3 + Math.random() * 2).toFixed(1);
      
      document.getElementById('totalSignals').textContent = signals;
      document.getElementById('winRate').textContent = `${winRate}%`;
      document.getElementById('avgRR').textContent = `${avgRR}:1`;
      document.getElementById('dailyReturn').textContent = `+${dailyReturn}%`;
   }, 10000);
}

// ================================================
// SYMBOL/TIMEFRAME CHANGES
// ================================================
function changeSymbol(symbol) {
   state.currentSymbol = symbol;
   showToast(`Chart changed to ${symbol}`, 'info');
   // In production, would fetch new data and update chart
}

function changeTimeframe(tf) {
   state.currentTimeframe = tf;
   showToast(`Timeframe changed to ${tf}`, 'info');
   // In production, would fetch new data and update chart
}

// ================================================
// UTILITY FUNCTIONS
// ================================================
function clamp(value, min, max) {
   return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
   return a + (b - a) * t;
}
