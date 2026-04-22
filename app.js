/* ================================================
   APEX SMC CAPITAL - Application Logic
   ================================================ */

const API_BASE = 'http://localhost:3001/api';

// Symbol mapping: display -> Binance API symbol
const SYMBOL_MAP = {
   'BTC/USDT': { binance: 'BTCUSDT', type: 'crypto' },
   'ETH/USDT': { binance: 'ETHUSDT', type: 'crypto' },
   'EUR/USD':  { binance: 'EURUSD',  type: 'forex'  },
   'GBP/USD':  { binance: 'GBPUSD',  type: 'forex'  },
   'USD/JPY':  { binance: 'USDJPY',  type: 'forex'  },
   'XAU/USD':  { binance: 'XAUUSD',  type: 'metal'  },
   'SOL/USDT': { binance: 'SOLUSDT', type: 'crypto' },
   'BNB/USDT': { binance: 'BNBUSDT', type: 'crypto' }
};

// Timeframe map for chart intervals
const TF_MAP = {
   '1':  '1m',  '5':  '5m',  '15': '15m',
   '30': '30m', '60': '1h',  '240': '4h',
   'D':  '1d',  'W':  '1w'
};

const state = {
   user: null,
   token: null,
   apiKey: null,
   symbols: [
      { ticker: 'BTC/USDT', id: 'BINANCE:BTCUSDT', price: 0,     change: 0    },
      { ticker: 'ETH/USDT', id: 'BINANCE:ETHUSDT', price: 0,     change: 0    },
      { ticker: 'EUR/USD',  id: 'BINANCE:EURUSD',  price: 0,     change: 0    },
      { ticker: 'GBP/USD',  id: 'BINANCE:GBPUSD',  price: 0,     change: 0    },
      { ticker: 'USD/JPY',  id: 'BINANCE:USDJPY',  price: 0,     change: 0    },
      { ticker: 'XAU/USD',  id: 'BINANCE:XAUUSD',  price: 0,     change: 0    },
      { ticker: 'SOL/USDT', id: 'BINANCE:SOLUSDT', price: 0,     change: 0    },
      { ticker: 'BNB/USDT', id: 'BINANCE:BNBUSDT', price: 0,     change: 0    }
   ],
   currentSymbol:  'BTC/USDT',
   currentBinance: 'BTCUSDT',
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
   charts: {},
   sseConnected: false,
   klineData: {},      // historical klines per symbol
   lastCandle: {},      // last candle per symbol for live update
   smcOverlays: []      // active SMC chart overlays (OB, FVG, BOS lines)
};

/* ================================================
   INIT
   ================================================ */
document.addEventListener('DOMContentLoaded', () => {
   initAuth();
   initSignals();
   initTicker();
   initMarketData();
   initSMC();
   initCharts();
   initToolbar();
   initEventListeners();
   startRealTimeUpdates();
   updateAccountDisplay();
   checkDashboardMode();
});

function checkDashboardMode() {
   const isDashboard = document.querySelector('.dashboard-page');
   if (isDashboard) {
      // Check for stored auth
      const token = localStorage.getItem('smc_token');
      const user = localStorage.getItem('smc_user');
      if (token && user) {
         state.token = token;
         state.user = JSON.parse(user);
         state.apiKey = localStorage.getItem('smc_apiKey');
         updateUserUI();
         fetchDashboardData();
         connectSSE();
      }
   }
}

function initAuth() {
   // Check stored auth
   const token = localStorage.getItem('smc_token');
   const user = localStorage.getItem('smc_user');
   if (token && user) {
      state.token = token;
      state.user = JSON.parse(user);
      state.apiKey = localStorage.getItem('smc_apiKey');
   }
}

/* ================================================
   API HELPERS
   ================================================ */
async function apiCall(endpoint, method = 'GET', body = null) {
   const headers = {
      'Content-Type': 'application/json'
   };
   
   if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
   }
   
   const options = {
      method,
      headers
   };
   
   if (body) {
      options.body = JSON.stringify(body);
   }
   
   try {
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      const data = await response.json();
      
      if (!response.ok) {
         if (response.status === 401 || response.status === 403) {
            logout();
         }
         throw new Error(data.error || 'API request failed');
      }
      
      return data;
   } catch (error) {
      console.error('API Error:', error);
      if (error.message !== 'API request failed') {
         showToast(error.message, 'error');
      }
      return null;
   }
}

/* ================================================
   AUTH
   ================================================ */
async function handleLogin() {
   const email = document.getElementById('loginEmail')?.value?.trim();
   const password = document.getElementById('loginPassword')?.value;
   const errorEl = document.getElementById('loginError');
   const errorText = document.getElementById('loginErrorText');

   if (!email || !password) {
      if (errorEl) errorEl.classList.remove('hidden');
      if (errorText) errorText.textContent = 'Please enter email and password';
      return;
   }

   try {
      const data = await apiCall('/auth/login', 'POST', { email, password });
      
      if (data && data.success) {
         state.token = data.token;
         state.user = data.user;
         state.apiKey = data.apiKey;
         
         localStorage.setItem('smc_token', data.token);
         localStorage.setItem('smc_user', JSON.stringify(data.user));
         if (data.apiKey) localStorage.setItem('smc_apiKey', data.apiKey);
         
         showToast('Login successful!', 'success');
         updateUserUI();
         
         setTimeout(() => {
            closeAuthModal();
            if (document.querySelector('.dashboard-page')) {
               fetchDashboardData();
               connectSSE();
            }
         }, 500);
      }
   } catch (error) {
      if (errorEl) errorEl.classList.remove('hidden');
      if (errorText) errorText.textContent = error.message;
   }
}

