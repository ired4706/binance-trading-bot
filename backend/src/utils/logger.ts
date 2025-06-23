import winston from 'winston';
import path from 'path';

// Define the structure for a trade log entry
interface TradeLog {
  symbol: string;
  type: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  takeProfit?: number;
  stopLoss?: number;
  indicators?: any;
  mode?: 'LIVE' | 'TEST';
  timestamp: string;
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Log the full stack
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
      )
    })
  ]
});

// Add file logging if enabled in .env
if (process.env.LOG_TO_FILE === 'true') {
  const logDir = process.env.LOG_DIR || 'logs';
  const logPath = path.join(__dirname, `../../${logDir}`);

  logger.add(new winston.transports.File({
    filename: path.join(logPath, 'trades.log'),
    level: 'info',
    // Custom format for trades log to only log trade objects
    format: winston.format.printf(info => info.message === 'TRADE' ? JSON.stringify(info.trade) : '')
  }));

  logger.add(new winston.transports.File({
    filename: path.join(logPath, 'error.log'),
    level: 'error'
  }));
}

export const logTrade = (tradeInfo: Omit<TradeLog, 'timestamp' | 'mode'>): void => {
  const tradeData: TradeLog = {
    ...tradeInfo,
    mode: process.env.TEST_MODE === 'true' ? 'TEST' : 'LIVE',
    timestamp: new Date().toISOString()
  };
  // Use a specific message to filter transport if needed
  logger.info('TRADE', { trade: tradeData });
};

export const logError = (message: string, error: Error): void => {
  logger.error(message, { 
    error: {
      message: error.message,
      stack: error.stack
    }
  });
};

export { logger }; 