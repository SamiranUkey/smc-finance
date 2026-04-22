# APEX SMC CAPITAL - Professional Prop Firm Platform

A high-performance trading ecosystem integrating **Live Binance Market Data**, **Institutional Smart Money Concepts (SMC) Analysis**, and **Automated MT5 Signal Mirroring**.

## 🌟 Key Features

### 📊 Live Analytics & Charting
- **Real-Time Data:** Powered by Binance WebSockets for crypto and Frankfurter API for forex.
- **SMC Analysis Engine:** Automated detection of:
  - **Order Blocks (OB):** Identification of institutional demand/supply zones.
  - **Fair Value Gaps (FVG):** Detecting market imbalances and potential fill zones.
  - **Break of Structure (BOS):** Real-time trend shift and structure break detection.
  - **Liquidity Zones:** Identifying sweep targets and inducement levels.
  - **CHoCH:** Detecting Change of Character for early trend reversals.
- **Interactive Chart Overlays:** Live Entry, SL, and TP lines plotted directly on the chart.
- **Market Context:** Real-time trend classification (Trending Up, Trending Down, Ranging).

### 🤖 MT5 Integration
- **Signal Mirroring:** Connect your MT5 EA $\rightarrow$ Web Dashboard $\rightarrow$ Subscriber EAs.
- **Automated Execution:** Receiver EAs automatically execute mirrored trades.
- **HTTP Client:** Custom MQL5 library with built-in retry logic and error handling.

### 🛡️ Prop Firm Compliance
- **Risk Monitoring:** Real-time tracking of Daily Loss and Max Drawdown.
- **Compliance Panel:** Visual indicators for safe/danger zones based on prop firm rules.
- **Automated Guardrails:** Block new signals when drawdown limits are reached.

---

## 🚀 Quick Start

### Installation
```bash
# Clone and enter project
cd /home/ubuntu/.openclaw/workspace/smc-finance

# Install backend dependencies
cd server && npm install

# Start backend server (port 3001)
npm start

# Serve frontend (Root directory)
cd .. && npx http-server -p 3000
```

### Access
- **Landing Page:** http://localhost:3000
- **Trading Dashboard:** http://localhost:3000/dashboard.html
- **API Base:** http://localhost:3001/api

---

## 🏗️ Architecture

```
smc-finance/
├── server/                    # Node.js Express Backend
│   ├── server.js             # Main entry, middleware, SSE
│   ├── database.js            # SQLite setup & all queries
│   ├── routes/
│   │   ├── auth.js           # Auth endpoints
│   │   ├── signals.js        # Signal CRUD + webhook
│   │   ├── dashboard.js      # Stats + performance
│   │   └── subscription.js   # Provider subscriptions
│   └── package.json
│
├── index.html                 # Landing page
├── dashboard.html            # User dashboard
├── app.js                    # Frontend application logic
├── styles.css                # Global styles
│
└── SMC_MT5_EA/              # MetaTrader 5 Expert Advisors
    ├── http_lib.mqh          # HTTP client for MQL5
    ├── SMC_Sender_EA.mq5     # Sends signals to web backend
    └── SMC_Receiver_EA.mq5   # Receives and mirrors signals
```

---

## 📡 API Reference

### Base URL
`http://localhost:3001/api`

### Authentication
Most endpoints require JWT Bearer token:
```
Authorization: Bearer <token>
```

For webhook calls (MT5 EA → backend), use API key:
```
X-API-Key: <user_api_key>
```

---

### Auth Routes

#### Register
```
POST /auth/register
Content-Type: application/json

Body:
{
  "name": "John Trader",
  "email": "john@example.com",
  "password": "securepassword123"
}

Response (201):
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1...",
  "user": { "id": 1, "name": "John Trader", "email": "john@example.com", "plan": "free" },
  "apiKey": "smc_live_abc123..."
}
```

#### Login
```
POST /auth/login
Content-Type: application/json

Body:
{
  "email": "john@example.com",
  "password": "securepassword123"
}

Response (200):
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1...",
  "user": { "id": 1, "name": "John Trader", "email": "john@example.com", "plan": "free" },
  "apiKey": "smc_live_abc123..."
}
```