async function handleRegister() {
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

   try {
      const data = await apiCall('/auth/register', 'POST', { name, email, password: pw });
      
      if (data && data.success) {
         state.token = data.token;
         state.user = data.user;
         state.apiKey = data.apiKey;
         
         localStorage.setItem('smc_token', data.token);
         localStorage.setItem('smc_user', JSON.stringify(data.user));
         if (data.apiKey) localStorage.setItem('smc_apiKey', data.apiKey);
         
         showSuccess(name);
      }
   } catch (error) {
      showToast(error.message, 'error');
   }
}

function logout() {
   state.token = null;
   state.user = null;
   state.apiKey = null;
   localStorage.removeItem('smc_token');
   localStorage.removeItem('smc_user');
   localStorage.removeItem('smc_apiKey');
   
   showToast('Logged out successfully', 'info');
   updateUserUI();
   
   if (document.querySelector('.dashboard-page')) {
      window.location.href = 'index.html';
   }
}

function updateUserUI() {
   if (state.user) {
      const userNameEl = document.getElementById('userName');
      const userAvatarEl = document.getElementById('userAvatar');
      if (userNameEl) userNameEl.textContent = state.user.name;
      if (userAvatarEl) userAvatarEl.textContent = state.user.name.charAt(0).toUpperCase();
   }
}

/* ================================================
   DASHBOARD DATA
   ================================================ */
async function fetchDashboardData() {
   if (!state.token) return;
   
   try {
      // Fetch stats
      const stats = await apiCall('/dashboard/stats');
      if (stats && stats.success) {
         updateDashboardStats(stats.stats);
      }
      
      // Fetch signals
      const signals = await apiCall('/signals?limit=50');
      if (signals && signals.signals) {
         state.signals = signals.signals;
         renderSignals();
      }
      
      // Fetch performance
      const perf = await apiCall('/dashboard/performance?period=30');
      if (perf && perf.success) {
         updatePerformanceCharts(perf.performance);
      }
   } catch (error) {
      console.error('Dashboard fetch error:', error);
   }
}

