const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { initDatabase, queries } = require('./database');
const authRoutes = require('./routes/auth');
const signalsRoutes = require('./routes/signals');
const dashboardRoutes = require('./routes/dashboard');
const subscriptionRoutes = require('./routes/subscription');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'smc-capital-secret-key-change-in-production';

// SSE clients for real-time signals
const sseClients = new Set();

// Middleware
app.use(cors({
   origin: process.env.NODE_ENV === 'production' 
      ? 'https://your-domain.com' 
      : ['http://localhost:3000', 'http://localhost:3001'],
   credentials: true
}));
app.use(express.json());
app.use(morgan('combined'));

// Health check
app.get('/health', (req, res) => {
   res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// API Key middleware for webhooks
const authenticateApiKey = (req, res, next) => {
   const apiKey = req.headers['x-api-key'] || req.query.api_key;

   if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
   }

   const user = queries.validateApiKey(apiKey);
   if (!user) {
      return res.status(403).json({ error: 'Invalid API key' });
   }

   req.user = { id: user.id, email: user.email, name: user.name };
   next();
};

// Initialize database
initDatabase();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/signals', signalsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/subscription', subscriptionRoutes);

// SSE endpoint for live signals
app.get('/api/signals/live', (req, res) => {
   res.setHeader('Content-Type', 'text/event-stream');
   res.setHeader('Cache-Control', 'no-cache');
   res.setHeader('Connection', 'keep-alive');
   res.setHeader('Access-Control-Allow-Origin', '*');

   // Send initial connection message
   res.write('event: connected\ndata: {"status":"connected"}\n\n');

   // Add client to SSE pool
   sseClients.add(res);

   // Heartbeat every 30 seconds
   const heartbeat = setInterval(() => {
      res.write('event: heartbeat\ndata: {"timestamp":"' + new Date().toISOString() + '"}\n\n');
   }, 30000);

   req.on('close', () => {
      sseClients.delete(res);
      clearInterval(heartbeat);
   });
});

// Broadcast signal to all SSE clients
const broadcastSignal = (signal) => {
   const data = JSON.stringify(signal);
   sseClients.forEach(client => {
      client.write(`event: signal\ndata: ${data}\n\n`);
   });
};

// Webhook endpoint for MT5 EA signals
app.post('/api/signals/webhook', authenticateApiKey, (req, res) => {
   try {
      const { symbol, direction, entry, sl, tp, lot_size, score, concepts } = req.body;

      // Validate required fields
      if (!symbol || !direction || !entry || !sl || !tp) {
         return res.status(400).json({ 
            error: 'Missing required fields: symbol, direction, entry, sl, tp' 
         });
      }

      // Validate direction
      if (!['long', 'short'].includes(direction)) {
         return res.status(400).json({ 
            error: 'Invalid direction. Must be "long" or "short"' 
         });
      }

      // Rate limiting check (30 seconds between signals)
      if (!queries.checkRateLimit(req.user.id, 30)) {
         return res.status(429).json({ 
            error: 'Rate limit exceeded. Please wait 30 seconds between signals.' 
         });
      }

      // Create signal in database
      const conceptsJson = concepts ? JSON.stringify(concepts) : null;
      const signal = queries.createSignal(
         req.user.id,
         symbol,
         direction,
         parseFloat(entry),
         parseFloat(sl),
         parseFloat(tp),
         parseFloat(score) || 0.5,
         conceptsJson
      );

      // Update rate limit
      queries.updateRateLimit(req.user.id);

      // Get full signal for broadcast
      const fullSignal = queries.getSignalById(signal.id);
      fullSignal.user_name = req.user.name;

      // Broadcast to SSE clients
      broadcastSignal(fullSignal);

      // Notify subscribed MT5 connections
      notifySubscribers(fullSignal);

      res.status(201).json({ 
         success: true, 
         signal_id: signal.id,
         message: 'Signal recorded successfully' 
      });
   } catch (error) {
      console.error('[Webhook] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
});

// Notify subscribed MT5 connections (placeholder for future MT5 push)
const notifySubscribers = (signal) => {
   // This would notify connected MT5 EAs via their respective connections
   // For now, just log it
   console.log(`[Notify] Signal ${signal.id} ready for subscriber mirroring`);
};

// Prop firm compliance check
const checkPropFirmLimits = (userId) => {
   // Get today's stats
   const todayStats = queries.getTodayStats(userId);
   
   // Default prop firm limits
   const MAX_DAILY_LOSS = 5.0; // 5%
   const MAX_DRAWDOWN = 10.0; // 10%
   
   if (todayStats) {
      const dailyLossPercent = (todayStats.daily_pnl / todayStats.balance) * 100;
      if (Math.abs(dailyLossPercent) >= MAX_DAILY_LOSS) {
         return { 
            allowed: false, 
            reason: 'DAILY_LOSS_LIMIT', 
            limit: MAX_DAILY_LOSS,
            current: dailyLossPercent 
         };
      }
      
      if (todayStats.max_drawdown >= MAX_DRAWDOWN) {
         return { 
            allowed: false, 
            reason: 'MAX_DRAWDOWN_LIMIT', 
            limit: MAX_DRAWDOWN,
            current: todayStats.max_drawdown 
         };
      }
   }
   
   return { allowed: true };
};

// Error handling middleware
app.use((err, req, res, next) => {
   console.error('[Error]', err);
   res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
   res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
   console.log(`
╔═══════════════════════════════════════════════════════════╗
║         APEX SMC CAPITAL - API SERVER STARTED             ║
╠═══════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                              ║
║  Mode: ${process.env.NODE_ENV || 'development'}                                  ║
║  SSE Clients: 0                                           ║
╚═══════════════════════════════════════════════════════════╝
   `);
});

module.exports = app;
