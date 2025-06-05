const winston = require('winston');
const path = require('path');

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        // Console logging
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Add file transports if LOG_TO_FILE is true
if (process.env.LOG_TO_FILE === 'true') {
    const logDir = process.env.LOG_DIR || 'logs';
    
    // File logging for trades
    logger.add(new winston.transports.File({
        filename: path.join(__dirname, `../../${logDir}/trades.log`),
        level: 'info'
    }));

    // File logging for errors
    logger.add(new winston.transports.File({
        filename: path.join(__dirname, `../../${logDir}/error.log`),
        level: 'error'
    }));
}

// Trade logging function
const logTrade = (tradeInfo) => {
    if (process.env.TEST_MODE === 'true') {
        tradeInfo.mode = 'TEST';
    }

    logger.info('TRADE', {
        timestamp: new Date().toISOString(),
        pair: tradeInfo.pair,
        type: tradeInfo.type,
        price: tradeInfo.price,
        quantity: tradeInfo.quantity,
        takeProfit: tradeInfo.takeProfit,
        stopLoss: tradeInfo.stopLoss,
        balance: tradeInfo.balance,
        indicators: tradeInfo.indicators
    });
};

// Error logging function
const logError = (error) => {
    logger.error('ERROR', {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack
    });
};

module.exports = {
    logger,
    logTrade,
    logError
}; 