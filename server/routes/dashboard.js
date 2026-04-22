const express = require('express');
const jwt = require('jsonwebtoken');
const { queries } = require('../database');

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
router.get('/stats', authenticateToken, (req, res) => {
   try {
      const stats = queries.getDashboardStats(req.user.id);
      const mt5Connections = queries.getMT5ConnectionsByUser(req.user.id);
      
      // Get today's stats
      const todayStats = queries.getTodayStats(req.user.id);

      // Calculate win rate
      const totalClosed = stats.winning_trades + stats.losing_trades;
      const winRate = totalClosed > 0 ? (stats.winning_trades / totalClosed * 100).toFixed(2) : 0;

      // Get open positions (signals with status 'open')
      const openSignals = queries.getSignals(req.user.id, { status: 'open', limit: 100 });
      const openPositionsCount = openSignals.length;

      // Prop firm compliance check
      const MAX_DAILY_LOSS = 5.0;
      const MAX_POSITIONS = 5;
      const dailyLossPercent = todayStats 
         ? (todayStats.daily_pnl / todayStats.balance * 100) 
         : 0;

      res.json({
         success: true,
         stats: {
            account: {
               balance: todayStats?.balance || 50000,
               equity: todayStats?.equity || (todayStats?.balance || 50000),
               daily_pnl: todayStats?.daily_pnl || 0,
               daily_pnl_percent: dailyLossPercent.toFixed(2)
            },
            trading: {
               open_positions: openPositionsCount,
               max_positions: MAX_POSITIONS,
               total_trades: stats.total_trades || 0,
               winning_trades: stats.winning_trades || 0,
               losing_trades: stats.losing_trades || 0,
               win_rate: parseFloat(winRate),
               total_pnl: stats.total_pnl || 0
            },
            compliance: {
               daily_loss_limit: MAX_DAILY_LOSS,
               daily_loss_used: Math.abs(dailyLossPercent).toFixed(2),
               daily_loss_remaining: Math.max(0, MAX_DAILY_LOSS - Math.abs(dailyLossPercent)).toFixed(2),
               max_drawdown_limit: 10.0,
               max_drawdown_used: todayStats?.max_drawdown || 0,
               at_risk: Math.abs(dailyLossPercent) >= (MAX_DAILY_LOSS * 0.8) // Warning at 80%
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

// Get performance data (equity curve, metrics)
router.get('/performance', authenticateToken, (req, res) => {
   try {
      const { period = 30 } = req.query;

      // Get historical stats
      const history = queries.getAccountStatsHistory(req.user.id, parseInt(period));

      // Get overall stats
      const stats = queries.getDashboardStats(req.user.id);

      // Calculate metrics
      const totalClosed = stats.winning_trades + stats.losing_trades;
      const winRate = totalClosed > 0 ? (stats.winning_trades / totalClosed * 100).toFixed(2) : 0;
      const profitFactor = stats.losing_trades > 0 
         ? (stats.winning_trades * Math.abs(stats.total_pnl / stats.losing_trades) / (stats.losing_trades || 1)).toFixed(2)
         : stats.total_pnl > 0 ? '∞' : '0';

      // Calculate Sharpe-like ratio (simplified)
      const monthlyReturn = history.length > 1 
         ? ((history[history.length - 1].equity - history[0].equity) / history[0].equity * 100).toFixed(2)
         : 0;

      // Calculate max drawdown from history
      let maxDrawdown = 0;
      let peakEquity = history[0]?.equity || 50000;
      for (const day of history) {
         if (day.equity > peakEquity) peakEquity = day.equity;
         const drawdown = (peakEquity - day.equity) / peakEquity * 100;
         if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }

      // Build equity curve
      const equityCurve = history.map(h => ({
         date: h.date,
         equity: h.equity,
         balance: h.balance,
         daily_pnl: h.daily_pnl
      }));

      // If no history, generate demo data
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

      res.json({
         success: true,
         performance: {
            equity_curve: equityCurve,
            metrics: {
               total_pnl: stats.total_pnl || 0,
               win_rate: parseFloat(winRate),
               profit_factor: parseFloat(profitFactor) || 0,
               sharpe_ratio: (monthlyReturn / (Math.abs(monthlyReturn) + 100) * 1.5).toFixed(2),
               max_drawdown: maxDrawdown.toFixed(2),
               avg_trade: stats.total_trades > 0 
                  ? (stats.total_pnl / stats.total_trades).toFixed(2) 
                  : 0,
               total_trades: stats.total_trades,
               winning_trades: stats.winning_trades,
               losing_trades: stats.losing_trades,
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

// Update account balance (for MT5 connection to push updates)
router.post('/update-balance', authenticateToken, (req, res) => {
   try {
      const { balance, equity } = req.body;

      if (balance === undefined) {
         return res.status(400).json({ error: 'Balance is required' });
      }

      const today = new Date().toISOString().split('T')[0];
      const currentStats = queries.getTodayStats(req.user.id);
      const dailyPnl = equity !== undefined 
         ? equity - (currentStats?.balance || balance)
         : (currentStats?.daily_pnl || 0);

      queries.upsertAccountStats(
         req.user.id,
         today,
         balance,
         equity !== undefined ? equity : balance,
         dailyPnl,
         currentStats?.max_drawdown || 0
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
