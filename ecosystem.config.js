require('dotenv').config({ path: './config.env' });

module.exports = {
  apps: [
    {
      name: 'win-server',
      script: 'win.js',
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 8084,
        DERIV_API_TOKEN: process.env.DERIV_API_TOKEN,
        DERIV_APP_ID: process.env.DERIV_APP_ID
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 8084,
        DERIV_API_TOKEN: process.env.DERIV_API_TOKEN,
        DERIV_APP_ID: process.env.DERIV_APP_ID
      }
    },
    {
      name: 'client-server',
      script: 'client-server3.js',
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        WEBSOCKET_PORT: 8084,
        DERIV_API_TOKEN: process.env.DERIV_API_TOKEN,
        DERIV_APP_ID: process.env.DERIV_APP_ID
      },
      env_production: {
        NODE_ENV: 'production',
        WEBSOCKET_PORT: 8084,
        DERIV_API_TOKEN: process.env.DERIV_API_TOKEN,
        DERIV_APP_ID: process.env.DERIV_APP_ID
      }
    }
  ]
};


