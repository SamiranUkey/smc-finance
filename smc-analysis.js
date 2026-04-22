/* ================================================
   SMC ANALYSIS ENGINE
   Smart Money Concepts - Order Blocks, FVG,
   BOS, Liquidity, Inducement, CHoCH
   ================================================ */

class SMC_Analysis {
   constructor() {
      this.orderBlocks = [];
      this.fvgs = [];
      this.bos = [];
      this.liquidity = [];
      this.choch = [];
      this.signals = [];
      this.context = 'UNDEFINED'; // TRENDING_UP, TRENDING_DOWN, RANGING
   }

   /* ================================================
      MAIN ANALYZE FUNCTION
      Input: candles = [{time, open, high, low, close, volume}, ...]
      Output: { orderBlocks, fvgs, bos, liquidity, signals, context }
      ================================================ */
   analyze(candles) {
      if (!candles || candles.length < 20) return this.emptyResult();

      this.orderBlocks = [];
      this.fvgs = [];
      this.bos = [];
      this.liquidity = [];
      this.choch = [];
      this.signals = [];

      // Detect swings for context
      const swings = this.detectSwings(candles);
      this.context = this.detectMarketContext(candles, swings);

      // Detect all SMC concepts
      this.detectOrderBlocks(candles, swings);
      this.detectFVG(candles);
      this.detectBOS(candles, swings);
      this.detectLiquidity(candles, swings);
      this.detectInducement(candles, swings);
      this.detectCHoCH(candles, swings);

      // Generate trade signals
      this.generateSignals(candles);

      return this.getResults();
   }

   emptyResult() {
      return {
         orderBlocks: [], fvgs: [], bos: [],
         liquidity: [], signals: [], context: 'UNDEFINED'
      };
   }

   getResults() {
      return {
         orderBlocks: this.orderBlocks,
         fvgs: this.fvgs,
         bos: this.bos,
         liquidity: this.liquidity,
         choch: this.choch,
         signals: this.signals,
         context: this.context
      };
   }

   /* ================================================
      SWING DETECTION
      ================================================ */
   detectSwings(candles, lookback = 20) {
      const swings = [];
      const highIdxArr = [];
      const lowIdxArr = [];

      for (let i = 2; i < candles.length - 2; i++) {
         const prev2 = candles[i - 2];
         const prev1 = candles[i - 1];
         const curr = candles[i];
         const next1 = candles[i + 1];
         const next2 = candles[i + 2];

         // Swing High
         if (prev1.high < curr.high && next1.high < curr.high &&
             prev2.high < curr.high && next2.high < curr.high) {
            swings.push({ index: i, time: curr.time, price: curr.high, type: 'high' });
         }
         // Swing Low
         if (prev1.low > curr.low && next1.low > curr.low &&
             prev2.low > curr.low && next2.low > curr.low) {
            swings.push({ index: i, time: curr.time, price: curr.low, type: 'low' });
         }
      }
      return swings;
   }

   /* ================================================
      MARKET CONTEXT (Trend vs Range)
      Uses MA 20/50 crossover + range detection
      ================================================ */
   detectMarketContext(candles, swings) {
      if (candles.length < 50) return 'RANGING';

      const closes = candles.map(c => c.close);
      const ma20 = this.calcSMA(closes, 20);
      const ma50 = this.calcSMA(closes, 50);

      const recentMA20 = ma20[ma20.length - 1];
      const recentMA50 = ma50[ma50.length - 1];
      const currentPrice = closes[closes.length - 1];

      // Check for range (MA20 flat = low gradient)
      const ma20Gradient = ma20[ma20.length - 1] - ma20[ma20.length - 10];
      const rangePercent = Math.abs(ma20[ma20.length - 1] - ma20[ma20.length - 10]) / ma20[ma20.length - 1];

      if (rangePercent < 0.002) return 'RANGING';

      // Bullish: price > MA20 > MA50, MA20 rising
      if (currentPrice > recentMA20 && recentMA20 > recentMA50 && ma20Gradient > 0) {
         return 'TRENDING_UP';
      }
      // Bearish: price < MA20 < MA50, MA20 falling
      if (currentPrice < recentMA20 && recentMA20 < recentMA50 && ma20Gradient < 0) {
         return 'TRENDING_DOWN';
      }

      return 'RANGING';
   }

