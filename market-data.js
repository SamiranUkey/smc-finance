/* ================================================
   MARKET DATA - Real-Time from Binance WebSocket
   ================================================ */

class MarketData {
   constructor() {
      this.subscribers = [];
      this.priceCache = {};
      this.klineCache = {};
      this.ws = null;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this reconnectDelay = 3000;
      this.forexInterval = null;
      this.forexCache = {};
      
      // Stream format: symbol@kline_1m, symbol@ticker, etc.
      // Combined streams: /stream?streams=symbol1@ticker/symbol2@ticker
   }
   
   /* ================================================
      CONNECT TO BINANCE WEBSOCKET
      ================================================ */
   connect() {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
      
      const streams = [
         'btcusdt@ticker', 'ethusdt@ticker', 'eurusdt@ticker',
         'gbpusdt@ticker', 'usdjpy@ticker', 'SOLUSDT@ticker',
         'bnbusdt@ticker', 'adausdt@ticker', 'dogeusdt@ticker'
      ].join('/');
      
      const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
         console.log('[MarketData] WebSocket connected to Binance');
         this.reconnectAttempts = 0;
         this.notify({ type: 'connected' });
         
         // Also start forex polling (Binance doesn't have forex majors)
         this.startForexPolling();
      };
      
      this.ws.onmessage = (event) => {
         try {
            const msg = JSON.parse(event.data);
            const data = msg.data;
            
            if (!data || !data.s) return;
            
            const symbol = data.s; // e.g. 'BTCUSDT'
            const ticker = {
               symbol: this.formatSymbol(symbol),
               price: parseFloat(data.c),      // close price (current)
               change: parseFloat(data.P),     // percent change
               high: parseFloat(data.h),       // 24h high
               low: parseFloat(data.l),        // 24h low
               volume: parseFloat(data.v),     // 24h volume
               bid: parseFloat(data.b),        // best bid
               ask: parseFloat(data.a),        // best ask
               timestamp: data.E
            };
            
            this.priceCache[symbol] = ticker;
            this.notify({ type: 'ticker', data: ticker });
            
         } catch (e) {
            console.error('[MarketData] Parse error:', e);
         }
      };
      
      this.ws.onerror = (error) => {
         console.warn('[MarketData] WebSocket error:', error);
      };
      
      this.ws.onclose = () => {
         console.warn('[MarketData] WebSocket closed');
         this.notify({ type: 'disconnected' });
         this.attemptReconnect();
      };
   }
   
   attemptReconnect() {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
         console.error('[MarketData] Max reconnect attempts reached');
         return;
      }
      
      this.reconnectAttempts++;
      console.log(`[MarketData] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
         this.ws = null;
         this.connect();
      }, this.reconnectDelay);
   }
   
   disconnect() {
      if (this.ws) {
         this.ws.close();
         this.ws = null;
      }
      if (this.forexInterval) {
         clearInterval(this.forexInterval);
         this.forexInterval = null;
      }
   }
   
   formatSymbol(symbol) {
      // BTCUSDT -> BTC/USDT
      if (symbol.endsWith('USDT')) {
         return symbol.replace('USDT', '/USDT');
      }
      if (symbol.endsWith('USD')) {
         return symbol.replace('USD', '/USD');
      }
      // EURUSD, GBPUSD, USDJPY etc
      const bases = ['EUR', 'GBP', 'USD', 'AUD', 'NZD', 'CAD', 'CHF', 'JPY'];
      for (const base of bases) {
         if (symbol.startsWith(base)) {
            const quote = symbol.replace(base, '');
            return `${base}/${quote}`;
         }
      }
      return symbol;
   }
   
   /* ================================================
      FOREX POLLING (via frankfurter.app - free, no key)
      ================================================ */
   startForexPolling() {
      this.fetchForexRates();
      this.forexInterval = setInterval(() => this.fetchForexRates(), 5000);
   }
   
   async fetchForexRates() {
      try {
         const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CAD,AUD,CHF');
         const data = await res.json();
         
         const rates = data.rates;
         const usdRate = 1; // base is USD
         
         const forexPairs = [
            { symbol: 'EUR/USD', price: rates.EUR },
            { symbol: 'GBP/USD', price: rates.GBP },
            { symbol: 'USD/JPY', price: rates.JPY },
            { symbol: 'USD/CAD', price: rates.CAD },
            { symbol: 'AUD/USD', price: rates.AUD },
            { symbol: 'USD/CHF', price: rates.CHF }
         ];
         
         forexPairs.forEach(pair => {
            this.forexCache[pair.symbol] = {
               symbol: pair.symbol,
               price: pair.price,
               change: 0, // frankfurter doesn't provide daily change
               high: pair.price * 1.005,
               low: pair.price * 0.995,
               volume: 0,
               bid: pair.price * 0.9998,
               ask: pair.price * 1.0002,
               timestamp: Date.now()
            };
            
            this.notify({ type: 'ticker', data: this.forexCache[pair.symbol] });
         });
         
      } catch (e) {
         console.error('[MarketData] Forex fetch error:', e);
      }
   }
   
   /* ================================================
      KLINE DATA FOR CHARTS (via Binance REST)
      ================================================ */
   async fetchKlines(symbol, interval = '1h', limit = 300) {
      const binanceSymbol = symbol.replace('/', '').replace('BTC', 'BTC');
      
      try {
         const res = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`
         );
         const data = await res.json();
         
         return data.map(k => ({
            time: Math.floor(k[0] / 1000), // unix seconds for lightweight-charts
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
         }));
      } catch (e) {
         console.error('[MarketData] Kline fetch error:', e);
         return [];
      }
   }
   
   /* ================================================
      SUBSCRIPTION
      ================================================ */
   subscribe(callback) {
      this.subscribers.push(callback);
      return () => {
         this.subscribers = this.subscribers.filter(cb => cb !== callback);
      };
   }
   
   notify(event) {
      this.subscribers.forEach(cb => cb(event));
   }
   
   /* ================================================
      GETTERS
      ================================================ */
   getPrice(symbol) {
      const normalized = symbol.replace('/', '').replace('USDT', 'USDT');
      return this.priceCache[normalized] || null;
   }
   
   getAllPrices() {
      return { ...this.priceCache, ...this.forexCache };
   }
}

// Singleton instance
const marketData = new MarketData();

// Export for use in app.js
window.marketData = marketData;
