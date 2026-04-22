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

// Get all signals (paginated, filterable)
router.get('/', authenticateToken, async (req, res) => {
   try {
      const { symbol, type, status, page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      let queryText = 'SELECT * FROM signals WHERE user_id = $1';
      const params = [req.user.id];
      let paramIdx = 2;

      if (symbol) {
         queryText += ` AND symbol = $${paramIdx++}`;
         params.push(symbol);
      }
      if (type) {
         queryText += ` AND type = $${paramIdx++}`;
         params.push(type);
      }
      if (status) {
         queryText += ` AND status = $${paramIdx++}`;
         params.push(status);
      }

      queryText += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      params.push(parseInt(limit), offset);

      const signals = await db.all(queryText, params);
      
      // Get total count for pagination
      let countText = 'SELECT COUNT(*) FROM signals WHERE user_id = $1';
      const countParams = [req.user.id];
      if (symbol) { countText += ` AND symbol = $2`; countParams.push(symbol); }
      if (type) { countText += ` AND type = $${countParams.length + 1}`; countParams.push(type); }
      if (status) { countText += ` AND status = $${countParams.length + 1}`; countParams.push(status); }
      
      const countRes = await db.get(countText, countParams);
      const total = parseInt(countRes.count);

      const parsedSignals = signals.map(sig => ({
         ...sig,
         concepts: sig.concepts_json ? JSON.parse(sig.concepts_json) : null
      }));

      res.json({
         success: true,
         signals: parsedSignals,
         pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
         }
      });
   } catch (error) {
      console.error('[Signals/Get]', error);
      res.status(500).json({ error: 'Failed to fetch signals' });
   }
});

// Get single signal
router.get('/:id', authenticateToken, async (req, res) => {
   try {
      const signal = await db.get('SELECT * FROM signals WHERE id = $1', [req.params.id]);

      if (!signal) {
         return res.status(404).json({ error: 'Signal not found' });
      }

      if (signal.user_id !== req.user.id) {
         return res.status(403).json({ error: 'Access denied' });
      }

      res.json({
         success: true,
         signal: {
            ...signal,
            concepts: signal.concepts_json ? JSON.parse(signal.concepts_json) : null
         }
      });
   } catch (error) {
      console.error('[Signals/GetSingle]', error);
      res.status(500).json({ error: 'Failed to fetch signal' });
   }
});

// Update signal status (close it)
router.patch('/:id/status', authenticateToken, async (req, res) => {
   try {
      const { status, pnl } = req.body;

      if (!['open', 'closed', 'tp', 'sl'].includes(status)) {
         return res.status(400).json({ error: 'Invalid status' });
      }

      const signal = await db.get('SELECT user_id FROM signals WHERE id = $1', [req.params.id]);

      if (!signal) {
         return res.status(404).json({ error: 'Signal not found' });
      }

      if (signal.user_id !== req.user.id) {
         return res.status(403).json({ error: 'Access denied' });
      }

      await db.query(
         'UPDATE signals SET status = $1, pnl = $2, closed_at = CURRENT_TIMESTAMP WHERE id = $3',
         [status, pnl || 0, req.params.id]
      );

      res.json({
         success: true,
         message: `Signal updated to ${status}`
      });
   } catch (error) {
      console.error('[Signals/UpdateStatus]', error);
      res.status(500).json({ error: 'Failed to update signal' });
   }
});

// Get live signal feed
router.get('/feed/live', authenticateToken, async (req, res) => {
   try {
      const { limit = 50 } = req.query;
      const signals = await db.all('SELECT * FROM signals ORDER BY created_at DESC LIMIT $1', [parseInt(limit)]);

      const parsedSignals = signals.map(sig => ({
         ...sig,
         concepts: sig.concepts_json ? JSON.parse(sig.concepts_json) : null
      }));

      res.json({
         success: true,
         signals: parsedSignals
      });
   } catch (error) {
      console.error('[Signals/LiveFeed]', error);
      res.status(500).json({ error: 'Failed to fetch live feed' });
   }
});

module.exports = router;
