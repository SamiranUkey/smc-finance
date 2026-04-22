/* ================================================
   CHARTS - Real Binance data
   ================================================ */
async function initCharts() {
   const commonOptions = {
      layout: {
         background: { type: 'solid', color: '#131b2a' },
         textColor: '#8b9ab5',
         fontSize: 12,
      },
      grid: {
         vertLines: { color: '#1e2a3f', style: 0 },
         horzLines: { color: '#1e2a3f', style: 0 },
      },
      crosshair: {
         mode: LightweightCharts.CrosshairMode.Normal,
         vertLine: { color: '#00d4aa', width: 1, style: 2 },
         horzLine: { color: '#00d4aa', width: 1, style: 2 },
      },
      timeScale: {
         borderColor: '#1e2a3f',
         timeVisible: true,
         secondsVisible: false,
      },
      rightPriceScale: {
         borderColor: '#1e2a3f',
         autoScale: true,
      },
      handleScale: {
         axisPressedMouseMove: true,
      },
      handleScroll: {
         mouseWheel: true,
         pressedMouseMove: true,
      },
   };

   // Hero chart
   const heroContainer = document.getElementById('heroChart');
   if (heroContainer && typeof LightweightCharts !== 'undefined') {
      const chart = LightweightCharts.createChart(heroContainer, {
         ...commonOptions,
         width: heroContainer.clientWidth,
         height: 480,
      });

      const candleSeries = chart.addCandlestickSeries({
         upColor: '#00d4aa', downColor: '#ff4757',
         borderUpColor: '#00d4aa', borderDownColor: '#ff4757',
         wickUpColor: '#00d4aa', wickDownColor: '#ff4757'
      });

      const volumeSeries = chart.addHistogramSeries({
         color: '#26a69a', priceFormat: { type: 'volume' },
         priceScaleId: '', scaleMargins: { top: 0.8, bottom: 0 }
      });

      const ema20Series = chart.addLineSeries({ color: '#0ea5e9', lineWidth: 1, priceLineVisible: false });
      const ema50Series = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 1, priceLineVisible: false });

      state.charts.hero = chart;
      state.charts.heroCandles = candleSeries;
      state.charts.heroVolume = volumeSeries;
      state.charts.heroEma20 = ema20Series;
      state.charts.heroEma50 = ema50Series;

      const heroSymbol = state.currentBinance || 'BTCUSDT';
      const tf = TF_MAP[state.currentTimeframe] || '1h';
      
      try {
         const klines = await loadKlines(heroSymbol, tf, 200);
         if (klines && klines.length > 0) {
            candleSeries.setData(klines);
            volumeSeries.setData(klines.map(k => ({
               time: k.time,
               value: k.volume,
               color: k.close >= k.open ? 'rgba(0,212,170,0.4)' : 'rgba(255,71,87,0.4)'
            })));
            ema20Series.setData(calculateEMA(klines, 20));
            ema50Series.setData(calculateEMA(klines, 50));
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
         ...commonOptions,
         width: mainContainer.clientWidth,
         height: 420,
      });

      const candleSeries = chart.addCandlestickSeries({
         upColor: '#00d4aa', downColor: '#ff4757',
         borderUpColor: '#00d4aa', borderDownColor: '#ff4757',
         wickUpColor: '#00d4aa', wickDownColor: '#ff4757'
      });

      const volumeSeries = chart.addHistogramSeries({
         color: '#26a69a', priceFormat: { type: 'volume' },
         priceScaleId: '', scaleMargins: { top: 0.8, bottom: 0 }
      });

      const ema20Series = chart.addLineSeries({ color: '#0ea5e9', lineWidth: 1, priceLineVisible: false });
      const ema50Series = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 1, priceLineVisible: false });

      state.charts.main = chart;
      state.charts.mainCandles = candleSeries;
      state.charts.mainVolume = volumeSeries;
      state.charts.mainEma20 = ema20Series;
      state.charts.mainEma50 = ema50Series;

      // --- Tooltip Logic (Professional Touch) ---
      const tooltip = document.getElementById('chartTooltip');
      if (tooltip) {
         chart.subscribeCrosshairMove(param => {
            if (!param.time || param.point === null) {
               tooltip.style.display = 'none';
               return;
            }

            const data = param.seriesData.get(candleSeries);
            if (!data) {
               tooltip.style.display = 'none';
               return;
            }

            tooltip.style.display = 'block';
            tooltip.style.left = (param.point.x + 15) + 'px';
            tooltip.style.top = (param.point.y + 15) + 'px';
            tooltip.innerHTML = `
               <b>O:</b> ${data.open.toFixed(2)} 
               <b>H:</b> ${data.high.toFixed(2)} 
               <b>L:</b> ${data.low.toFixed(2)} 
               <b>C:</b> ${data.close.toFixed(2)}
            `;
         });
      }

      const mainSymbol = state.currentBinance || 'BTCUSDT';
      const tf = TF_MAP[state.currentTimeframe] || '1h';
      
      try {
         const klines = await loadKlines(mainSymbol, tf, 300);
         if (klines && klines.length > 0) {
            candleSeries.setData(klines);
            volumeSeries.setData(klines.map(k => ({
               time: k.time,
               value: k.volume,
               color: k.close >= k.open ? 'rgba(0,212,170,0.4)' : 'rgba(255,71,87,0.4)'
            })));
            ema20Series.setData(calculateEMA(klines, 20));
            ema50Series.setData(calculateEMA(klines, 50));
            chart.timeScale().fitContent();
         }
      } catch (e) {
         console.error('[Charts] Error loading main chart data:', e);
      }

      if (loading) loading.style.display = 'none';
      window.addEventListener('resize', () => chart.applyOptions({ width: mainContainer.clientWidth }));
   }

   // Equity chart
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
   if (!klineData) return;
   
   const { symbol, kline } = klineData;
   const binanceSymbol = symbol.replace('/', '').toUpperCase();
   
   if (symbol !== state.currentSymbol) return;
   
   if (state.charts.heroCandles && kline) {
      try {
         state.charts.heroCandles.update({
            time: Math.floor(kline.t / 1000),
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c)
         });
      } catch (e) {}
   }
   
   if (state.charts.mainCandles && kline) {
      try {
         state.charts.mainCandles.update({
            time: Math.floor(kline.t / 1000),
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c)
         });
      } catch (e) {}
   }

   const key = symbol + state.currentTimeframe;
   if (!state.klineData[key]) state.klineData[key] = [];
   
   const data = state.klineData[key];
   const lastCandle = data[data.length - 1];
   
   if (lastCandle && lastCandle.time === Math.floor(kline.t / 1000)) {
      data[data.length - 1] = {
         time: Math.floor(kline.t / 1000),
         open: parseFloat(kline.o),
         high: parseFloat(kline.h),
         low: parseFloat(kline.l),
         close: parseFloat(kline.c),
         volume: parseFloat(kline.v)
      };
   } else {
      data.push({
         time: Math.floor(kline.t / 1000),
         open: parseFloat(kline.o),
         high: parseFloat(kline.h),
         low: parseFloat(kline.l),
         close: parseFloat(kline.c),
         volume: parseFloat(kline.v)
      });
      if (data.length > 500) data.shift();
   }
   
   runSMCAnalysis();
}