   /* ================================================
      ORDER BLOCKS
      Last bearish candle before a strong bullish impulse,
      or last bullish candle before a strong bearish impulse
      ================================================ */
   detectOrderBlocks(candles, swings) {
      for (let i = 5; i < candles.length - 1; i++) {
         const curr = candles[i];
         const prev = candles[i - 1];
         const next = candles[i + 1];

         // Bullish OB: prev is bearish, next has strong bullish close
         if (prev.close < prev.open && next.close > next.open) {
            const impulse = next.close - next.open;
            const candleRange = next.high - next.low;
            if (impulse > candleRange * 0.6) {
               // Check it's near a swing low or support
               const nearSwing = swings.some(s => s.type === 'low' &&
                  Math.abs(s.price - prev.low) < prev.low * 0.001 && s.index < i);
               if (nearSwing || i < 10) {
                  this.orderBlocks.push({
                     type: 'bullish',
                     zoneHigh: prev.high,
                     zoneLow: prev.low,
                     price: (prev.high + prev.low) / 2,
                     strength: Math.round(60 + impulse / candleRange * 40),
                     time: curr.time,
                     index: i
                  });
               }
            }
         }

         // Bearish OB: prev is bullish, next has strong bearish close
         if (prev.close > prev.open && next.close < next.open) {
            const impulse = next.open - next.close;
            const candleRange = next.high - next.low;
            if (impulse > candleRange * 0.6) {
               const nearSwing = swings.some(s => s.type === 'high' &&
                  Math.abs(s.price - prev.high) < prev.high * 0.001 && s.index < i);
               if (nearSwing || i < 10) {
                  this.orderBlocks.push({
                     type: 'bearish',
                     zoneHigh: prev.high,
                     zoneLow: prev.low,
                     price: (prev.high + prev.low) / 2,
                     strength: Math.round(60 + impulse / candleRange * 40),
                     time: curr.time,
                     index: i
                  });
               }
            }
         }
      }

      // Keep only the last 5 OBs per type
      const bullish = this.orderBlocks.filter(o => o.type === 'bullish').slice(-5);
      const bearish = this.orderBlocks.filter(o => o.type === 'bearish').slice(-5);
      this.orderBlocks = [...bullish, ...bearish];
   }

   /* ================================================
      FAIR VALUE GAPS (FVG)
      3-candle pattern: candle 2's body doesn't overlap candle 1 & 3
      ================================================ */
   detectFVG(candles) {
      for (let i = 2; i < candles.length - 1; i++) {
         const candle1 = candles[i - 2];
         const candle2 = candles[i - 1];
         const candle3 = candles[i];

         const midHigh = Math.max(candle1.high, candle3.high);
         const midLow = Math.min(candle1.low, candle3.low);

         // Bullish FVG: candle2 body is above candle1 & candle3
         const fvgTopBullish = candle2.low;
         const fvgBottomBullish = Math.max(candle1.close, candle3.close);

         if (fvgTopBullish > fvgBottomBullish) {
            const gapSize = fvgTopBullish - fvgBottomBullish;
            const avgPrice = (fvgTopBullish + fvgBottomBullish) / 2;
            const gapPercent = gapSize / avgPrice;

            this.fvgs.push({
               type: 'bullish',
               top: fvgTopBullish,
               bottom: fvgBottomBullish,
               price: avgPrice,
               depth: gapSize,
               depthPercent: (gapPercent * 100).toFixed(2),
               strength: gapPercent > 0.003 ? 85 : 65,
               time: candle2.time,
               index: i - 1
            });
         }

         // Bearish FVG: candle2 body is below candle1 & candle3
         const fvgTopBearish = Math.min(candle1.close, candle3.close);
         const fvgBottomBearish = candle2.high;

         if (fvgBottomBearish < fvgTopBearish) {
            const gapSize = fvgTopBearish - fvgBottomBearish;
            const avgPrice = (fvgTopBearish + fvgBottomBearish) / 2;
            const gapPercent = gapSize / avgPrice;

            this.fvgs.push({
               type: 'bearish',
               top: fvgTopBearish,
               bottom: fvgBottomBearish,
               price: avgPrice,
               depth: gapSize,
               depthPercent: (gapPercent * 100).toFixed(2),
               strength: gapPercent > 0.003 ? 85 : 65,
               time: candle2.time,
               index: i - 1
            });
         }
      }

      // Keep last 6 FVGs
      if (this.fvgs.length > 6) {
         this.fvgs = this.fvgs.slice(-6);
      }
   }

