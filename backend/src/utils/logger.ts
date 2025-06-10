import winston from 'winston';
import path from 'path';

const logDir = path.join(__dirname, '../../logs');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export const logError = (error: Error): void => {
  logger.error('Error:', {
    message: error.message,
    stack: error.stack
  });
};

export const logTrade = (trade: {
  pair: string;
  type: string;
  price: number;
  quantity: number;
  takeProfit: number;
  stopLoss: number;
}): void => {
  logger.info('Trade:', trade);
};

export { logger }; 