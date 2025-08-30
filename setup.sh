#!/bin/bash

echo "🚀 Setting up Trading Bot Environment..."

# Check if config.env exists
if [ ! -f "config.env" ]; then
    echo "❌ config.env file not found!"
    echo "Please create config.env with your API credentials"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
yarn install

# Load environment variables
echo "🔧 Loading environment variables..."
source config.env

# Display current configuration
echo "📊 Current Configuration:"
echo "  - Deriv API Token: ${DERIV_API_TOKEN:0:10}..."
echo "  - Deriv App ID: $DERIV_APP_ID"
echo "  - Port: $PORT"
echo "  - WebSocket Port: $WEBSOCKET_PORT"
echo "  - Trading Amount: $TRADING_AMOUNT"
echo "  - Symbol: $SYMBOL"
echo "  - Trading Hours: ${TRADING_START_HOUR}:${TRADING_START_MINUTE} - ${TRADING_END_HOUR}:${TRADING_END_MINUTE} GMT"

echo "✅ Setup complete!"
echo ""
echo "To start the trading bot:"
echo "  npm run dev:env    # Start with environment variables"
echo "  npm run dev        # Start without environment variables"
echo "  npm run logs       # View logs"
echo "  npm run stop       # Stop all processes"
