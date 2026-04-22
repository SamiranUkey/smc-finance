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

// Subscribe to a signal provider
router.post('/subscribe', authenticateToken, (req, res) => {
   try {
      const { providerId, plan = 'monthly' } = req.body;

      if (!providerId) {
         return res.status(400).json({ error: 'Provider ID is required' });
      }

      // Check if provider exists
      const provider = queries.getUserById(providerId);
      if (!provider) {
         return res.status(404).json({ error: 'Signal provider not found' });
      }

      // Can't subscribe to yourself
      if (providerId === req.user.id) {
         return res.status(400).json({ error: 'Cannot subscribe to yourself' });
      }

      // Check if already subscribed
      const existing = queries.getSubscriptionStatus(req.user.id);
      if (existing && existing.provider_user_id === providerId && existing.status === 'active') {
         return res.status(409).json({ error: 'Already subscribed to this provider' });
      }

      // Create subscription
      const subscription = queries.createSubscription(req.user.id, providerId, plan);

      res.json({
         success: true,
         subscription: {
            id: subscription.id,
            provider_id: providerId,
            provider_name: provider.name,
            plan,
            status: 'active'
         },
         message: `Successfully subscribed to ${provider.name}'s signals`
      });
   } catch (error) {
      console.error('[Subscription/Subscribe]', error);
      res.status(500).json({ error: 'Failed to subscribe' });
   }
});

// Get subscription status
router.get('/status', authenticateToken, (req, res) => {
   try {
      const subscriptions = queries.getSubscriptionsBySubscriber(req.user.id);

      res.json({
         success: true,
         subscriptions: subscriptions.map(sub => ({
            id: sub.id,
            provider_id: sub.provider_user_id,
            provider_name: sub.provider_name,
            plan: sub.plan,
            status: sub.status,
            created_at: sub.created_at
         }))
      });
   } catch (error) {
      console.error('[Subscription/Status]', error);
      res.status(500).json({ error: 'Failed to get subscription status' });
   }
});

// Cancel subscription
router.post('/cancel', authenticateToken, (req, res) => {
   try {
      const { providerId } = req.body;

      if (!providerId) {
         return res.status(400).json({ error: 'Provider ID is required' });
      }

      const result = queries.cancelSubscription(req.user.id, providerId);

      if (result.changes === 0) {
         return res.status(404).json({ error: 'Subscription not found' });
      }

      res.json({
         success: true,
         message: 'Subscription cancelled'
      });
   } catch (error) {
      console.error('[Subscription/Cancel]', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
   }
});

// Get available providers
router.get('/providers', authenticateToken, (req, res) => {
   try {
      // For now, just return the demo provider
      // In production, this would query users who have opted-in to be signal providers
      const providers = [
         {
            id: 1,
            name: 'SMC Capital Pro',
            description: 'Institutional-grade SMC signals with 78%+ win rate',
            performance: {
               win_rate: 78.4,
               avg_rr: 2.3,
               total_signals: 247
            },
            plan: 'pro'
         }
      ];

      res.json({
         success: true,
         providers
      });
   } catch (error) {
      console.error('[Subscription/Providers]', error);
      res.status(500).json({ error: 'Failed to get providers' });
   }
});

module.exports = router;
