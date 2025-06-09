import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { webSocketService } from './services/websocket.service';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Connect to Binance WebSocket with trading pairs
const tradingPairs = [
  'btcusdt',   // Bitcoin
  'ethusdt',   // Ethereum
  'adausdt',   // Cardano
  'wldusdt',   // Worldcoin
  'xrpusdt',   // Ripple
  'solusdt',   // Solana
  'nearusdt',  // NEAR Protocol
  'linkusdt'   // Chainlink
];

webSocketService.initialize(server);
webSocketService.connect(tradingPairs);

// Handle WebSocket messages
webSocketService.on('message', (data) => {
  logger.info('Received data:', data);
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Trading Bot API is running!',
    wsStatus: webSocketService.isSocketConnected(),
    tradingPairs
  });
});

server.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
}); 