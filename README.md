# Deriv Trading Bot

A Node.js trading bot that connects to Deriv API and executes trades based on market volatility analysis.

## Features

- Real-time market data analysis
- Volatility-based trading decisions
- Time-restricted trading (8:40 AM - 10:15 AM GMT, Mon-Fri)
- WebSocket communication between components
- PM2 process management

## Local Development

### Prerequisites
- Node.js (v14 or higher)
- PM2 (installed globally)

### Installation
```bash
# Run the setup script
./setup.sh

# Or manually:
npm install
```

### Environment Configuration
1. **Edit `config.env`** with your API credentials:
```bash
# Deriv API Configuration
DERIV_API_TOKEN=your_deriv_api_token_here
DERIV_APP_ID=your_deriv_app_id_here

# Server Configuration
PORT=8084
WEBSOCKET_PORT=8084
NODE_ENV=development

# Trading Configuration
TRADING_AMOUNT=20
SYMBOL=1HZ10V
```

### Running Locally
```bash
# Start with environment variables (recommended)
npm run dev:env

# Start without environment variables
npm run dev

# View logs
npm run logs

# Stop processes
npm run stop

# Restart processes
npm run restart
```

## Heroku Deployment

### Prerequisites
- Heroku CLI installed
- Heroku account

### Environment Variables
Set these in your Heroku app settings:

```
DERIV_API_TOKEN=your_deriv_api_token_here
DERIV_APP_ID=your_deriv_app_id_here
NODE_ENV=production
```

### Deploy to Heroku
```bash
# Login to Heroku
heroku login

# Create Heroku app
heroku create your-app-name

# Set environment variables
heroku config:set DERIV_API_TOKEN=your_token_here
heroku config:set DERIV_APP_ID=your_app_id_here
heroku config:set NODE_ENV=production

# Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main

# View logs
heroku logs --tail
```

### Heroku Commands
```bash
# View app status
heroku ps

# View logs
heroku logs --tail

# Restart app
heroku restart

# Open app
heroku open
```

## Project Structure

- `win.js` - Main trading analysis server
- `client-server3.js` - Deriv API client with time restrictions
- `trading_bot.js` - Trading algorithm and market analysis
- `ecosystem.config.js` - PM2 configuration
- `package.json` - Dependencies and scripts

## Trading Rules

- **Trading Hours**: 8:40 AM - 10:15 AM GMT
- **Trading Days**: Monday - Friday (No weekend trading)
- **Market Analysis**: Volatility-based decisions
- **Risk Management**: Built-in stop-loss and take-profit

## Monitoring

The application provides real-time logging and status updates:
- ✅ Trading enabled (within window)
- ❌ Trading disabled (outside window/weekend)
- 🚀 Trade execution confirmations
- 📊 Market analysis data