function updateDashboardStats(stats) {
   if (!stats) return;
   
   // Account info
   if (stats.account) {
      if (document.getElementById('accountBalance')) {
         document.getElementById('accountBalance').textContent = 
            `$${stats.account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      }
      if (document.getElementById('accountEquity')) {
         document.getElementById('accountEquity').textContent = 
            `$${stats.account.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      }
      if (document.getElementById('dailyPnL')) {
         const pnl = stats.account.daily_pnl;
         document.getElementById('dailyPnL').textContent = 
            `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
         document.getElementById('dailyPnL').className = `stat-value ${pnl >= 0 ? 'profit' : 'loss'}`;
      }
      if (document.getElementById('accountBalance')) {
         state.account.balance = stats.account.balance;
         state.account.equity = stats.account.equity;
      }
   }
   
   // Trading info
   if (stats.trading) {
      if (document.getElementById('openPositionsCount')) {
         document.getElementById('openPositionsCount').textContent = 
            `${stats.trading.open_positions} / ${stats.trading.max_positions}`;
      }
      if (document.getElementById('winRateDisplay')) {
         document.getElementById('winRateDisplay').textContent = `${stats.trading.win_rate}%`;
      }
   }
   
   // Compliance
   if (stats.compliance) {
      const dailyLossPercent = parseFloat(stats.compliance.daily_loss_used);
      const dailyLossLimit = stats.compliance.daily_loss_limit;
      
      if (document.getElementById('dailyRiskUsed')) {
         document.getElementById('dailyRiskUsed').textContent = 
            `${dailyLossPercent.toFixed(1)}% of ${dailyLossLimit}%`;
      }
      if (document.getElementById('dailyRiskFill')) {
         const fillPercent = Math.min((dailyLossPercent / dailyLossLimit) * 100, 100);
         document.getElementById('dailyRiskFill').style.width = `${fillPercent}%`;
      }
      if (document.getElementById('riskBadge')) {
         const badge = document.getElementById('riskBadge');
         badge.className = `risk-badge ${stats.compliance.at_risk ? 'danger' : 'safe'}`;
         badge.textContent = stats.compliance.at_risk ? 'AT RISK' : 'PROTECTED';
      }
      if (document.getElementById('dailyLossValue')) {
         document.getElementById('dailyLossValue').textContent = `-${dailyLossPercent.toFixed(2)}%`;
         document.getElementById('dailyLossValue').className = 
            `risk-stat-value ${dailyLossPercent >= dailyLossLimit * 0.8 ? 'loss' : ''}`;
      }
   }
   
   // MT5 connection
   if (stats.mt5_connected !== undefined) {
      const indicator = document.getElementById('mt5Indicator');
      const statusEl = document.getElementById('mt5Broker');
      const btnEl = document.getElementById('mt5ConnectBtn');
      if (indicator) {
         indicator.className = `mt5-indicator ${stats.mt5_connected ? 'connected' : ''}`;
      }
      if (statusEl) {
         statusEl.textContent = stats.mt5_connected ? 'Connected' : 'Not Connected';
      }
      if (btnEl) {
         btnEl.innerHTML = stats.mt5_connected 
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg> Disconnect'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Connect MT5';
      }
   }
}

function updatePerformanceCharts(perf) {
   if (!perf || !perf.equity_curve) return;
   
   // Update equity chart
   const equityContainer = document.getElementById('equityChart');
   if (equityContainer && typeof LightweightCharts !== 'undefined') {
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
      
      const data = perf.equity_curve.map(d => ({
         time: d.date,
         value: d.equity
      }));
      
      chart.addAreaSeries({
         lineColor: '#00d4aa',
         topColor: 'rgba(0,212,170,0.3)',
         bottomColor: 'rgba(0,212,170,0)',
         lineWidth: 2
      }).setData(data);
   }
   
   // Update metrics
   if (perf.metrics) {
      if (document.getElementById('totalPnL')) {
         const pnl = perf.metrics.total_pnl;
         document.getElementById('totalPnL').textContent = 
            `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
         document.getElementById('totalPnL').className = `metric-value ${pnl >= 0 ? 'profit' : 'loss'}`;
      }
      if (document.getElementById('analyticsWinRate')) {
         document.getElementById('analyticsWinRate').textContent = `${perf.metrics.win_rate}%`;
      }
      if (document.getElementById('profitFactor')) {
         document.getElementById('profitFactor').textContent = perf.metrics.profit_factor;
      }
      if (document.getElementById('maxDrawdown')) {
         document.getElementById('maxDrawdown').textContent = `-${perf.metrics.max_drawdown}%`;
      }
      if (document.getElementById('avgTrade')) {
         document.getElementById('avgTrade').textContent = `$${perf.metrics.avg_trade}`;
      }
   }
}

/* ================================================
   SSE CONNECTION
   ================================================ */
function connectSSE() {
   if (!state.token || state.sseConnected) return;
   
   const eventSource = new EventSource(`${API_BASE}/signals/live`, {
      headers: { Authorization: `Bearer ${state.token}` }
   });
   
   eventSource.addEventListener('signal', (event) => {
      try {
         const signal = JSON.parse(event.data);
         handleNewSignal(signal);
      } catch (e) {
         console.error('SSE parse error:', e);
      }
   });
   
   eventSource.addEventListener('connected', () => {
      state.sseConnected = true;
      console.log('[SSE] Connected to signal stream');
   });
   
   eventSource.onerror = () => {
      state.sseConnected = false;
      setTimeout(connectSSE, 5000);
   };
}

function handleNewSignal(signal) {
   // Add to state and render
   state.signals.unshift(signal);
   if (state.signals.length > 100) state.signals.pop();
   
   const activeFilter = document.querySelector('.signals-filters .filter-btn.active')?.dataset.filter || 'all';
   renderSignals(activeFilter);
   
   // Update open signals badge
   const openCount = state.signals.filter(s => s.status === 'open').length;
   const badge = document.getElementById('openSignalsBadge');
   if (badge) badge.textContent = openCount;
   
   showToast(`New signal: ${signal.symbol} ${signal.type}`, 'info');
}

/* ================================================
   MT5 CONNECTION
   ================================================ */
async function connectMT5() {
   const broker = document.getElementById('mt5BrokerName')?.value;
   const login = document.getElementById('mt5Login')?.value;
   const password = document.getElementById('mt5Password')?.value;
   const server = document.getElementById('mt5Server')?.value;
   
   if (!broker || !login || !password || !server) {
      showToast('Please fill all MT5 fields', 'warning');
      return;
   }
   
   try {
      const data = await apiCall('/auth/connect-mt5', 'POST', { broker, login, password, server });
      
      if (data && data.success) {
         showToast('MT5 connected successfully!', 'success');
         closeMT5Modal();
         fetchDashboardData();
      }
   } catch (error) {
      showToast('Failed to connect MT5', 'error');
   }
}

/* ================================================
   SIGNALS
   ================================================ */
function initSignals() {
   // Demo signals for initial display
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
               <div class="level-value entry">${formatPrice(sig.entry_price || sig.entry, sig.symbol)}</div>
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
               <span>Conf: ${((sig.score || sig.confidence) * 100).toFixed(0)}%</span>
               <div class="score-bar"><div class="score-fill" style="width:${(sig.score || sig.confidence) * 100}%"></div></div>
            </div>
            <span>${timeAgo(sig.timestamp || sig.created_at)} · ${sig.timeframe || 'H1'}</span>
         </div>
      </div>
   `).join('');
}

function formatPrice(price, symbol) {
   if (!price) return '—';
   if (!symbol || symbol.includes('/')) {
      if (price > 10000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (price > 100) return price.toFixed(2);
      if (price > 10) return price.toFixed(4);
      return price.toFixed(5);
   }
   return price > 100 ? price.toFixed(2) : price.toFixed(4);
}

function timeAgo(timestamp) {
   if (!timestamp) return '—';
   const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
   const secs = Math.floor((Date.now() - ts) / 1000);
   if (secs < 60) return `${secs}s`;
   if (secs < 3600) return `${Math.floor(secs / 60)}m`;
   if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
   return `${Math.floor(secs / 86400)}d`;
}

/* ================================================
   MARKET DATA INITIALIZATION
   ================================================ */
function initMarketData() {
   // Wait for window.marketData to be available, then connect
   if (window.marketData) {
      window.marketData.connect();
      
      // Subscribe to ticker updates for live prices
      window.marketData.subscribe(event => {
         if (event.type === 'ticker') {
            updateTickerFromMarketData(event.data);
         }
         if (event.type === 'kline') {
            updateChartFromKline(event.data);
         }
      });
   }
}

/* ================================================
   TICKER - Real-time from Binance WebSocket
   ================================================ */
function initTicker() {
   const track = document.getElementById('tickerTrack');
   if (!track) return;

   // Initial ticker with placeholder data - will be updated via WebSocket
   const pairs = state.symbols.map(s => ({
      s: s.ticker,
      p: s.price || '—',
      c: s.change || 0
   }));

   const all = [...pairs, ...pairs];

   track.innerHTML = all.map(item => `
      <div class="ticker-item" data-symbol="${item.s}">
         <span class="ticker-symbol">${item.s}</span>
         <span class="ticker-price">${typeof item.p === 'number' ? formatTickerPrice(item.p) : item.p}</span>
         <span class="ticker-change ${item.c >= 0 ? 'up' : 'down'}">
            ${item.c >= 0 ? '+' : ''}${typeof item.c === 'number' ? item.c.toFixed(2) : '0.00'}%
         </span>
      </div>
   `).join('');
}

function updateTickerFromMarketData(ticker) {
   // Update the ticker item with real price data from Binance
   const track = document.getElementById('tickerTrack');
   if (!track) return;
   
   // Find ticker item by symbol
   let symbolKey = ticker.symbol;
   
   // Handle different symbol formats
   const tickerItem = track.querySelector(`.ticker-item[data-symbol="${symbolKey}"]`);
   if (tickerItem) {
      const priceEl = tickerItem.querySelector('.ticker-price');
      const changeEl = tickerItem.querySelector('.ticker-change');
      
      if (priceEl) {
         priceEl.textContent = formatTickerPrice(ticker.price);
      }
      if (changeEl) {
         changeEl.textContent = `${ticker.change >= 0 ? '+' : ''}${ticker.change.toFixed(2)}%`;
         changeEl.className = `ticker-change ${ticker.change >= 0 ? 'up' : 'down'}`;
      }
   }
   
   // Also update state.symbols for other parts of the app
   const sym = state.symbols.find(s => s.ticker === symbolKey);
   if (sym) {
      sym.price = ticker.price;
      sym.change = ticker.change;
   }
}

function updateTickerUI(ticker) {
   updateTickerFromMarketData(ticker);
}

function formatTickerPrice(price) {
   if (price > 10000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
   if (price > 100) return price.toFixed(2);
   if (price > 1) return price.toFixed(4);
   return price.toFixed(5);
}

/* ================================================
   KLINE LOADING - Real historical data from Binance
   ================================================ */
async function loadKlines(symbol, interval = '1h', limit = 300) {
   const key = symbol + interval;
   
   try {
      // Use marketData.fetchKlines if available, otherwise fetch directly
      let klines;
      if (window.marketData && window.marketData.fetchKlines) {
         klines = await window.marketData.fetchKlines(symbol, interval, limit);
      } else {
         // Direct fetch fallback
         const res = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
         );
         const data = await res.json();
         klines = data.map(k => ({
            time: Math.floor(k[0] / 1000),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
         }));
      }
      
      state.klineData[key] = klines;
      return klines;
   } catch (e) {
      console.error('[loadKlines] Error loading klines:', e);
      return [];
   }
}

/* ================================================
   EMA CALCULATION
   ================================================ */
function calculateEMA(data, period) {
   if (!data || data.length < period) return [];
   
   const multiplier = 2 / (period + 1);
   const result = [];
   let ema = data.slice(0, period).reduce((sum, d) => sum + d.close, 0) / period;
   
   data.forEach((d, i) => {
      if (i < period - 1) {
         result.push({ time: d.time, value: null });
      } else if (i === period - 1) {
         result.push({ time: d.time, value: ema });
      } else {
         ema = (d.close - ema) * multiplier + ema;
         result.push({ time: d.time, value: ema });
      }
   });
   
   return result.filter(d => d.value !== null);
}

/* ================================================
   CHARTS - Real Binance data
   ================================================ */
async function initCharts() {
   // Hero chart
   const heroContainer = document.getElementById('heroChart');
   if (heroContainer && typeof LightweightCharts !== 'undefined') {
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

      const candleSeries = chart.addCandlestickSeries({
         upColor: '#00d4aa', downColor: '#ff4757',
         borderUpColor: '#00d4aa', borderDownColor: '#ff4757',
         wickUpColor: '#00d4aa', wickDownColor: '#ff4757'
      });

      const volumeSeries = chart.addHistogramSeries({
         color: '#26a69a', priceFormat: { type: 'volume' },
         priceScaleId: '', scaleMargins: { top: 0.85, bottom: 0 }
      });

      const ema20Series = chart.addLineSeries({ color: '#0ea5e9', lineWidth: 1, priceLineVisible: false });
      const ema50Series = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 1, priceLineVisible: false });

      // Store references
      state.charts.hero = chart;
      state.charts.heroCandles = candleSeries;
      state.charts.heroVolume = volumeSeries;
      state.charts.heroEma20 = ema20Series;
      state.charts.heroEma50 = ema50Series;

      // Load real data for hero chart
      const heroSymbol = state.currentBinance || 'BTCUSDT';
      const tf = TF_MAP[state.currentTimeframe] || '1h';
      
      try {
         const klines = await loadKlines(heroSymbol, tf, 200);
         if (klines && klines.length > 0) {
            candleSeries.setData(klines);
            
            // Volume data
            const volumeData = klines.map(k => ({
               time: k.time,
               value: k.volume,
               color: k.close >= k.open ? 'rgba(0,212,170,0.4)' : 'rgba(255,71,87,0.4)'
            }));
            volumeSeries.setData(volumeData);
            
            // EMA lines
            const ema20 = calculateEMA(klines, 20);
            const ema50 = calculateEMA(klines, 50);
            ema20Series.setData(ema20);
            ema50Series.setData(ema50);
            
            console.log(`[Charts] Loaded ${klines.length} candles for hero chart (${heroSymbol})`);
         }
      } catch (e) {
         console.error('[Charts] Error loading hero chart data:', e);
      }

      window.addEventListener('resize', () => chart.applyOptions({ width: heroContainer.clientWidth }));
   }

   // Main chart
   const mainContainer = document.getElementById('mainChart');
   const loading = document.getElementById('chartLoading');
   if (mainContainer && typeof LightweightCharts !== 'undefined') {
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

      const candleSeries = chart.addCandlestickSeries({
         upColor: '#00d4aa', downColor: '#ff4757',
         borderUpColor: '#00d4aa', borderDownColor: '#ff4757',
         wickUpColor: '#00d4aa', wickDownColor: '#ff4757'
      });

      const volumeSeries = chart.addHistogramSeries({
         color: '#26a69a', priceFormat: { type: 'volume' },
         priceScaleId: '', scaleMargins: { top: 0.85, bottom: 0 }
      });

      const ema20Series = chart.addLineSeries({ color: '#0ea5e9', lineWidth: 1, priceLineVisible: false });
      const ema50Series = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 1, priceLineVisible: false });

      state.charts.main = chart;
      state.charts.mainCandles = candleSeries;
      state.charts.mainVolume = volumeSeries;
      state.charts.mainEma20 = ema20Series;
      state.charts.mainEma50 = ema50Series;

      // Load real data for main chart
      const mainSymbol = state.currentBinance || 'BTCUSDT';
      const tf = TF_MAP[state.currentTimeframe] || '1h';
      
      try {
         const klines = await loadKlines(mainSymbol, tf, 300);
         if (klines && klines.length > 0) {
            candleSeries.setData(klines);
            
            // Volume data
            const volumeData = klines.map(k => ({
               time: k.time,
               value: k.volume,
               color: k.close >= k.open ? 'rgba(0,212,170,0.4)' : 'rgba(255,71,87,0.4)'
            }));
            volumeSeries.setData(volumeData);
            
            // EMA lines
            const ema20 = calculateEMA(klines, 20);
            const ema50 = calculateEMA(klines, 50);
            ema20Series.setData(ema20);
            ema50Series.setData(ema50);
            
            // Store kline data for SMC analysis
            const key = mainSymbol + tf;
            state.klineData = klines;
            
            // Run SMC analysis on loaded data
            runSMCAnalysis();
            
            console.log(`[Charts] Loaded ${klines.length} candles for main chart (${mainSymbol})`);
         }
      } catch (e) {
         console.error('[Charts] Error loading main chart data:', e);
      }

      if (loading) loading.style.display = 'none';

      window.addEventListener('resize', () => chart.applyOptions({ width: mainContainer.clientWidth }));
   }

   // Equity chart - keep using dashboard data (not from Binance)
   const equityContainer = document.getElementById('equityChart');
   if (equityContainer && typeof LightweightCharts !== 'undefined') {
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
      }).setData([]);
   }
}

/* ================================================
   REAL-TIME CHART UPDATES from Binance WebSocket
   ================================================ */
function updateChartFromKline(klineData) {
   // Update the last candle with real-time data
   if (!klineData) return;
   
   const { symbol, kline } = klineData;
   const binanceSymbol = symbol.replace('/', '');
   const currentBinance = state.currentBinance || 'BTCUSDT';
   
   // Only update if this is the current symbol
   if (binanceSymbol !== currentBinance) return;
   
   // Update hero chart
   if (state.charts.heroCandles && kline) {
      try {
         state.charts.heroCandles.update({
            time: Math.floor(kline.t / 1000),
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c)
         });
      } catch (e) {
         // Ignore update errors (out of bounds, etc.)
      }
   }
   
   // Update main chart
   if (state.charts.mainCandles && kline) {
      try {
         state.charts.mainCandles.update({
            time: Math.floor(kline.t / 1000),
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c)
         });
      } catch (e) {
         // Ignore update errors
      }
   }
}

/* ================================================
   TOOLBAR
   ================================================ */
function initToolbar() {
   document.querySelectorAll('.toolbar-group .toolbar-btn[data-tf]').forEach(btn => {
      btn.addEventListener('click', async () => {
         document.querySelectorAll('.toolbar-btn[data-tf]').forEach(b => b.classList.remove('active'));
         btn.classList.add('active');
         state.currentTimeframe = btn.dataset.tf;
         
         const tf = TF_MAP[state.currentTimeframe] || '1h';
         const symbol = state.currentBinance || 'BTCUSDT';
         
         showToast(`Loading ${btn.textContent} chart...`, 'info');
         
         try {
            const klines = await loadKlines(symbol, tf, 300);
            if (klines && klines.length > 0 && state.charts.mainCandles) {
               state.charts.mainCandles.setData(klines);
               
               // Update volume
               const volumeData = klines.map(k => ({
                  time: k.time,
                  value: k.volume,
                  color: k.close >= k.open ? 'rgba(0,212,170,0.4)' : 'rgba(255,71,87,0.4)'
               }));
               if (state.charts.mainVolume) {
                  state.charts.mainVolume.setData(volumeData);
               }
               
               // Update EMAs
               const ema20 = calculateEMA(klines, 20);
               const ema50 = calculateEMA(klines, 50);
               if (state.charts.mainEma20) state.charts.mainEma20.setData(ema20);
               if (state.charts.mainEma50) state.charts.mainEma50.setData(ema50);
               
               console.log(`[Charts] Updated main chart with ${klines.length} candles (${tf})`);
            }
         } catch (e) {
            console.error('[Charts] Error changing timeframe:', e);
            showToast('Failed to load chart data', 'error');
         }
      });
   });

   document.querySelectorAll('.indicator-btn').forEach(btn => {
      btn.addEventListener('click', () => {
         btn.classList.toggle('active');
      });
   });

   document.querySelectorAll('.sym-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
         document.querySelectorAll('.sym-btn').forEach(b => b.classList.remove('active'));
         btn.classList.add('active');
         state.currentSymbol = btn.dataset.sym;
         
         const sym = state.symbols.find(s => s.id === btn.dataset.sym);
         if (sym) {
            const symInfo = SYMBOL_MAP[sym.ticker];
            state.currentBinance = symInfo ? symInfo.binance : sym.ticker.replace('/', '');
            
            document.getElementById('currentSymbolName').textContent = sym.ticker;
            document.getElementById('currentSymbolPrice').textContent = formatTickerPrice(sym.price);
            const changeEl = document.getElementById('currentSymbolChange');
            changeEl.textContent = `${sym.change >= 0 ? '+' : ''}${sym.change.toFixed(2)}%`;
            changeEl.className = `symbol-change ${sym.change >= 0 ? 'up' : 'down'}`;
            
            // Reload chart for new symbol
            const tf = TF_MAP[state.currentTimeframe] || '1h';
            try {
               const klines = await loadKlines(state.currentBinance, tf, 300);
               if (klines && klines.length > 0 && state.charts.mainCandles) {
                  state.charts.mainCandles.setData(klines);
                  
                  const volumeData = klines.map(k => ({
                     time: k.time,
                     value: k.volume,
                     color: k.close >= k.open ? 'rgba(0,212,170,0.4)' : 'rgba(255,71,87,0.4)'
                  }));
                  if (state.charts.mainVolume) {
                     state.charts.mainVolume.setData(volumeData);
                  }
                  
                  const ema20 = calculateEMA(klines, 20);
                  const ema50 = calculateEMA(klines, 50);
                  if (state.charts.mainEma20) state.charts.mainEma20.setData(ema20);
                  if (state.charts.mainEma50) state.charts.mainEma50.setData(ema50);
               }
            } catch (e) {
               console.error('[Charts] Error loading symbol chart:', e);
            }
         }
      });
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
   document.querySelectorAll('.signals-filters .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
         document.querySelectorAll('.signals-filters .filter-btn').forEach(b => b.classList.remove('active'));
         btn.classList.add('active');
         renderSignals(btn.dataset.filter);
      });
   });

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
}

/* ================================================
   USER MENU
   ================================================ */
function toggleUserMenu() {
   const dropdown = document.getElementById('userDropdown');
   if (dropdown) dropdown.classList.toggle('show');
}

document.addEventListener('click', (e) => {
   const userMenu = document.getElementById('userMenu');
   if (userMenu && !userMenu.contains(e.target)) {
      const dropdown = document.getElementById('userDropdown');
      if (dropdown) dropdown.classList.remove('show');
   }
});

/* ================================================
   MODALS
   ================================================ */
function openRiskModal() { document.getElementById('riskModal')?.classList.add('active'); }
function closeRiskModal() { document.getElementById('riskModal')?.classList.remove('active'); }

function openAuthModal() {
   document.getElementById('authModal')?.classList.add('active');
   showLogin();
}

function closeAuthModal() { document.getElementById('authModal')?.classList.remove('active'); }

function openMT5Modal() { document.getElementById('mt5Modal')?.classList.add('active'); }
function closeMT5Modal() { document.getElementById('mt5Modal')?.classList.remove('active'); }

function openSettingsModal() { document.getElementById('settingsModal')?.classList.add('active'); }
function closeSettingsModal() { document.getElementById('settingsModal')?.classList.remove('active'); }

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
   document.getElementById('newUserName').textContent = name || 'Trader';
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
      if (pw === confirm) { indicator.classList.add('match'); indicator.textContent = '✓'; }
      else { indicator.classList.remove('match'); indicator.textContent = '✕'; }
   } else { indicator.classList.add('hidden'); }

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
   btn.disabled = !(name && email && pw?.length >= 8 && pw === confirm && terms && risk);
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

   document.getElementById('modalPositionSize').textContent = `${(riskAmt / Math.abs(entry - sl)).toFixed(2)} lots`;
   document.getElementById('modalRiskAmount').textContent = `$${riskAmt.toFixed(2)}`;
   document.getElementById('modalRewardAmount').textContent = `$${(riskAmt * rr).toFixed(2)}`;
   document.getElementById('modalRR').textContent = `${rr.toFixed(2)}:1`;
   document.getElementById('modalExpected').textContent = ev > 0 ? `+${(ev * 100).toFixed(1)}% EV` : `${(ev * 100).toFixed(1)}% EV`;
}

function saveProfile() {
   const name = document.getElementById('settingsName')?.value?.trim();
   if (name && state.user) {
      state.user.name = name;
      localStorage.setItem('smc_user', JSON.stringify(state.user));
      updateUserUI();
      showToast('Profile saved', 'success');
   }
}

function copyApiKey() {
   if (state.apiKey) {
      navigator.clipboard.writeText(state.apiKey);
      showToast('API key copied!', 'success');
   }
}

function cancelSubscription() {
   showToast('Subscription cancellation requested', 'info');
}

document.addEventListener('DOMContentLoaded', () => {
   ['regName', 'regEmail', 'regPassword', 'regConfirmPassword', 'agreeTerms', 'agreeRisk'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateRegisterBtn);
      document.getElementById(id)?.addEventListener('change', updateRegisterBtn);
   });

   // Settings tabs
   document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
         document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
         document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
         tab.classList.add('active');
         document.getElementById(tab.dataset.tab + 'Panel')?.classList.add('active');
      });
   });
});

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

   const badge = document.getElementById('riskBadge');
   if (badge) {
      badge.className = `risk-badge ${a.dailyLoss >= a.maxDailyLoss ? 'danger' : 'safe'}`;
      badge.textContent = a.dailyLoss >= a.maxDailyLoss ? 'LIMIT REACHED' : 'PROTECTED';
   }
}

/* ================================================
   TOAST
   ================================================ */
function showToast(message, type = 'success') {
   const container = document.getElementById('toastContainer');
   if (!container) return;

   const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
   const toast = document.createElement('div');
   toast.className = `toast ${type}`;
   toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-message">${message}</span>`;

   container.appendChild(toast);
   setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
   }, 3500);
}

