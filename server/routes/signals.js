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

// Get all signals (paginated, filterable)
router.get('/', authenticateToken, (req, res) => {
   try {
      const { symbol, type, status, page = 1, limit = 20 } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const options = {
         symbol,
         type,
         status,
         limit: parseInt(limit),
         offset
      };

      const signals = queries.getSignals(req.user.id, options);
      const total = queries.getSignalsCount(req.user.id, options);

      // Parse concepts_json for each signal
      const parsedSignals = signals.map(sig => ({
         ...sig,
         concepts: sig.concepts_json ? JSON.parse(sig.concepts_json) : null,
         created_at: sig.created_at,
         closed_at: sig.closed_at
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
router.get('/:id', authenticateToken, (req, res) => {
   try {
      const signal = queries.getSignalById(req.params.id);

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
router.patch('/:id/status', authenticateToken, (req, res) => {
   try {
      const { status, pnl } = req.body;

      if (!['open', 'closed', 'tp', 'sl'].includes(status)) {
         return res.status(400).json({ error: 'Invalid status' });
      }

      const signal = queries.getSignalById(req.params.id);

      if (!signal) {
         return res.status(404).json({ error: 'Signal not found' });
      }

      if (signal.user_id !== req.user.id) {
         return res.status(403).json({ error: 'Access denied' });
      }

      queries.updateSignalStatus(req.params.id, status, pnl || 0);

      res.json({
         success: true,
         message: `Signal updated to ${status}`
      });
   } catch (error) {
      console.error('[Signals/UpdateStatus]', error);
      res.status(500).json({ error: 'Failed to update signal' });
   }
});

// Get live signal feed (recent signals from all users for subscribed providers)
router.get('/feed/live', authenticateToken, (req, res) => {
   try {
      const { limit = 50 } = req.query;

      const signals = queries.getRecentSignals(parseInt(limit));

      const parsedSignals = signals.map(sig => ({
         ...sig,
         concepts: sig.concepts_json ? JSON.parse(sig.concepts_json) : null,
         password_encrypted: undefined // Remove sensitive data
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
