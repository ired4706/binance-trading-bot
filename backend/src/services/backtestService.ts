import { historicalDataService, HistoricalCandle } from './historicalDataService';
import { IndicatorService } from './indicatorService';
import { BaseStrategy, StrategySignal, Trade, BacktestConfig, StrategyResult } from '../strategies/baseStrategy';
import { RSI_EMA50Strategy } from '../strategies/rsiEma50Strategy';
import { BB_RSIStrategy } from '../strategies/bbRsiStrategy';
import { logger } from '../utils/logger';

export interface BacktestRequest {
  symbol: string;
  interval: string;
  strategy: string;
  startTime?: number;
  endTime?: number;
  config: BacktestConfig;
}

export interface BacktestResponse {
  success: boolean;
  data?: StrategyResult;
  error?: string;
}

export class BacktestService {
  private indicatorService: IndicatorService;
  private strategies: Map<string, (config: BacktestConfig) => BaseStrategy>;

  constructor() {
    this.indicatorService = new IndicatorService();
    this.strategies = new Map();
    this.registerStrategies();
  }

  private registerStrategies() {
    this.strategies.set('RSI_EMA50', (config: BacktestConfig) => new RSI_EMA50Strategy(config));
    this.strategies.set('BB_RSI', (config: BacktestConfig) => new BB_RSIStrategy(config));
  }

