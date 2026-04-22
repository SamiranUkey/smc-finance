/* ================================================
   MARKET DATA - Real-Time from Binance WebSocket + REST
   ================================================ */

class MarketData {
   constructor() {
      this.subscribers = [];
      this.priceCache = {};
      this.klineCache = {};
      this.ws = null;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 10;
      this.reconnectDelay = 5000;
      this.forexInterval = null;
      this.forcePollInterval = null;
      this.forexCache = {};
   }
   
   connect() {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
      
      const symbols = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'eurusdt', 'gbpusdt', 'usdjpy', 'paxgusdt'];
      const streams = [];
      
      symbols.forEach(s => {
         streams.push(`${s}@ticker`);
         streams.push(`${s}@kline_1m`);
      });
      
      const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams.join('/')}`;
      console.log('[MarketData] Connecting to Binance WebSocket...', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
         console.log('[MarketData] ✅ WebSocket Connected');
         this.reconnectAttempts = 0;
         this.notify({ type: 'connected' });
         this.startForexPolling();
         this.startForcePolling();
      };
      
      this.ws.onmessage = (event) => {
         try {
            const msg = JSON.parse(event.data);
            const stream = msg.stream;
            const data = msg.data;
            
            if (!data) return;
            
            if (stream.includes('@ticker')) {
               const symbol = data.s; 
               const ticker = {
                  symbol: this.formatSymbol(symbol),
                  price: parseFloat(data.c),
                  change: parseFloat(data.P),
                  high: parseFloat(data.h),
                  low: parseFloat(data.l),
                  volume: parseFloat(data.v),
                  bid: parseFloat(data.b),
                  ask: parseFloat(data.a),
                  timestamp: data.E
               };
               this.priceCache[symbol] = ticker;
               this.notify({ type: 'ticker', data: ticker });
            } 
            else if (stream.includes('@kline')) {
               const kline = {
                  symbol: this.formatSymbol(data.s),
                  kline: {
                     t: data.t,
                     o: data.o,
                     h: data.h,
                     l: data.l,
                     c: data.c,
                     v: data.v,
                     x: data.x
                  }
               };
               this.notify({ type: 'kline', data: kline });
            }
         } catch (e) {
            console.error('[MarketData] WebSocket Parse Error:', e);
         }
      };
      
      this.ws.onerror = (error) => {
         console.error('[MarketData] WebSocket Error:', error);
      };
      
      this.ws.onclose = (event) => {
         console.warn(`[MarketData] WebSocket Closed (Code: ${event.code}). Attempting reconnect...`);
         this.notify({ type: 'disconnected' });
         this.attemptReconnect();
      };
   }
   
   attemptReconnect() {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
         console.error('[MarketData] Max reconnect attempts reached. Please refresh page.');
         return;
      }
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.reconnectDelay);
   }
   
   disconnect() {
      if (this.ws) this.ws.close();
      if (this.forexInterval) clearInterval(this.forexInterval);
      if (this.forcePollInterval) clearInterval(this.forcePollInterval);
   }
   
   formatSymbol(symbol) {
      if (!symbol) return 'UNKNOWN';
      const s = symbol.toUpperCase();
      if (s === 'PAXGUSDT') return 'XAU/USD';
      if (s.endsWith('USDT')) return s.replace('USDT', '/USDT');
      if (s.endsWith('USD')) return s.replace('USD', '/USD');
      
      const bases = ['EUR', 'GBP', 'USD', 'AUD', 'NZD', 'CAD', 'CHF', 'JPY'];
      for (const base of bases) {
         if (s.startsWith(base)) {
            const quote = s.replace(base, '');
            return `${base}/${quote}`;
         }
      }
      return s;
   }
   
   // Force-poll all prices every 5 seconds as a fallback for the WebSocket
   startForcePolling() {
      this.forcePollInterval = setInterval(async () => {
         console.log('[MarketData] Force-polling latest prices...');
         const symbols = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'eurusdt', 'gbpusdt', 'usdjpy', 'paxgusdt'];
         
         try {
            const res = await fetch(`https://api.binance.com/api/v3/ticker/price`);
            const data = await res.json();
            
            data.forEach(item => {
               const symbol = item.symbol.toLowerCase();
               if (symbols.includes(symbol)) {
                  const ticker = {
                     symbol: this.formatSymbol(item.symbol),
                     price: parseFloat(item.price),
                     timestamp: Date.now()
                  };
                  this.priceCache[item.symbol] = ticker;
                  this.notify({ type: 'ticker', data: ticker });
               }
            });
         } catch (e) {
            console.error('[MarketData] Force-poll error:', e);
         }
      }, 5000);
   }
   
   startForexPolling() {
      this.fetchForexRates();
      this.forexInterval = setInterval(() => this.fetchForexRates(), 5000); // 5s as requested
   }
   
   async fetchForexRates() {
      try {
         const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CAD,AUD,CHF');
         const data = await res.json();
         const rates = data.rates;
         
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
               change: 0,
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
   
   async fetchKlines(symbol, interval = '1h', limit = 300) {
      let binanceSymbol = symbol.replace('/', '').toUpperCase();
      if (binanceSymbol === 'XAUUSD') binanceSymbol = 'PAXGUSDT';
      
      try {
         const res = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`
         );
         const data = await res.json();
         return data.map(k => ({
            time: Math.floor(k[0] / 1000),
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
   
   subscribe(callback) {
      this.subscribers.push(callback);
      return () => {
         this.subscribers = this.subscribers.filter(cb => cb !== callback);
      };
   }
   
   notify(event) {
      this.subscribers.forEach(cb => cb(event));
   }
   
   getPrice(symbol) {
      const normalized = symbol.replace('/', '').toUpperCase();
      return this.priceCache[normalized] || null;
   }
   
   getAllPrices() {
      return { ...this.priceCache, ...this.forexCache };
   }
}

const marketData = new MarketData();
window.marketData = marketData;