/* ================================================
   REAL-TIME UPDATES - Signal P&L only (ticker is WebSocket-driven)
   ================================================ */
function startRealTimeUpdates() {
   // REMOVED: Fake ticker interval - now driven by WebSocket via window.marketData
   
   // Signal P&L update interval - uses real signal data from state.signals
   setInterval(() => {
      if (state.signals.length === 0) return;
      
      // Update current prices for open signals (would come from WebSocket in production)
      // For now, we just re-render to show any changes
      const activeFilter = document.querySelector('.signals-filters .filter-btn.active')?.dataset.filter || 'all';
      renderSignals(activeFilter);
   }, 5000);

   // Dashboard metrics refresh
   setInterval(() => {
      // Only refresh dashboard metrics if on dashboard page
      if (document.querySelector('.dashboard-page') && state.token) {
         fetchDashboardData();
      }
   }, 30000);
}

/* ================================================
   SMC ANALYSIS
   ================================================ */
let smc = null;

function initSMC() {
   smc = new SMC_Analysis();
}

function toggleSMCPanel() {
   const panel = document.getElementById('smcPanel');
   if (!panel) return;
   panel.classList.toggle('collapsed');
}

function updateSMCPanel(results) {
   if (!results) return;


   // Market context badge
   const ctxEl = document.getElementById('smcContext');
   if (ctxEl) {
      ctxEl.className = 'context-badge ' + results.context.toLowerCase().replace('_', '-');
      ctxEl.textContent = results.context.replace('_', ' ');
   }


   // Order Blocks
   const obList = document.getElementById('obList');
   if (obList) {
      obList.innerHTML = results.orderBlocks.slice(-3).map(ob => `
         <div class="smc-item ${ob.type}">
            <span class="smc-item-price">${ob.type === 'bullish' ? '▲' : '▼'} $${ob.price.toFixed(2)}</span>
            <span class="smc-item-strength">${ob.strength}%</span>
         </div>
      `).join('');
   }


   // FVGs
   const fvgList = document.getElementById('fvgList');
   if (fvgList) {
      fvgList.innerHTML = results.fvgs.slice(-3).map(fvg => `
         <div class="smc-item ${fvg.type}">
            <span class="smc-item-price">${fvg.type === 'bullish' ? '▲' : '▼'} $${fvg.price.toFixed(2)}</span>
            <span class="smc-item-strength">${fvg.depthPercent}% gap</span>
         </div>
      `).join('');
   }

   // BOS
   const bosList = document.getElementById('bosList');
   if (bosList) {
      bosList.innerHTML = results.bos.slice(-2).map(bos => `
         <div class="smc-item ${bos.type}">
            <span class="smc-item-price">${bos.type === 'bullish' ? '▲' : '▼'} $${bos.brokenLevel.toFixed(2)}</span>
            <span class="smc-item-strength">${bos.momentum}</span>
         </div>
      `).join('');
   }

   // Liquidity
   const liqList = document.getElementById('liqList');
   if (liqList) {
      liqList.innerHTML = results.liquidity.slice(-3).map(liq => `
         <div class="smc-item ${liq.type}">
            <span class="smc-item-price">${liq.type === 'bullish' ? '▲' : '▼'} $${liq.price.toFixed(2)}</span>
            <span class="smc-item-strength">${liq.strength}%</span>
         </div>
      `).join('');
   }

   // Confidence score
   const scoreEl = document.getElementById('smcScore');
   if (scoreEl) {
      const confidence = results.signals.length > 0
         ? results.signals[results.signals.length - 1].confidence
         : '--';
      scoreEl.textContent = typeof confidence === 'number' ? confidence + '%' : '--';
   }


   // Add trade signal overlays to chart
   if (results.signals.length > 0) {
      const latestSignal = results.signals[results.signals.length - 1];
      addSignalOverlay(latestSignal);
   }
}