  /**
   * Chạy backtest cho một strategy
   */
  async runBacktest(request: BacktestRequest): Promise<BacktestResponse> {
    try {
      const { symbol, interval, strategy, startTime, endTime, config } = request;

      // Validate strategy
      const strategyFactory = this.strategies.get(strategy);
      if (!strategyFactory) {
        return {
          success: false,
          error: `Strategy '${strategy}' not found. Available strategies: ${Array.from(this.strategies.keys()).join(', ')}`
        };
      }

      // Create strategy instance
      const strategyInstance = strategyFactory(config);
      const requiredCandles = strategyInstance.getRequiredCandles();

      // Fetch historical data
      logger.info(`Fetching historical data for ${symbol} with ${requiredCandles} candles`);
      const candles = await historicalDataService.getHistoricalData({
        symbol,
        interval,
        startTime,
        endTime,
        limit: Math.max(requiredCandles * 2, 1000) // Get more data for analysis
      });

      if (candles.length < requiredCandles) {
        return {
          success: false,
          error: `Insufficient data. Need at least ${requiredCandles} candles, got ${candles.length}`
        };
      }

      // Run backtest
      const result = this.executeBacktest(candles, strategyInstance);
      
      logger.info(`Backtest completed for ${strategy} on ${symbol}. Total trades: ${result.trades.length}`);
      
      return {
        success: true,
        data: result
      };

    } catch (error) {
      logger.error('Backtest error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Execute backtest logic
   */
  private executeBacktest(candles: HistoricalCandle[], strategy: BaseStrategy): StrategyResult {
    const signals: StrategySignal[] = [];
    const trades: Trade[] = [];
    let currentPosition: Trade | null = null;
    let balance = strategy['config'].initialBalance;

    logger.info(`Starting backtest with config:`, {
      initialBalance: strategy['config'].initialBalance,
      positionSize: strategy['config'].positionSize,
      stopLoss: strategy['config'].stopLoss,
      takeProfit: strategy['config'].takeProfit
    });

    // Process each candle
    for (let i = strategy.getRequiredCandles(); i < candles.length; i++) {
      const currentCandle = candles[i];
      const historicalCandles = candles.slice(0, i + 1);
      
      // Calculate indicators
      const prices = historicalCandles.map(c => c.close);
      const volumes = historicalCandles.map(c => c.volume);
      const indicators = this.indicatorService.analyzePriceWithIndicators(prices, volumes);
      
      // Get strategy signal
      const signal = strategy.analyzeSignal(historicalCandles, indicators);
      signals.push(signal);

      // Handle trading logic
      if (signal.action !== 'HOLD' && signal.confidence >= 0.5) {
        if (currentPosition === null && signal.action === 'BUY') {
          // Open long position
          const positionSize = balance * (strategy['config'].positionSize / 100);
          const quantity = positionSize / currentCandle.close;
          
          currentPosition = {
            entryTime: currentCandle.openTime,
            exitTime: 0,
            entryPrice: currentCandle.close,
            exitPrice: 0,
            type: 'BUY',
            quantity,
            pnl: 0,
            pnlPercentage: 0
          };
          
          logger.info(`Opened position:`, {
            entryPrice: currentCandle.close,
            quantity,
            positionSize,
            balance
          });
        } else if (currentPosition !== null && signal.action === 'SELL') {
          // Close position
          const exitPrice = currentCandle.close;
          const pnl = (exitPrice - currentPosition.entryPrice) * currentPosition.quantity;
          const pnlPercentage = ((exitPrice - currentPosition.entryPrice) / currentPosition.entryPrice) * 100;
          
          const trade: Trade = {
            ...currentPosition,
            exitTime: currentCandle.openTime,
            exitPrice,
            pnl,
            pnlPercentage
          };
          
          trades.push(trade);
          balance += pnl;
          currentPosition = null;
          
          logger.info(`Closed position by signal:`, {
            entryPrice: trade.entryPrice,
            exitPrice,
            pnl,
            pnlPercentage,
            newBalance: balance
          });
        }
      }

      // Check stop loss and take profit for current position
      if (currentPosition !== null) {
        const currentPrice = currentCandle.close;
        const priceChange = ((currentPrice - currentPosition.entryPrice) / currentPosition.entryPrice) * 100;
        
        // Stop loss
        if (priceChange <= -strategy['config'].stopLoss) {
          const pnl = (currentPrice - currentPosition.entryPrice) * currentPosition.quantity;
          const pnlPercentage = priceChange;
          
          const trade: Trade = {
            ...currentPosition,
            exitTime: currentCandle.openTime,
            exitPrice: currentPrice,
            pnl,
            pnlPercentage
          };
          
          trades.push(trade);
          balance += pnl;
          currentPosition = null;
          
          logger.info(`Closed position by Stop Loss:`, {
            entryPrice: trade.entryPrice,
            exitPrice: currentPrice,
            priceChange,
            stopLoss: strategy['config'].stopLoss,
            pnl,
            pnlPercentage,
            newBalance: balance
          });
        }
        // Take profit
        else if (priceChange >= strategy['config'].takeProfit) {
          const pnl = (currentPrice - currentPosition.entryPrice) * currentPosition.quantity;
          const pnlPercentage = priceChange;
          
          const trade: Trade = {
            ...currentPosition,
            exitTime: currentCandle.openTime,
            exitPrice: currentPrice,
            pnl,
            pnlPercentage
          };
          
          trades.push(trade);
          balance += pnl;
          currentPosition = null;
          
          logger.info(`Closed position by Take Profit:`, {
            entryPrice: trade.entryPrice,
            exitPrice: currentPrice,
            priceChange,
            takeProfit: strategy['config'].takeProfit,
            pnl,
            pnlPercentage,
            newBalance: balance
          });
        }
      }
    }

    // Close any remaining position at the end
    if (currentPosition !== null) {
      const lastCandle = candles[candles.length - 1];
      const pnl = (lastCandle.close - currentPosition.entryPrice) * currentPosition.quantity;
      const pnlPercentage = ((lastCandle.close - currentPosition.entryPrice) / currentPosition.entryPrice) * 100;
      
      const trade: Trade = {
        ...currentPosition,
        exitTime: lastCandle.openTime,
        exitPrice: lastCandle.close,
        pnl,
        pnlPercentage
      };
      
      trades.push(trade);
      balance += pnl;
      
      logger.info(`Closed final position:`, {
        entryPrice: trade.entryPrice,
        exitPrice: lastCandle.close,
        pnl,
        pnlPercentage,
        finalBalance: balance
      });
    }

    logger.info(`Backtest completed:`, {
      totalTrades: trades.length,
      finalBalance: balance,
      initialBalance: strategy['config'].initialBalance,
      totalReturn: balance - strategy['config'].initialBalance
    });

    // Calculate performance metrics
    const performance = strategy.calculatePerformanceMetrics(trades);

    return {
      signals,
      trades,
      performance
    };
  }

  /**
   * Get available strategies
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get strategy info
   */
  getStrategyInfo(strategyName: string) {
    const strategyFactory = this.strategies.get(strategyName);
    if (!strategyFactory) {
      return null;
    }

    const tempConfig: BacktestConfig = {
      initialBalance: 10000,
      positionSize: 10,
      stopLoss: 2,
      takeProfit: 3,
      maxPositions: 1,
      slippage: 0.1
    };

    const tempStrategy = strategyFactory(tempConfig);
    
    return {
      name: tempStrategy.getName(),
      requiredCandles: tempStrategy.getRequiredCandles(),
      description: this.getStrategyDescription(strategyName)
    };
  }

  private getStrategyDescription(strategyName: string): string {
    const descriptions: { [key: string]: string } = {
      'RSI_EMA50': 'Combines RSI momentum indicator with EMA50 trend filter. Best for short-term trading on 1m-15m timeframes.',
      'BB_RSI': 'Uses Bollinger Bands for volatility and RSI for momentum. Effective in ranging markets and mean reversion strategies.'
    };
    
    return descriptions[strategyName] || 'No description available';
  }
}

export const backtestService = new BacktestService(); 