   /* ================================================
      BREAK OF STRUCTURE (BOS)
      Price breaks a previous swing high/low with momentum
      ================================================ */
   detectBOS(candles, swings) {
      if (swings.length < 4) return;

      const recentSwings = swings.slice(-6);
      let lastHighIdx = -1, lastLowIdx = -1;
      let highestHigh = -Infinity, lowestLow = Infinity;

      recentSwings.forEach(s => {
         if (s.type === 'high' && s.price > highestHigh) {
            highestHigh = s.price; lastHighIdx = s.index;
         }
         if (s.type === 'low' && s.price < lowestLow) {
            lowestLow = s.price; lastLowIdx = s.index;
         }
      });

      if (lastHighIdx < 0 || lastLowIdx < 0) return;

      const currentCandle = candles[candles.length - 1];
      const lookbackCandle = candles[candles.length - 5];

      // Bullish BOS: price breaks above last high with close > high
      if (currentCandle.close > highestHigh && lookbackCandle.close < highestHigh) {
         // Check momentum (volume higher than average)
         const avgVol = this.calcAvgVolume(candles, 20);
         const momentum = currentCandle.volume > avgVol * 0.8 ? 'strong' : 'weak';

         this.bos.push({
            type: 'bullish',
            brokenLevel: highestHigh,
            price: currentCandle.close,
            strength: momentum === 'strong' ? 85 : 60,
            momentum,
            time: currentCandle.time,
            index: candles.length - 1
         });
      }

      // Bearish BOS: price breaks below last low with close < low
      if (currentCandle.close < lowestLow && lookbackCandle.close > lowestLow) {
         const avgVol = this.calcAvgVolume(candles, 20);
         const momentum = currentCandle.volume > avgVol * 0.8 ? 'strong' : 'weak';

         this.bos.push({
            type: 'bearish',
            brokenLevel: lowestLow,
            price: currentCandle.close,
            strength: momentum === 'strong' ? 85 : 60,
            momentum,
            time: currentCandle.time,
            index: candles.length - 1
         });
      }
   }

   /* ================================================
      LIQUIDITY ZONES
      Swing highs/lows with small candle bodies = likely sweep targets
      ================================================ */
   detectLiquidity(candles, swings) {
      const recentSwings = swings.slice(-8);

      recentSwings.forEach(swing => {
         // Find candle at swing
         const candleIdx = candles.findIndex(c => c.time === swing.time);
         if (candleIdx < 0) return;

         const candle = candles[candleIdx];
         const bodySize = Math.abs(candle.close - candle.open);
         const range = candle.high - candle.low;
         const bodyRatio = bodySize / (range || 1);

         // Small body = low liquidity area (HVN - High Volume Node = big body)
         // Large body wick = likely liquidity grab (LVN - Low Volume Node)
         if (bodyRatio < 0.3 || candleIdx < 3) {
            this.liquidity.push({
               type: swing.type === 'high' ? 'bearish' : 'bullish',
               zonePrice: swing.price,
               price: swing.price,
               strength: Math.round(50 + (1 - bodyRatio) * 50),
               isSweep: false,
               time: swing.time,
               index: swing.index
            });
         }
      });

      if (this.liquidity.length > 6) {
         this.liquidity = this.liquidity.slice(-6);
      }
   }

   /* ================================================
      INDUCEMENT
      Small-range candle before a liquidity sweep
      ================================================ */
   detectInducement(candles, swings) {
      for (let i = 3; i < candles.length - 1; i++) {
         const curr = candles[i];
         const prev = candles[i - 1];
         const next = candles[i + 1];

         const currRange = curr.high - curr.low;
         const prevRange = prev.high - prev.low;

         // Inducement: current candle has much smaller range than prev
         if (currRange < prevRange * 0.5) {
            const nextRange = next.high - next.low;
            // Followed by large impulse = inducement confirmation
            if (nextRange > currRange * 2) {
               this.choch.push({
                  type: curr.close > curr.open ? 'bullish' : 'bearish',
                  inducementPrice: (curr.high + curr.low) / 2,
                  price: (curr.high + curr.low) / 2,
                  impulseRange: nextRange,
                  strength: 70,
                  time: curr.time,
                  index: i
               });
            }
         }
      }
   }