function addSignalOverlay(signal) {
   const chart = state.charts.main || state.charts.hero;
   if (!chart) return;

   // Check if we already added this signal (avoid duplicates)
   const signalKey = signal.timestamp + '_' + signal.direction;
   if (state.signalOverlays && state.signalOverlays.has(signalKey)) return;
   if (!state.signalOverlays) state.signalOverlays = new Set();
   state.signalOverlays.add(signalKey);


   const timestamp = signal.timestamp || Math.floor(Date.now() / 1000);
   const timeEnd = timestamp + 14400; // 4 hours later


   // Entry line
   try {
      const entryLine = chart.addLineSeries({
         color: signal.direction > 0 ? '#00d4aa' : '#ff4757',
         lineWidth: 2,
         lineStyle: 0,
         priceLineVisible: true,
         title: `ENTRY ${signal.direction > 0 ? 'LONG' : 'SHORT'}`
      });
      entryLine.setData([
         { time: timestamp, value: signal.entryPrice },
         { time: timeEnd, value: signal.entryPrice }
      ]);

      // SL line
      const slLine = chart.addLineSeries({
         color: '#ff4757',
         lineWidth: 1,
         lineStyle: 2,
         priceLineVisible: true,
         title: 'SL'
      });
      slLine.setData([
         { time: timestamp, value: signal.stopLoss },
         { time: timeEnd, value: signal.stopLoss }
      ]);


      // TP line
      const tpLine = chart.addLineSeries({
         color: '#0ea5e9',
         lineWidth: 1,
         lineStyle: 2,
         priceLineVisible: true,
         title: 'TP'
      });
      tpLine.setData([
         { time: timestamp, value: signal.takeProfit },
         { time: timeEnd, value: signal.takeProfit }
      ]);

      // Mark entry point
      const markerSeries = chart.addMarkersSeries([{
         time: timestamp,
         color: signal.direction > 0 ? '#00d4aa' : '#ff4757',
         shape: signal.direction > 0 ? 'arrowUp' : 'arrowDown',
         text: '📍'
      }]);
   } catch (e) {
      console.warn('[SMC Overlay] Could not add overlay:', e.message);
   }
}

async function runSMCAnalysis() {
   if (!smc || !state.klineData || state.klineData.length < 20) return;


   const results = smc.analyze(state.klineData);
   updateSMCPanel(results);
}

/* ================================================
   UTILS
   ================================================ */
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
