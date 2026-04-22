# Deployment Guide - Apex SMC Capital Platform

This guide provides step-by-step instructions to deploy the Apex SMC Capital platform.

## 🚀 Architecture Overview
- **Backend:** Node.js / Express (REST API + SSE)
- **Frontend:** HTML5 / CSS3 / JavaScript (Lightweight Charts)
- **Database:** SQLite (local file-based)
- **Market Data:** Binance WebSocket & REST API

---

## 🛠️ Backend Deployment (Railway / Render)

### 1. Environment Variables
Configure the following environment variables in your hosting provider's dashboard:

| Variable | Example Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | The port the server will listen on |
| `JWT_SECRET` | `your-super-secret-key` | Used for signing authentication tokens |
| `DATABASE_PATH` | `/data/database.sqlite` | Absolute path to the SQLite database file |
| `NODE_ENV` | `production` | Set to production for optimized performance |

### 2. Deployment Steps
1. Connect your GitHub account to **Railway.app** or **Render.com**.
2. Select the `smc-finance` repository.
3. Set the **Build Command**: `npm install`
4. Set the **Start Command**: `node server/server.js`
5. Ensure the `DATABASE_PATH` points to a persistent volume if available, otherwise, it will reset on redeploy.

---

## 🌐 Frontend Deployment (Netlify / Vercel)

### 1. Setup
1. Connect your GitHub account to **Netlify** or **Vercel**.
2. Select the `smc-finance` repository.
3. Set the **Publish Directory** to the root folder (where `index.html` and `dashboard.html` are located).

### 2. API Proxy Configuration
To avoid CORS issues, you must point the frontend to your deployed backend URL. 
- Open `app.js` and update `const API_BASE = 'https://your-backend-url.railway.app/api';`.

---

## 🤖 MT5 EA Configuration

### 1. Setup Webhook
1. Once the backend is deployed, copy your production URL (e.g., `https://your-backend-url.railway.app`).
2. Open the **SMC_Sender_EA** or **SMC_Receiver_EA** in MetaEditor.
3. Locate the input settings for the EA.
4. Update the **Webhook URL** to point to your backend:
   - `https://your-backend-url.railway.app/api/signals` (for sending signals)
   - `https://your-backend-url.railway.app/api/subscriptions` (for receiving)

### 2. MT5 Settings
- Go to **Tools** $\rightarrow$ **Options** $\rightarrow$ **Expert Advisors**.
- Check **"Allow WebRequest for listed URL"**.
- Add your backend URL to the list.

---

## 🧪 Testing the Setup
1. **Frontend:** Open the Netlify URL $\rightarrow$ Register $\rightarrow$ Login.
2. **Backend:** Check Railway logs to ensure the server is running on port 3001.
3. **Market Data:** Ensure the dashboard is receiving real-time ticker updates from Binance.
4. **SMC Analysis:** Verify that Order Blocks and FVGs are appearing on the chart based on live kline data.
