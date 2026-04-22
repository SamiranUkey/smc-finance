const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database');
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
      ? process.env.FRONTEND_URL || 'https://your-domain.netlify.app' 
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
const authenticateApiKey = async (req, res, next) => {
   const apiKey = req.headers['x-api-key'] || req.query.api_key;

   if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
   }

   try {
      const user = await db.get('SELECT id, email, name FROM users WHERE api_key = $1', [apiKey]);
      if (!user) {
         return res.status(403).json({ error: 'Invalid API key' });
      }
      req.user = user;
      next();
   } catch (error) {
      console.error('[AuthApiKey]', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Initialize database and start server
async function startServer() {
   try {
      await db.init();
      
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

         res.write('event: connected\\ndata: {"status":"connected"}\\n\\n');
         sseClients.add(res);

         const heartbeat = setInterval(() => {
            res.write('event: heartbeat\\ndata: {"timestamp":"' + new Date().toISOString() + '"}\\n\\n');
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
            client.write(`event: signal\\ndata: ${data}\\n\\n`);
         });
      };

      // Webhook endpoint for MT5 EA signals
      app.post('/api/signals/webhook', authenticateApiKey, async (req, res) => {
         try {
            const { symbol, direction, entry, sl, tp, lot_size, score, concepts } = req.body;

            if (!symbol || !direction || !entry || !sl || !tp) {
               return res.status(400).json({ 
                  error: 'Missing required fields: symbol, direction, entry, sl, tp' 
               });
            }

            if (!['long', 'short'].includes(direction)) {
               return res.status(400).json({ 
                  error: 'Invalid direction. Must be "long" or "short"' 
               });
            }

            // Simple rate limiting: 30s between signals per user
            const lastSignal = await db.get(
               'SELECT created_at FROM signals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
               [req.user.id]
            );
            if (lastSignal) {
               const diff = (new Date() - new Date(lastSignal.created_at)) / 1000;
               if (diff < 30) {
                  return res.status(429).json({ 
                     error: 'Rate limit exceeded. Please wait 30 seconds between signals.' 
                  });
               }
            }

            const conceptsJson = concepts ? JSON.stringify(concepts) : null;
            const signal = await db.run(
               'INSERT INTO signals (user_id, symbol, type, entry_price, sl, tp, score, concepts_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
               [req.user.id, symbol, direction, parseFloat(entry), parseFloat(sl), parseFloat(tp), parseFloat(score) || 0.5, conceptsJson]
            );

            const fullSignal = await db.get('SELECT * FROM signals WHERE id = $1', [signal.id]);
            fullSignal.user_name = req.user.name;

            broadcastSignal(fullSignal);

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

      // Error handling middleware
      app.use((err, req, res, next) => {
         console.error('[Error]', err);
         res.status(500).json({ error: 'Internal server error' });
      });

      // 404 handler
      app.use((req, res) => {
         res.status(404).json({ error: 'Endpoint not found' });
      });

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

   } catch (error) {
      console.error('Server Startup Error:', error);
      process.exit(1);
   }
}

startServer();

module.exports = app;