#### Get Profile
```
GET /auth/me
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "user": {
    "id": 1,
    "name": "John Trader",
    "email": "john@example.com",
    "plan": "pro",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Connect MT5
```
POST /auth/connect-mt5
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "broker": "ICMarkets-Demo",
  "login": "12345678",
  "password": "YourMT5Password",
  "server": "ICMarkets-Demo"
}

Response (200):
{
  "success": true,
  "connection": {
    "id": 1,
    "broker": "ICMarkets-Demo",
    "login": "12345678",
    "server": "ICMarkets-Demo",
    "status": "active"
  }
}
```

#### Disconnect MT5
```
DELETE /auth/disconnect-mt5
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "message": "MT5 connection removed"
}
```

---

### Signals Routes

#### List Signals
```
GET /signals?symbol=BTC/USDT&type=long&status=open&limit=20&offset=0
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "signals": [
    {
      "id": 1,
      "symbol": "BTC/USDT",
      "type": "long",
      "entry_price": 67234.50,
      "sl": 65890.00,
      "tp": 69500.00,
      "status": "open",
      "score": 0.82,
      "concepts": { "ob": true, "fvg": true, "bos": true },
      "created_at": "2024-01-15T14:30:00Z"
    }
  ],
  "total": 45,
  "hasMore": true
}
```

#### Receive Signal (Webhook - MT5 EA calls this)
```
POST /signals/webhook
X-API-Key: <user_api_key>
Content-Type: application/json

Body:
{
  "symbol": "BTCUSDT",
  "type": "long",
  "entry": 67234.50,
  "sl": 65890.00,
  "tp": 69500.00,
  "lot_size": 0.1,
  "score": 0.82,
  "concepts": {
    "ob": true,
    "fvg": true,
    "bos": true,
    "choch": false,
    "liq": true
  }
}

Response (201):
{
  "success": true,
  "signal": { "id": 156, "status": "open" },
  "mirrored_to": 3  // Number of subscribers who received this
}
```

#### Live Signals Stream (SSE)
```
GET /signals/live
Authorization: Bearer <token>

Response: Server-Sent Events stream

event: signal
data: {"id":157,"symbol":"ETH/USDT","type":"short","entry":3421.50,"sl":3450.00,"tp":3350.00,"status":"open","score":0.78,"created_at":"..."}

event: connected
data: {"status":"connected","user":"john@example.com"}
```

---

### Dashboard Routes

#### Get Stats
```
GET /dashboard/stats
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "stats": {
    "account": {
      "balance": 50000,
      "equity": 51847.32,
      "daily_pnl": 847.32,
      "daily_pnl_percent": 1.69
    },
    "trading": {
      "open_positions": 3,
      "max_positions": 5,
      "win_rate": 78.5,
      "total_trades": 247
    },
    "compliance": {
      "daily_loss_used": 0.84,
      "daily_loss_limit": 5,
      "max_drawdown_used": 2.1,
      "max_drawdown_limit": 10,
      "at_risk": false
    },
    "mt5_connected": true,
    "mt5_broker": "ICMarkets-Demo"
  }
}
```

#### Get Performance
```
GET /dashboard/performance?period=30
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "performance": {
    "equity_curve": [
      { "date": "2024-01-01", "equity": 45000 },
      { "date": "2024-01-02", "equity": 45200 },
      ...
    ],
    "metrics": {
      "total_pnl": 3847.32,
      "win_rate": 78.5,
      "profit_factor": 2.34,
      "max_drawdown": 2.1,
      "avg_trade": 156.32,
      "sharpe_ratio": 1.89
    },
    "monthly_returns": [
      { "month": "2024-01", "return": 8.2 },
      { "month": "2024-02", "return": -2.1 },
      ...
    ]
  }
}
```

---

### Subscription Routes

#### Subscribe to Provider
```
POST /subscription/subscribe
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "provider_id": 5,
  "plan": "monthly"
}

