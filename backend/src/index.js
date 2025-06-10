require('dotenv').config();
const binanceService = require('./services/binanceService');
const indicatorService = require('./services/indicatorService');
const virtualAccount = require('./models/VirtualAccount');
const { logError, logger } = require('./utils/logger');
const webSocketService = require('./services/webSocketService');

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
            logger.info(`Initialized price history for ${symbol}`);
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
            const positionCheck = virtualAccount.checkPositions(symbol, parseFloat(closePrice));
            if (positionCheck) {
                logger.info(`Position closed for ${symbol}:`, positionCheck);
            }

            // Only execute trades if trading is enabled
            if (process.env.TRADING_ENABLED === 'true') {
                logger.debug(`Trading conditions for ${symbol}:`, {
                    price: closePrice,
                    rsi: analysis.rsi,
                    ema50: analysis.ema50,
                    signals: analysis.signals,
                    hasPosition: virtualAccount.positions.has(symbol),
                    balance: virtualAccount.balance
                });

                // Trading logic based on indicators and selected strategy
                if (!virtualAccount.positions.has(symbol)) {  // Only trade if no position exists
                    const settings = webSocketService.getCurrentSettings();
                    
                    // BB + RSI Strategy
                    if (settings.enabledStrategies.includes('BB_RSI')) {
                        if (analysis.signals.includes('BB_LOWER_TOUCH') && analysis.signals.includes('RSI_OVERSOLD')) {
                            try {
                                const position = virtualAccount.openPosition(symbol, 'BUY', parseFloat(closePrice));
                                logger.info(`[BB_RSI] Opened BUY position for ${symbol}:`, position);
                            } catch (error) {
                                logger.warn(`Failed to open BUY position: ${error.message}`);
                            }
                        }
                        else if (analysis.signals.includes('BB_UPPER_TOUCH') && analysis.signals.includes('RSI_OVERBOUGHT')) {
                            try {
                                const position = virtualAccount.openPosition(symbol, 'SELL', parseFloat(closePrice));
                                logger.info(`[BB_RSI] Opened SELL position for ${symbol}:`, position);
                            } catch (error) {
                                logger.warn(`Failed to open SELL position: ${error.message}`);
                            }
                        }
                    }

                    // Support/Resistance + Volume Strategy
                    if (settings.enabledStrategies.includes('SR_VOLUME')) {
                        if (analysis.signals.includes('AT_SUPPORT') && analysis.signals.includes('HIGH_VOLUME')) {
                            try {
                                const position = virtualAccount.openPosition(symbol, 'BUY', parseFloat(closePrice));
                                logger.info(`[SR_VOLUME] Opened BUY position for ${symbol}:`, position);
                            } catch (error) {
                                logger.warn(`Failed to open BUY position: ${error.message}`);
                            }
                        }
                        else if (analysis.signals.includes('AT_RESISTANCE') && analysis.signals.includes('HIGH_VOLUME')) {
                            try {
                                const position = virtualAccount.openPosition(symbol, 'SELL', parseFloat(closePrice));
                                logger.info(`[SR_VOLUME] Opened SELL position for ${symbol}:`, position);
                            } catch (error) {
                                logger.warn(`Failed to open SELL position: ${error.message}`);
                            }
                        }
                    }

                    // Ichimoku Strategy
                    if (settings.enabledStrategies.includes('ICHIMOKU')) {
                        if (analysis.signals.includes('ICHIMOKU_BULLISH')) {
                            try {
                                const position = virtualAccount.openPosition(symbol, 'BUY', parseFloat(closePrice));
                                logger.info(`[ICHIMOKU] Opened BUY position for ${symbol}:`, position);
                            } catch (error) {
                                logger.warn(`Failed to open BUY position: ${error.message}`);
                            }
                        }
                        else if (analysis.signals.includes('ICHIMOKU_BEARISH')) {
                            try {
                                const position = virtualAccount.openPosition(symbol, 'SELL', parseFloat(closePrice));
                                logger.info(`[ICHIMOKU] Opened SELL position for ${symbol}:`, position);
                            } catch (error) {
                                logger.warn(`Failed to open SELL position: ${error.message}`);
                            }
                        }
                    }

                    if (process.env.LOG_LEVEL === 'debug') {
                        logger.debug(`${symbol} Analysis:`, {
                            price: closePrice,
                            indicators: analysis,
                            enabledStrategies: settings.enabledStrategies
                        });
                    }
                } else {
                    logger.debug('Position already exists for', symbol);
                }
            } else {
                logger.debug('Trading is disabled');
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
        } else {
            logger.debug(`Collecting price history for ${symbol}: ${prices.length}/${PRICE_HISTORY_LENGTH}`);
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