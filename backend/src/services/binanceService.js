const WebSocket = require('ws');
const { TRADING_PAIRS } = require('../constants/pairs');
const { logError } = require('../utils/logger');

class BinanceService {
    constructor() {
        this.streams = new Map();
        this.baseUrl = process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws';
        this.reconnectDelay = 5000;
        this.maxReconnectAttempts = 5;
    }

    // Connect to Binance WebSocket stream
    connectToStream(pair, callback) {
        const streamName = pair.toLowerCase() + '@kline_1m';
        const ws = new WebSocket(`${this.baseUrl}/${streamName}`);
        let reconnectAttempts = 0;

        ws.on('open', () => {
            console.log(`Connected to ${pair} stream`);
            reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        });

        ws.on('message', (data) => {
            try {
                const parsedData = JSON.parse(data);
                if (process.env.TEST_MODE === 'true') {
                    parsedData.test_mode = true;
                }
                callback(parsedData);
            } catch (error) {
                logError(error);
            }
        });

        ws.on('error', (error) => {
            logError(error);
            if (reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnect(pair, callback);
            } else {
                logError(new Error(`Max reconnection attempts reached for ${pair}`));
            }
        });

        ws.on('close', () => {
            console.log(`${pair} stream closed`);
            if (reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnect(pair, callback);
                reconnectAttempts++;
            }
        });

        this.streams.set(pair, ws);
    }

    // Reconnect to WebSocket stream
    reconnect(pair, callback) {
        console.log(`Attempting to reconnect to ${pair} stream`);
        setTimeout(() => {
            this.connectToStream(pair, callback);
        }, this.reconnectDelay);
    }

    // Connect to all trading pairs
    connectToAllStreams(callback) {
        TRADING_PAIRS.forEach(pair => {
            this.connectToStream(pair, callback);
        });
    }

    // Close all connections
    closeAllConnections() {
        this.streams.forEach((ws, pair) => {
            console.log(`Closing ${pair} stream`);
            ws.close();
        });
        this.streams.clear();
    }
}

module.exports = new BinanceService(); 