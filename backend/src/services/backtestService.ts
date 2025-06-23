import { BaseStrategy, StrategySignal, Trade, BacktestConfig, StrategyResult, PerformanceMetrics } from '../strategies/baseStrategy';
import { RSI_EMA50Strategy } from '../strategies/rsiEma50Strategy';
import { BB_RSIStrategy } from '../strategies/bbRsiStrategy';
import { MACDVolumeStrategy } from '../strategies/macdVolumeStrategy';
import { ATRDynamicStrategy } from '../strategies/atrDynamicStrategy';
import { MTFTrendStrategy } from '../strategies/mtfTrendStrategy';
import { StochasticRsiStrategy } from '../strategies/stochasticRsiStrategy';
import { BBSqueezeStrategy } from '../strategies/bbSqueezeStrategy';
import { SupportResistanceStrategy } from '../strategies/supportResistanceStrategy';
import { historicalDataService, HistoricalCandle } from './historicalDataService';
import { IndicatorService } from './indicatorService';
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
    this.strategies.set('RSI_EMA200', (config: BacktestConfig) => new RSI_EMA50Strategy(config));
    this.strategies.set('BB_RSI', (config: BacktestConfig) => new BB_RSIStrategy(config));
    this.strategies.set('SR_VOLUME', (config: BacktestConfig) => new MACDVolumeStrategy(config));
    this.strategies.set('ICHIMOKU', (config: BacktestConfig) => new MTFTrendStrategy(config));
    this.strategies.set('MACD_VOLUME', (config: BacktestConfig) => new MACDVolumeStrategy(config));
    this.strategies.set('ATR_DYNAMIC', (config: BacktestConfig) => new ATRDynamicStrategy(config));
    this.strategies.set('MTF_TREND', (config: BacktestConfig) => new MTFTrendStrategy(config));
    this.strategies.set('STOCHASTIC_RSI', (config: BacktestConfig) => new StochasticRsiStrategy(config));
    this.strategies.set('BB_SQUEEZE', (config: BacktestConfig) => new BBSqueezeStrategy(config));
    this.strategies.set('SUPPORT_RESISTANCE', (config: BacktestConfig) => new SupportResistanceStrategy(config));
  }

  /**
   * Calculate trading fees based on order type and amount
   */
  private calculateFees(amount: number, config: BacktestConfig): number {
    const feeRate = config.useMakerFees ? config.makerFees : config.takerFees;
    return amount * (feeRate / 100);
  }

  /**
   * Calculate slippage cost
   */
  private calculateSlippage(price: number, config: BacktestConfig): number {
    return price * (config.slippage / 100);
  }

  /**
   * Apply slippage to price (buy higher, sell lower)
   */
  private applySlippage(price: number, isBuy: boolean, config: BacktestConfig): number {
    const slippageAmount = this.calculateSlippage(price, config);
    return isBuy ? price + slippageAmount : price - slippageAmount;
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
      takeProfit: strategy['config'].takeProfit,
      tradingFees: strategy['config'].tradingFees,
      slippage: strategy['config'].slippage
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
          // Open long position with fees and slippage
          const positionSize = balance * (strategy['config'].positionSize / 100);
          const entryPriceWithSlippage = this.applySlippage(currentCandle.close, true, strategy['config']);
          const quantity = positionSize / entryPriceWithSlippage;
          const entryFees = this.calculateFees(positionSize, strategy['config']);
          
          // Adjust position size for fees
          const actualPositionSize = positionSize - entryFees;
          const actualQuantity = actualPositionSize / entryPriceWithSlippage;
          
          currentPosition = {
            entryTime: currentCandle.openTime,
            exitTime: 0,
            entryPrice: currentCandle.close,
            exitPrice: 0,
            type: 'BUY',
            quantity: actualQuantity,
            pnl: 0,
            pnlPercentage: 0,
            entryFees,
            exitFees: 0,
            entrySlippage: entryPriceWithSlippage - currentCandle.close,
            exitSlippage: 0,
            netPnl: 0,
            netPnlPercentage: 0,
            exitReason: 'SIGNAL'
          };
          
          logger.info(`Opened position:`, {
            entryPrice: currentCandle.close,
            entryPriceWithSlippage,
            quantity: actualQuantity,
            positionSize: actualPositionSize,
            entryFees,
            balance
          });
        } else if (currentPosition !== null && signal.action === 'SELL') {
          // Close position with fees and slippage
          const exitPriceWithSlippage = this.applySlippage(currentCandle.close, false, strategy['config']);
          const grossPnl = (exitPriceWithSlippage - currentPosition.entryPrice) * currentPosition.quantity;
          const exitFees = this.calculateFees(exitPriceWithSlippage * currentPosition.quantity, strategy['config']);
          const netPnl = grossPnl - currentPosition.entryFees - exitFees;
          const pnlPercentage = ((exitPriceWithSlippage - currentPosition.entryPrice) / currentPosition.entryPrice) * 100;
          const netPnlPercentage = ((netPnl) / (currentPosition.entryPrice * currentPosition.quantity)) * 100;
          
          const trade: Trade = {
            ...currentPosition,
            exitTime: currentCandle.openTime,
            exitPrice: currentCandle.close,
            pnl: grossPnl,
            pnlPercentage,
            exitFees,
            exitSlippage: currentCandle.close - exitPriceWithSlippage,
            netPnl,
            netPnlPercentage,
            exitReason: 'SIGNAL'
          };
          
          trades.push(trade);
          balance += netPnl;
          currentPosition = null;
          
          logger.info(`Closed position by signal:`, {
            entryPrice: trade.entryPrice,
            exitPrice: currentCandle.close,
            exitPriceWithSlippage,
            grossPnl,
            netPnl,
            entryFees: trade.entryFees,
            exitFees,
            pnlPercentage,
            netPnlPercentage,
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
          const exitPriceWithSlippage = this.applySlippage(currentPrice, false, strategy['config']);
          const grossPnl = (exitPriceWithSlippage - currentPosition.entryPrice) * currentPosition.quantity;
          const exitFees = this.calculateFees(exitPriceWithSlippage * currentPosition.quantity, strategy['config']);
          const netPnl = grossPnl - currentPosition.entryFees - exitFees;
          const pnlPercentage = priceChange;
          const netPnlPercentage = ((netPnl) / (currentPosition.entryPrice * currentPosition.quantity)) * 100;
          
          const trade: Trade = {
            ...currentPosition,
            exitTime: currentCandle.openTime,
            exitPrice: currentPrice,
            pnl: grossPnl,
            pnlPercentage,
            exitFees,
            exitSlippage: currentPrice - exitPriceWithSlippage,
            netPnl,
            netPnlPercentage,
            exitReason: 'STOP_LOSS'
          };
          
          trades.push(trade);
          balance += netPnl;
          currentPosition = null;
          
          logger.info(`Closed position by Stop Loss:`, {
            entryPrice: trade.entryPrice,
            exitPrice: currentPrice,
            exitPriceWithSlippage,
            priceChange,
            stopLoss: strategy['config'].stopLoss,
            grossPnl,
            netPnl,
            pnlPercentage,
            netPnlPercentage,
            newBalance: balance
          });
        }
        // Take profit
        else if (priceChange >= strategy['config'].takeProfit) {
          const exitPriceWithSlippage = this.applySlippage(currentPrice, false, strategy['config']);
          const grossPnl = (exitPriceWithSlippage - currentPosition.entryPrice) * currentPosition.quantity;
          const exitFees = this.calculateFees(exitPriceWithSlippage * currentPosition.quantity, strategy['config']);
          const netPnl = grossPnl - currentPosition.entryFees - exitFees;
          const pnlPercentage = priceChange;
          const netPnlPercentage = ((netPnl) / (currentPosition.entryPrice * currentPosition.quantity)) * 100;
          
          const trade: Trade = {
            ...currentPosition,
            exitTime: currentCandle.openTime,
            exitPrice: currentPrice,
            pnl: grossPnl,
            pnlPercentage,
            exitFees,
            exitSlippage: currentPrice - exitPriceWithSlippage,
            netPnl,
            netPnlPercentage,
            exitReason: 'TAKE_PROFIT'
          };
          
          trades.push(trade);
          balance += netPnl;
          currentPosition = null;
          
          logger.info(`Closed position by Take Profit:`, {
            entryPrice: trade.entryPrice,
            exitPrice: currentPrice,
            exitPriceWithSlippage,
            priceChange,
            takeProfit: strategy['config'].takeProfit,
            grossPnl,
            netPnl,
            pnlPercentage,
            netPnlPercentage,
            newBalance: balance
          });
        }
      }
    }

    // Close any remaining position at the end
    if (currentPosition !== null) {
      const lastCandle = candles[candles.length - 1];
      const exitPriceWithSlippage = this.applySlippage(lastCandle.close, false, strategy['config']);
      const grossPnl = (exitPriceWithSlippage - currentPosition.entryPrice) * currentPosition.quantity;
      const exitFees = this.calculateFees(exitPriceWithSlippage * currentPosition.quantity, strategy['config']);
      const netPnl = grossPnl - currentPosition.entryFees - exitFees;
      const pnlPercentage = ((exitPriceWithSlippage - currentPosition.entryPrice) / currentPosition.entryPrice) * 100;
      const netPnlPercentage = ((netPnl) / (currentPosition.entryPrice * currentPosition.quantity)) * 100;
      
      const trade: Trade = {
        ...currentPosition,
        exitTime: lastCandle.openTime,
        exitPrice: lastCandle.close,
        pnl: grossPnl,
        pnlPercentage,
        exitFees,
        exitSlippage: lastCandle.close - exitPriceWithSlippage,
        netPnl,
        netPnlPercentage,
        exitReason: 'END_OF_DATA'
      };
      
      trades.push(trade);
      balance += netPnl;
      
      logger.info(`Closed final position:`, {
        entryPrice: trade.entryPrice,
        exitPrice: lastCandle.close,
        exitPriceWithSlippage,
        grossPnl,
        netPnl,
        pnlPercentage,
        netPnlPercentage,
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
      slippage: 0.1,
      tradingFees: 0.1,
      makerFees: 0.075,
      takerFees: 0.1,
      useMakerFees: false
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
      'RSI_EMA200': 'Combines RSI momentum indicator with EMA200 trend filter. Best for long-term trading on 1h-4h timeframes.',
      'BB_RSI': 'Uses Bollinger Bands for volatility and RSI for momentum. Effective in ranging markets and mean reversion strategies.',
      'SR_VOLUME': 'Combines support/resistance levels with volume analysis. Best for swing trading on 1h-4h timeframes.',
      'ICHIMOKU': 'Uses Ichimoku Cloud for trend analysis. Best for medium-term trading on 4h-1d timeframes.',
      'MACD_VOLUME': 'Combines MACD for trend detection and volume for confirmation. Useful for trend following strategies.',
      'ATR_DYNAMIC': 'Uses ATR for volatility and dynamic stop loss. Effective in volatile markets.',
      'MTF_TREND': 'Uses multi-timeframe analysis for trend detection. Best for swing trading on 4h-1d timeframes.',
      'STOCHASTIC_RSI': 'Mean reversion strategy combining Stochastic and RSI divergence. Best for sideways markets on 5m-15m timeframes.',
      'BB_SQUEEZE': 'Breakout strategy detecting market compression and breakout opportunities. Best for volatile markets on 5m-1h timeframes.',
      'SUPPORT_RESISTANCE': 'Market structure strategy identifying key levels and breakout/retest signals. Best for swing trading on 1h-4h timeframes.'
    };
    
    return descriptions[strategyName] || 'No description available';
  }
}

export const backtestService = new BacktestService(); 