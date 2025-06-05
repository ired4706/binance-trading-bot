require('dotenv').config();
const binanceService = require('./services/binanceService');
const indicatorService = require('./services/indicatorService');
const virtualAccount = require('./models/VirtualAccount');
const { logError, logger } = require('./utils/logger');

// Store price history for each pair
const priceHistory = new Map();
const PRICE_HISTORY_LENGTH = Number(process.env.PRICE_HISTORY_LENGTH) || 100;
const UPDATE_INTERVAL = Number(process.env.UPDATE_INTERVAL) || 1000;

// Process incoming price data
const processPriceData = (data) => {
    try {
        const {
            s: symbol,
            k: {
                c: closePrice,
                h: highPrice,
                l: lowPrice
            }
        } = data;

        // Update price history
        if (!priceHistory.has(symbol)) {
            priceHistory.set(symbol, []);
        }
        
        const prices = priceHistory.get(symbol);
        prices.push(parseFloat(closePrice));
        
        // Keep only last N prices
        if (prices.length > PRICE_HISTORY_LENGTH) {
            prices.shift();
        }

        // Calculate indicators and analyze only if we have enough data
        if (prices.length >= PRICE_HISTORY_LENGTH) {
            const analysis = indicatorService.analyzePriceWithIndicators(prices);
            
            // Check existing positions
            virtualAccount.checkPositions(symbol, parseFloat(closePrice));

            // Only execute trades if trading is enabled
            if (process.env.TRADING_ENABLED === 'true') {
                // Trading logic based on indicators
                if (analysis.signals.includes('RSI_OVERSOLD') && analysis.signals.includes('ABOVE_EMA50')) {
                    try {
                        virtualAccount.openPosition(symbol, 'BUY', parseFloat(closePrice));
                    } catch (error) {
                        logger.warn(`Failed to open BUY position: ${error.message}`);
                    }
                }
                else if (analysis.signals.includes('RSI_OVERBOUGHT') && analysis.signals.includes('BELOW_EMA50')) {
                    try {
                        virtualAccount.openPosition(symbol, 'SELL', parseFloat(closePrice));
                    } catch (error) {
                        logger.warn(`Failed to open SELL position: ${error.message}`);
                    }
                }
            }

            // Calculate Fibonacci levels for reference
            const fibLevels = indicatorService.calculateFibonacciLevels(
                parseFloat(highPrice),
                parseFloat(lowPrice)
            );

            if (process.env.LOG_LEVEL === 'debug') {
                logger.debug(`${symbol} Analysis:`, {
                    price: closePrice,
                    indicators: analysis,
                    fibonacciLevels: fibLevels
                });
            }
        }
    } catch (error) {
        logError(error);
    }
};

// Start the trading bot
const startBot = async () => {
    try {
        logger.info('Starting trading bot...');
        logger.info(`Mode: ${process.env.TEST_MODE === 'true' ? 'TEST' : 'LIVE'}`);
        logger.info(`Trading Enabled: ${process.env.TRADING_ENABLED === 'true' ? 'YES' : 'NO'}`);
        
        binanceService.connectToAllStreams(processPriceData);

        // Print account summary periodically
        setInterval(() => {
            const summary = virtualAccount.getAccountSummary();
            logger.info('Account Summary:', summary);
        }, UPDATE_INTERVAL);

    } catch (error) {
        logError(error);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down...');
    binanceService.closeAllConnections();
    process.exit(0);
});

// Start the bot
startBot(); 