   /* ================================================
      MARKET STRUCTURE SHIFT (CHoCH)
      Trend direction change after equal highs/lows
      ================================================ */
   detectCHoCH(candles, swings) {
      if (swings.length < 6) return;

      const recentHighs = swings.filter(s => s.type === 'high').slice(-4);
      const recentLows = swings.filter(s => s.type === 'low').slice(-4);

      if (recentHighs.length >= 2 && recentLows.length >= 2) {
         // Check for sequential lower highs (bearish shift)
         if (recentHighs[recentHighs.length - 1].price < recentHighs[recentHighs.length - 2].price &&
             recentLows[recentLows.length - 1].price < recentLows[recentLows.length - 2].price) {
            this.choch.push({
               type: 'bearish',
               price: recentLows[recentLows.length - 1].price,
               description: 'Lower Highs + Lower Lows',
               strength: 80,
               time: recentLows[recentLows.length - 1].time,
               index: recentLows[recentLows.length - 1].index
            });
         }

         // Check for sequential higher lows (bullish shift)
         if (recentLows[recentLows.length - 1].price > recentLows[recentLows.length - 2].price &&
             recentHighs[recentHighs.length - 1].price > recentHighs[recentHighs.length - 2].price) {
            this.choch.push({
               type: 'bullish',
               price: recentHighs[recentHighs.length - 1].price,
               description: 'Higher Lows + Higher Highs',
               strength: 80,
               time: recentHighs[recentHighs.length - 1].time,
               index: recentHighs[recentHighs.length - 1].index
            });
         }
      }
   }

   /* ================================================
      GENERATE TRADE SIGNALS
      Combine OB + FVG + BOS + Context for valid signals
      ================================================ */
   generateSignals(candles) {
      const lastCandle = candles[candles.length - 1];
      const prevCandle = candles[candles.length - 2];
      const currentPrice = lastCandle.close;

      // Only generate in trending context
      if (this.context === 'RANGING') return;

      const isBullish = this.context === 'TRENDING_UP';

      // Find the best OB for this direction
      const relevantOBs = this.orderBlocks
         .filter(ob => ob.type === (isBullish ? 'bullish' : 'bearish'))
         .slice(-3);

      // Find unfilled FVG for this direction
      const relevantFVGs = this.fvgs
         .filter(fvg => fvg.type === (isBullish ? 'bullish' : 'bearish'))
         .slice(-2);

      if (relevantOBs.length === 0 && relevantFVGs.length === 0) return;

      // Calculate entry based on OB zone or FVG
      let entryPrice, stopLoss, takeProfit, confidence;

      if (relevantOBs.length > 0) {
         const ob = relevantOBs[relevantOBs.length - 1];
         entryPrice = ob.price;
         confidence = ob.strength;
      } else {
         const fvg = relevantFVGs[relevantFVGs.length - 1];
         entryPrice = isBullish ? fvg.bottom : fvg.top;
         confidence = fvg.strength;
      }

      // SL: beyond the OB/FVG zone or recent swing
      if (isBullish) {
         stopLoss = entryPrice * 0.995; // 0.5% below
         takeProfit = entryPrice * 1.015; // 1.5% target (1:3 R roughly)
      } else {
         stopLoss = entryPrice * 1.005;
         takeProfit = entryPrice * 0.985;
      }

      // Only signal if price is near entry (within 0.3%)
      const priceDistance = Math.abs(currentPrice - entryPrice) / entryPrice;
      if (priceDistance > 0.003) return;

      this.signals.push({
         direction: isBullish ? 1 : -1,
         entryPrice,
         stopLoss,
         takeProfit,
         confidence,
         context: this.context,
         timestamp: lastCandle.time,
         description: `${this.context} setup from ${relevantOBs.length > 0 ? 'Order Block' : 'FVG'}`
      });
   }

   /* ================================================
      CALC HELPERS
      ================================================ */
   calcSMA(data, period) {
      const result = [];
      for (let i = 0; i < data.length; i++) {
         if (i < period - 1) {
            result.push(null);
         } else {
            const slice = data.slice(i - period + 1, i + 1);
            result.push(slice.reduce((a, b) => a + b, 0) / period);
         }
      }
      return result;
   }

   calcAvgVolume(candles, period = 20) {
      if (candles.length < period) return candles.reduce((s, c) => s + c.volume, 0) / candles.length;
      const recent = candles.slice(-period);
      return recent.reduce((s, c) => s + c.volume, 0) / period;
   }
}

// Export for global use
window.SMC_Analysis = SMC_Analysis;
