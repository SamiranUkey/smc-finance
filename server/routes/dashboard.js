const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'smc-capital-secret-key-change-in-production';

// Auth middleware
const authenticateToken = (req, res, next) => {
   const authHeader = req.headers['authorization'];
   const token = authHeader && authHeader.split(' ')[1];

   if (!token) {
      return res.status(401).json({ error: 'Access token required' });
   }

   jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
         return res.status(403).json({ error: 'Invalid or expired token' });
      }
      req.user = user;
      next();
   });
};

// Get dashboard stats
router.get('/stats', authenticateToken, async (req, res) => {
   try {
      // 1. Get aggregated signal stats
      const stats = await db.get(`
         SELECT 
            COUNT(*) as total_trades,
            COUNT(*) FILTER (WHERE pnl > 0) as winning_trades,
            COUNT(*) FILTER (WHERE pnl < 0) as losing_trades,
            SUM(pnl) as total_pnl
         FROM signals 
         WHERE user_id = $1 AND status IN ('closed', 'tp', 'sl')
      `, [req.user.id]);

      // 2. Get MT5 connections
      const mt5Connections = await db.all('SELECT * FROM mt5_connections WHERE user_id = $1', [req.user.id]);
      
      // 3. Get today's stats from account history (Last entry of today)
      const today = new Date().toISOString().split('T')[0];
      const todayStats = await db.get(
         'SELECT * FROM account_history WHERE user_id = $1 AND date = $2 ORDER BY created_at DESC LIMIT 1',
         [req.user.id, today]
      );

      // Calculate win rate
      const totalClosed = (stats.winning_trades || 0) + (stats.losing_trades || 0);
      const winRate = totalClosed > 0 ? (stats.winning_trades / totalClosed * 100).toFixed(2) : 0;

      // Get open positions
      const openSignals = await db.all('SELECT id FROM signals WHERE user_id = $1 AND status = \'open\'', [req.user.id]);
      const openPositionsCount = openSignals.length;

      // Prop firm compliance check
      const MAX_DAILY_LOSS = 5.0;
      const MAX_POSITIONS = 5;
      const balance = todayStats?.balance || 50000;
      const dailyLossPercent = todayStats 
         ? ((todayStats.daily_pnl / balance) * 100) 
         : 0;

      res.json({
         success: true,
         stats: {
            account: {
               balance: balance,
               equity: todayStats?.equity || balance,
               daily_pnl: todayStats?.daily_pnl || 0,
               daily_pnl_percent: dailyLossPercent.toFixed(2)
            },
            trading: {
               open_positions: openPositionsCount,
               max_positions: MAX_POSITIONS,
               total_trades: parseInt(stats.total_trades || 0),
               winning_trades: parseInt(stats.winning_trades || 0),
               losing_trades: parseInt(stats.losing_trades || 0),
               win_rate: parseFloat(winRate),
               total_pnl: parseFloat(stats.total_pnl || 0)
            },
            compliance: {
               daily_loss_limit: MAX_DAILY_LOSS,
               daily_loss_used: Math.abs(dailyLossPercent).toFixed(2),
               daily_loss_remaining: Math.max(0, MAX_DAILY_LOSS - Math.abs(dailyLossPercent)).toFixed(2),
               max_drawdown_limit: 10.0,
               max_drawdown_used: todayStats?.max_drawdown || 0,
               at_risk: Math.abs(dailyLossPercent) >= (MAX_DAILY_LOSS * 0.8)
            },
            mt5_connected: mt5Connections.some(c => c.status === 'connected') || false,
            mt5_connections: mt5Connections.map(c => ({
               id: c.id,
               broker: c.broker,
               server: c.server,
               status: c.status
            }))
         }
      });
   } catch (error) {
      console.error('[Dashboard/Stats]', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
   }
});

// Get performance data
router.get('/performance', authenticateToken, async (req, res) => {
   try {
      const { period = 30 } = req.query;

      // Get historical stats for the period
      const history = await db.all(
         'SELECT * FROM account_history WHERE user_id = $1 ORDER BY date ASC LIMIT $2',
         [req.user.id, parseInt(period)]
      );

      const stats = await db.get(`
         SELECT 
            COUNT(*) FILTER (WHERE pnl > 0) as winning_trades,
            COUNT(*) FILTER (WHERE pnl < 0) as losing_trades,
            SUM(pnl) as total_pnl,
            COUNT(*) as total_trades
         FROM signals 
         WHERE user_id = $1 AND status IN ('closed', 'tp', 'sl')
      `, [req.user.id]);

      const totalClosed = (stats.winning_trades || 0) + (stats.losing_trades || 0);
      const winRate = totalClosed > 0 ? (stats.winning_trades / totalClosed * 100).toFixed(2) : 0;
      const profitFactor = stats.losing_trades > 0 
         ? (stats.winning_trades * Math.abs(stats.total_pnl / stats.losing_trades) / (stats.losing_trades || 1)).toFixed(2)
         : stats.total_pnl > 0 ? '∞' : '0';

      // Build equity curve
      let equityCurve = history.map(h => ({
         date: h.date,
         equity: h.equity,
         balance: h.balance,
         daily_pnl: h.daily_pnl
      }));

      // Demo data fallback
      if (equityCurve.length === 0) {
         const now = new Date();
         for (let i = parseInt(period) - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            equityCurve.push({
               date: date.toISOString().split('T')[0],
               equity: 50000 + (Math.random() - 0.4) * 2000 * (i < parseInt(period) / 2 ? 1 : 1.2),
               balance: 50000,
               daily_pnl: (Math.random() - 0.42) * 800
            });
         }
      }

      // Calculate max drawdown from history
      let maxDrawdown = 0;
      let peakEquity = equityCurve[0]?.equity || 50000;
      for (const day of equityCurve) {
         if (day.equity > peakEquity) peakEquity = day.equity;
         const drawdown = (peakEquity - day.equity) / peakEquity * 100;
         if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }

      const monthlyReturn = equityCurve.length > 1 
         ? ((equityCurve[equityCurve.length - 1].equity - equityCurve[0].equity) / equityCurve[0].equity * 100).toFixed(2)
         : 0;

      res.json({
         success: true,
         performance: {
            equity_curve: equityCurve,
            metrics: {
               total_pnl: parseFloat(stats.total_pnl || 0),
               win_rate: parseFloat(winRate),
               profit_factor: parseFloat(profitFactor) || 0,
               sharpe_ratio: (monthlyReturn / (Math.abs(monthlyReturn) + 100) * 1.5).toFixed(2),
               max_drawdown: maxDrawdown.toFixed(2),
               avg_trade: stats.total_trades > 0 
                  ? (stats.total_pnl / stats.total_trades).toFixed(2) 
                  : 0,
               total_trades: parseInt(stats.total_trades || 0),
               winning_trades: parseInt(stats.winning_trades || 0),
               losing_trades: parseInt(stats.losing_trades || 0),
               monthly_return: parseFloat(monthlyReturn),
               period_return: equityCurve.length > 1 
                  ? ((equityCurve[equityCurve.length - 1].equity - equityCurve[0].equity) / equityCurve[0].equity * 100).toFixed(2)
                  : 0
            },
            summary: {
               period_days: parseInt(period),
               current_equity: equityCurve[equityCurve.length - 1]?.equity || 50000,
               starting_equity: equityCurve[0]?.equity || 50000,
               best_day: Math.max(...equityCurve.map(e => e.daily_pnl)) || 0,
               worst_day: Math.min(...equityCurve.map(e => e.daily_pnl)) || 0
            }
         }
      });
   } catch (error) {
      console.error('[Dashboard/Performance]', error);
      res.status(500).json({ error: 'Failed to fetch performance data' });
   }
});

// Update account balance
router.post('/update-balance', authenticateToken, async (req, res) => {
   try {
      const { balance, equity } = req.body;

      if (balance === undefined) {
         return res.status(400).json({ error: 'Balance is required' });
      }

      const today = new Date().toISOString().split('T')[0];
      const currentStats = await db.get(
         'SELECT * FROM account_history WHERE user_id = $1 AND date = $2 ORDER BY created_at DESC LIMIT 1',
         [req.user.id, today]
      );
      
      const dailyPnl = equity !== undefined 
         ? equity - (currentStats?.balance || balance)
         : (currentStats?.daily_pnl || 0);

      await db.query(
         `INSERT INTO account_history (user_id, date, balance, equity, daily_pnl, max_drawdown) 
          VALUES ($1, $2, $3, $4, $5, $6) 
          ON CONFLICT (user_id, date) 
          DO UPDATE SET balance = EXCLUDED.balance, equity = EXCLUDED.equity, daily_pnl = EXCLUDED.daily_pnl, max_drawdown = EXCLUDED.max_drawdown`,
         [req.user.id, today, balance, equity !== undefined ? equity : balance, dailyPnl, currentStats?.max_drawdown || 0]
      );

      res.json({
         success: true,
         message: 'Balance updated'
      });
   } catch (error) {
      console.error('[Dashboard/UpdateBalance]', error);
      res.status(500).json({ error: 'Failed to update balance' });
   }
});

module.exports = router;
