const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'smc-capital-secret-key-change-in-production';

// Register
router.post('/register', async (req, res) => {
   try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
         return res.status(400).json({ error: 'Email, password, and name are required' });
      }

      if (password.length < 8) {
         return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
         return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if user exists
      const existingUser = await db.get('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser) {
         return res.status(409).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user and return the new user data
      // Note: PostgreSQL uses RETURNING to get IDs back
      const user = await db.run(
         'INSERT INTO users (email, password_hash, name, api_key) VALUES ($1, $2, $3, $4) RETURNING id, api_key',
         [email, passwordHash, name, `smc_live_${Math.random().toString(36).substr(2, 15)}`]
      );

      // Generate JWT
      const token = jwt.sign(
         { id: user.id, email, name },
         JWT_SECRET,
         { expiresIn: '7d' }
      );

      res.status(201).json({
         success: true,
         user: { id: user.id, email, name, plan: 'free' },
         token,
         apiKey: user.api_key,
         message: 'Account created successfully'
      });
   } catch (error) {
      console.error('[Auth/Register]', error);
      res.status(500).json({ error: 'Registration failed' });
   }
});

// Login
router.post('/login', async (req, res) => {
   try {
      const { email, password } = req.body;

      if (!email || !password) {
         return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await db.get('SELECT * FROM users WHERE email = $1', [email]);
      if (!user) {
         return res.status(401).json({ error: 'Invalid email or password' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
         return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign(
         { id: user.id, email: user.email, name: user.name },
         JWT_SECRET,
         { expiresIn: '7d' }
      );

      res.json({
         success: true,
         user: {
            id: user.id,
            email: user.email,
            name: user.name,
            plan: user.plan
         },
         token,
         apiKey: user.api_key
      });
   } catch (error) {
      console.error('[Auth/Login]', error);
      res.status(500).json({ error: 'Login failed' });
   }
});

// Get current user profile
router.get('/me', requireAuth, async (req, res) => {
   try {
      const user = await db.get('SELECT * FROM users WHERE id = $1', [req.user.id]);
      if (!user) {
         return res.status(404).json({ error: 'User not found' });
      }

      res.json({
         success: true,
         user: {
            id: user.id,
            email: user.email,
            name: user.name,
            plan: user.plan,
            created_at: user.created_at
         },
         apiKey: user.api_key
      });
   } catch (error) {
      console.error('[Auth/Me]', error);
      res.status(500).json({ error: 'Failed to get profile' });
   }
});

// Connect MT5 account
router.post('/connect-mt5', requireAuth, async (req, res) => {
   try {
      const { broker, login, password, server } = req.body;

      if (!broker || !login || !password || !server) {
         return res.status(400).json({ 
            error: 'Broker, login, password, and server are required' 
         });
      }

      const encryptedPassword = Buffer.from(password).toString('base64');

      const connection = await db.run(
         'INSERT INTO mt5_connections (user_id, broker, login, password_encrypted, server) VALUES ($1, $2, $3, $4, $5) RETURNING id',
         [req.user.id, broker, login, encryptedPassword, server]
      );

      res.json({
         success: true,
         connection: {
            id: connection.id,
            broker,
            server,
            status: 'connected'
         },
         message: 'MT5 account connected successfully'
      });
   } catch (error) {
      console.error('[Auth/ConnectMT5]', error);
      res.status(500).json({ error: 'Failed to connect MT5 account' });
   }
});

// Disconnect MT5 account
router.delete('/disconnect-mt5', requireAuth, async (req, res) => {
   try {
      const { connectionId } = req.body;

      if (!connectionId) {
         return res.status(400).json({ error: 'Connection ID is required' });
      }

      const result = await db.query('DELETE FROM mt5_connections WHERE id = $1 AND user_id = $2', [connectionId, req.user.id]);

      if (result.rowCount === 0) {
         return res.status(404).json({ error: 'Connection not found' });
      }

      res.json({
         success: true,
         message: 'MT5 account disconnected'
      });
   } catch (error) {
      console.error('[Auth/DisconnectMT5]', error);
      res.status(500).json({ error: 'Failed to disconnect MT5 account' });
   }
});

// Get user's MT5 connections
router.get('/mt5-connections', requireAuth, async (req, res) => {
   try {
      const connections = await db.all('SELECT * FROM mt5_connections WHERE user_id = $1', [req.user.id]);
      
      const maskedConnections = connections.map(conn => ({
         id: conn.id,
         broker: conn.broker,
         server: conn.server,
         login: conn.login.substring(0, 4) + '****',
         status: conn.status,
         last_heartbeat: conn.last_heartbeat
      }));

      res.json({
         success: true,
         connections: maskedConnections
      });
   } catch (error) {
      console.error('[Auth/MT5Connections]', error);
      res.status(500).json({ error: 'Failed to get MT5 connections' });
   }
});

function requireAuth(req, res, next) {
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
}

module.exports = router;