Response (200):
{
  "success": true,
  "subscription": {
    "id": 1,
    "subscriber_id": 1,
    "provider_user_id": 5,
    "plan": "monthly",
    "status": "active",
    "created_at": "2024-01-15T..."
  }
}
```

#### Get Subscription Status
```
GET /subscription/status
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "subscription": {
    "id": 1,
    "provider": { "id": 5, "name": "Pro Signals", "plan": "monthly" },
    "status": "active",
    "created_at": "2024-01-15T..."
  },
  "available_providers": [
    { "id": 5, "name": "Pro Signals", "win_rate": 82, "subscribers": 156 }
  ]
}
```

#### Cancel Subscription
```
POST /subscription/cancel
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "message": "Subscription cancelled"
}
```

---

## 🔌 MT5 Integration

### SMC_Sender_EA.mq5
This EA runs on the signal provider's MT5 terminal and sends trade signals to the web backend.

**Features:**
- Detects SMC patterns (OB, FVG, BOS, CHoCH, Liquidity, Inducement)
- Calculates entry, stop loss, and take profit levels
- Sends signals via HTTP POST to `/api/signals/webhook`
- Includes retry logic (3 attempts on failure)
- Logs all outgoing signals

**Configuration:**
```mq5
input string API_URL = "http://localhost:3001/api/signals/webhook";
input string API_KEY = "smc_live_abc123...";  // Get from your account settings
input int MAX_RETRIES = 3;
input int RETRY_DELAY_MS = 2000;
input double MIN_CONFIDENCE = 0.65;  // Minimum score to send signal
```

### SMC_Receiver_EA.mq5
This EA runs on the subscriber's MT5 terminal and mirrors signals from the web dashboard.

**Features:**
- Connects to backend via SSE or polling
- Receives real-time signals from subscribed providers
- Auto-executes trades with proper lot sizing
- Respects prop firm risk rules (daily loss, max positions)
- Shows signal history and performance

**Configuration:**
```mq5
input string API_URL = "http://localhost:3001/api";
input string API_KEY = "smc_live_xyz789...";  // Subscriber's API key
input double MAX_LOT_SIZE = 1.0;
input int MAX_POSITIONS = 3;
input double MAX_DAILY_LOSS_PERCENT = 5.0;
input bool AUTO_TRADE = true;
input int POLLING_INTERVAL_SEC = 5;  // For polling mode (no SSE on MT5)
```

### Setup Steps (MT5 Terminal)

1. **For Signal Providers:**
   - Copy `SMC_Sender_EA.mq5` and `http_lib.mqh` to MT5 experts folder
   - Open MT5 → Navigator → Expert Advisors → Right-click → Refresh
   - Drag SMC_Sender_EA to chart
   - Configure API_URL and API_KEY parameters
   - Enable "Allow live trading" and "Allow DLL imports"

2. **For Subscribers:**
   - Copy `SMC_Receiver_EA.mq5` and `http_lib.mqh` to MT5 experts folder
   - Open MT5 → Navigator → Expert Advisors → Right-click → Refresh
   - Drag SMC_Receiver_EA to chart
   - Configure API_URL and your API_KEY
   - Set your risk parameters (max lot, positions, daily loss)
   - Enable "Allow live trading" and "Allow DLL imports"

---

## 📊 Prop Firm Compliance Features

The platform monitors these critical risk metrics:

| Metric | Description | Default Limit |
|--------|-------------|---------------|
| Daily Loss | Maximum loss per day | 5% of account |
| Max Drawdown | Peak-to-trough decline | 10% of starting balance |
| Max Positions | Simultaneous open trades | 5 |
| Lot Size | Maximum position size | Varies by plan |

**When a limit is approached:**
- Dashboard shows warning (amber indicator at 80%)
- Dashboard shows danger (red indicator at 100%)
- New signals are blocked until the day resets or account is reset

---

## 🚢 Deployment

### Railway (Recommended)

1. Create Railway account at railway.app
2. Connect your GitHub repository
3. Railway auto-detects Node.js
4. Set environment variables:
   ```
   JWT_SECRET=your-super-secret-jwt-key-min-32-chars
   PORT=3001
   ```
5. Deploy

### Render

1. Create `render.yaml`:
```yaml
services:
  - type: web
    name: smc-backend
    env: node
    buildCommand: cd server && npm install
    startCommand: cd server && npm start
    envVars:
      - JWT_SECRET: your-secret-key
      - PORT: 3001
```

2. Connect GitHub → Deploy

### VPS (DigitalOcean/Raw SSH)

```bash
# SSH into your VPS
ssh root@your-server-ip

# Clone repo
git clone https://github.com/your-repo/smc-finance.git
cd smc-finance/server

# Install Node 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Start server with PM2
pm2 start server.js --name smc-backend

# Setup nginx reverse proxy (for frontend + backend)
# Configure SSL with Certbot
```

### Frontend Deployment

**Netlify:**
1. Push code to GitHub
2. Connect repo to Netlify
3. Build command: leave empty
4. Publish directory: `/` (root, since HTML is at root level)
5. Add redirect for SPA if needed (netlify.toml)

**Vercel:**
```json
// vercel.json
{
  "rewrites": [
    { "source": "/api/{*path}", "destination": "http://your-backend.com/api/{*path}" }
  ]
}
```

---

## 🔒 Security Notes

1. **API Keys**: Treat like passwords. Store in secure location, never commit to git.
2. **JWT Secret**: Use minimum 32-character random string. Rotate periodically.
3. **MT5 Passwords**: Stored encrypted. Never log or expose.
4. **HTTPS**: Always use HTTPS in production. Never deploy with HTTP.
5. **Rate Limiting**: Webhook has built-in rate limit (1 signal per 30s per user).
6. **CORS**: Configure allowed origins in production (not `*`).

---

## 🛠️ Development

### File Structure
```
smc-finance/
├── server/
│   ├── server.js           # Express app entry point
│   ├── database.js         # SQLite setup + helper functions
│   ├── routes/
│   │   ├── auth.js        # Auth logic
│   │   ├── signals.js     # Signals + webhook
│   │   ├── dashboard.js   # Stats + performance
│   │   └── subscription.js # Subscriptions
│   └── package.json
│
├── index.html              # Landing page
├── dashboard.html         # User dashboard
├── app.js                 # Frontend JS
├── styles.css            # CSS styles
│
└── SMC_MT5_EA/
    ├── http_lib.mqh       # HTTP library for MQL5
    ├── SMC_Sender_EA.mq5  # Signal generator EA
    └── SMC_Receiver_EA.mq5 # Signal mirror EA
```

### Running Locally
```bash
# Terminal 1 - Backend
cd smc-finance/server
npm install
npm start

# Terminal 2 - Frontend dev server
cd smc-finance
python3 -m http.server 3000
# or
npx http-server -p 3000
```

### Testing Webhook
```bash
curl -X POST http://localhost:3001/api/signals/webhook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "symbol": "BTCUSDT",
    "type": "long",
    "entry": 67000,
    "sl": 65000,
    "tp": 70000,
    "lot_size": 0.1,
    "score": 0.85,
    "concepts": {"ob": true, "fvg": true}
  }'
```

---

## 📝 Database Schema

```sql
-- Users
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  api_key TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- MT5 Connections
CREATE TABLE mt5_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  broker TEXT NOT NULL,
  login TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  server TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  last_heartbeat DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Signals
CREATE TABLE signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  entry_price REAL NOT NULL,
  sl REAL NOT NULL,
  tp REAL NOT NULL,
  status TEXT DEFAULT 'open',
  lot_size REAL DEFAULT 0.1,
  score REAL DEFAULT 0.5,
  concepts_json TEXT,
  pnl REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Subscriptions
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscriber_id INTEGER NOT NULL,
  provider_user_id INTEGER NOT NULL,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscriber_id) REFERENCES users(id),
  FOREIGN KEY (provider_user_id) REFERENCES users(id)
);
```

---

## 🎯 Common Issues

### CORS Errors
If frontend on port 3000 can't reach backend on 3001:
- Backend has CORS enabled for localhost:3000
- For production, update CORS origin to your domain

### MT5 EA Not Connecting
1. Check MT5 terminal allows DLL imports
2. Verify API URL is correct (https for production)
3. Verify API key matches user account
4. Check server is accessible from MT5 machine (firewall)

### SSE Not Working
- SSE requires keep-alive connection
- Some corporate firewalls block SSE
- Falls back to polling in SMC_Receiver_EA

### Rate Limited
- Webhook limited to 1 signal per 30 seconds per user
- Check logs for rate limit errors
- Wait before retrying

---

## 📞 Support

For issues or questions:
- Check existing issues on GitHub
- Review API responses for error messages
- Enable debug logging in server.js (set DEBUG=true env var)

---

_Last updated: April 2026_