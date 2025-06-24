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

export interface OptimizationResult {
  bestParams: any;
  bestPerformance: PerformanceMetrics;
  allResults: Array<{
    params: any;
    performance: PerformanceMetrics;
  }>;
}

export interface MonteCarloResult {
  simulations: number;
  confidenceIntervals: {
    p95: number;
    p90: number;
    p75: number;
    p50: number;
    p25: number;
    p10: number;
    p5: number;
  };
  worstCase: number;
  bestCase: number;
  expectedValue: number;
}

export interface WalkForwardResult {
  periods: Array<{
    startDate: number;
    endDate: number;
    inSample: PerformanceMetrics;
    outOfSample: PerformanceMetrics;
    params: any;
  }>;
  averageOutOfSample: PerformanceMetrics;
  stabilityScore: number;
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

  /**
   * Parameter optimization using grid search
   */
  async optimizeParameters(
    request: BacktestRequest,
    paramRanges: { [key: string]: number[] }
  ): Promise<OptimizationResult> {
    const results: Array<{ params: any; performance: PerformanceMetrics }> = [];
    const paramNames = Object.keys(paramRanges);
    const paramValues = Object.values(paramRanges);
    
    // Generate all parameter combinations
    const combinations = this.generateCombinations(paramValues);
    
    logger.info(`Starting parameter optimization with ${combinations.length} combinations`);
    
    for (const combination of combinations) {
      const params = paramNames.reduce((obj, name, index) => {
        obj[name] = combination[index];
        return obj;
      }, {} as any);
      
      // Update config with new parameters
      const optimizedConfig = { ...request.config, ...params };
      const optimizedRequest = { ...request, config: optimizedConfig };
      
      try {
        const result = await this.runBacktest(optimizedRequest);
        if (result.success && result.data) {
          results.push({
            params,
            performance: result.data.performance
          });
        }
      } catch (error) {
        logger.warn(`Failed to test combination:`, params, error);
      }
    }
    
    // Find best result based on Sharpe ratio
    const bestResult = results.reduce((best, current) => {
      return current.performance.netSharpeRatio > best.performance.netSharpeRatio ? current : best;
    });
    
    return {
      bestParams: bestResult.params,
      bestPerformance: bestResult.performance,
      allResults: results
    };
  }

  /**
   * Monte Carlo simulation for risk analysis
   */
  async runMonteCarloSimulation(
    request: BacktestRequest,
    simulations: number = 1000
  ): Promise<MonteCarloResult> {
    const results: number[] = [];
    
    // Run original backtest to get trade distribution
    const originalResult = await this.runBacktest(request);
    if (!originalResult.success || !originalResult.data) {
      throw new Error('Failed to run original backtest for Monte Carlo simulation');
    }
    
    const trades = originalResult.data.trades;
    if (trades.length === 0) {
      throw new Error('No trades found for Monte Carlo simulation');
    }
    
    // Extract trade returns for resampling
    const tradeReturns = trades.map(trade => trade.netPnlPercentage);
    
    for (let i = 0; i < simulations; i++) {
      // Resample trades randomly
      const simulatedTrades = this.resampleTrades(tradeReturns, trades.length);
      const simulatedReturn = simulatedTrades.reduce((sum, ret) => sum + ret, 0);
      results.push(simulatedReturn);
    }
    
    // Calculate confidence intervals
    results.sort((a, b) => a - b);
    const confidenceIntervals = {
      p95: results[Math.floor(results.length * 0.95)],
      p90: results[Math.floor(results.length * 0.90)],
      p75: results[Math.floor(results.length * 0.75)],
      p50: results[Math.floor(results.length * 0.50)],
      p25: results[Math.floor(results.length * 0.25)],
      p10: results[Math.floor(results.length * 0.10)],
      p5: results[Math.floor(results.length * 0.05)]
    };
    
    return {
      simulations,
      confidenceIntervals,
      worstCase: results[0],
      bestCase: results[results.length - 1],
      expectedValue: results.reduce((sum, val) => sum + val, 0) / results.length
    };
  }

  /**
   * Walk-forward analysis for out-of-sample testing
   */
  async runWalkForwardAnalysis(
    request: BacktestRequest,
    windowSize: number = 30, // days
    stepSize: number = 7     // days
  ): Promise<WalkForwardResult> {
    const periods: Array<{
      startDate: number;
      endDate: number;
      inSample: PerformanceMetrics;
      outOfSample: PerformanceMetrics;
      params: any;
    }> = [];
    
    // Get historical data to determine date range
    const candles = await historicalDataService.getHistoricalData({
      symbol: request.symbol,
      interval: request.interval,
      startTime: request.startTime,
      endTime: request.endTime,
      limit: 10000
    });
    
    if (candles.length === 0) {
      throw new Error('No historical data available for walk-forward analysis');
    }
    
    const startTime = candles[0].openTime;
    const endTime = candles[candles.length - 1].openTime;
    const windowMs = windowSize * 24 * 60 * 60 * 1000;
    const stepMs = stepSize * 24 * 60 * 60 * 1000;
    
    let currentStart = startTime;
    
    while (currentStart + windowMs < endTime) {
      const inSampleEnd = currentStart + windowMs;
      const outOfSampleEnd = Math.min(inSampleEnd + stepMs, endTime);
      
      // Run in-sample optimization
      const inSampleRequest = {
        ...request,
        startTime: currentStart,
        endTime: inSampleEnd
      };
      
      // For simplicity, optimize a few key parameters
      const paramRanges = {
        stopLoss: [1, 2, 3, 4, 5],
        takeProfit: [2, 3, 4, 5, 6],
        positionSize: [5, 10, 15, 20]
      };
      
      const optimization = await this.optimizeParameters(inSampleRequest, paramRanges);
      
      // Run out-of-sample test with optimized parameters
      const outOfSampleRequest = {
        ...request,
        startTime: inSampleEnd,
        endTime: outOfSampleEnd,
        config: { ...request.config, ...optimization.bestParams }
      };
      
      const outOfSampleResult = await this.runBacktest(outOfSampleRequest);
      
      if (outOfSampleResult.success && outOfSampleResult.data) {
        periods.push({
          startDate: currentStart,
          endDate: outOfSampleEnd,
          inSample: optimization.bestPerformance,
          outOfSample: outOfSampleResult.data.performance,
          params: optimization.bestParams
        });
      }
      
      currentStart += stepMs;
    }
    
    // Calculate average out-of-sample performance
    const avgOutOfSample = this.calculateAveragePerformance(
      periods.map(p => p.outOfSample)
    );
    
    // Calculate stability score (consistency of performance)
    const returns = periods.map(p => p.outOfSample.netTotalReturnPercentage);
    const stabilityScore = this.calculateStabilityScore(returns);
    
    return {
      periods,
      averageOutOfSample: avgOutOfSample,
      stabilityScore
    };
  }

  /**
   * Calculate Value at Risk (VaR)
   */
  calculateVaR(trades: Trade[], confidenceLevel: number = 0.95): number {
    if (trades.length === 0) return 0;
    
    const returns = trades.map(trade => trade.netPnlPercentage);
    returns.sort((a, b) => a - b);
    
    const index = Math.floor(returns.length * (1 - confidenceLevel));
    return Math.abs(returns[index]);
  }

  /**
   * Calculate Expected Shortfall (Conditional VaR)
   */
  calculateExpectedShortfall(trades: Trade[], confidenceLevel: number = 0.95): number {
    if (trades.length === 0) return 0;
    
    const returns = trades.map(trade => trade.netPnlPercentage);
    returns.sort((a, b) => a - b);
    
    const cutoffIndex = Math.floor(returns.length * (1 - confidenceLevel));
    const tailReturns = returns.slice(0, cutoffIndex);
    
    return Math.abs(tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length);
  }

  /**
   * Calculate Omega Ratio
   */
  calculateOmegaRatio(trades: Trade[], threshold: number = 0): number {
    if (trades.length === 0) return 0;
    
    const returns = trades.map(trade => trade.netPnlPercentage);
    const gains = returns.filter(r => r > threshold);
    const losses = returns.filter(r => r <= threshold);
    
    if (losses.length === 0) return gains.length > 0 ? Infinity : 0;
    
    const expectedGain = gains.reduce((sum, gain) => sum + gain, 0) / returns.length;
    const expectedLoss = Math.abs(losses.reduce((sum, loss) => sum + loss, 0) / returns.length);
    
    return expectedLoss > 0 ? expectedGain / expectedLoss : 0;
  }

  /**
   * Calculate Ulcer Index
   */
  calculateUlcerIndex(trades: Trade[], config: BacktestConfig): number {
    if (trades.length === 0) return 0;
    
    let peak = config.initialBalance;
    let runningBalance = config.initialBalance;
    let sumSquaredDrawdown = 0;
    
    trades.forEach(trade => {
      runningBalance += trade.netPnl;
      
      if (runningBalance > peak) {
        peak = runningBalance;
      }
      
      const drawdown = (peak - runningBalance) / peak;
      sumSquaredDrawdown += drawdown * drawdown;
    });
    
    return Math.sqrt(sumSquaredDrawdown / trades.length);
  }

  // Helper methods
  private generateCombinations(arrays: number[][]): number[][] {
    if (arrays.length === 0) return [[]];
    
    const [first, ...rest] = arrays;
    const restCombinations = this.generateCombinations(rest);
    
    return first.flatMap(value => 
      restCombinations.map(combination => [value, ...combination])
    );
  }

  private resampleTrades(returns: number[], count: number): number[] {
    const resampled: number[] = [];
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * returns.length);
      resampled.push(returns[randomIndex]);
    }
    return resampled;
  }

  private calculateAveragePerformance(performances: PerformanceMetrics[]): PerformanceMetrics {
    if (performances.length === 0) {
      return this.getEmptyPerformanceMetrics();
    }
    
    const avg = performances.reduce((sum, perf) => ({
      totalReturn: sum.totalReturn + perf.totalReturn,
      totalReturnPercentage: sum.totalReturnPercentage + perf.totalReturnPercentage,
      winRate: sum.winRate + perf.winRate,
      totalTrades: sum.totalTrades + perf.totalTrades,
      winningTrades: sum.winningTrades + perf.winningTrades,
      losingTrades: sum.losingTrades + perf.losingTrades,
      averageWin: sum.averageWin + perf.averageWin,
      averageLoss: sum.averageLoss + perf.averageLoss,
      profitFactor: sum.profitFactor + perf.profitFactor,
      maxDrawdown: sum.maxDrawdown + perf.maxDrawdown,
      maxDrawdownPercentage: sum.maxDrawdownPercentage + perf.maxDrawdownPercentage,
      sharpeRatio: sum.sharpeRatio + perf.sharpeRatio,
      averageTradeDuration: sum.averageTradeDuration + perf.averageTradeDuration,
      totalFees: sum.totalFees + perf.totalFees,
      totalSlippage: sum.totalSlippage + perf.totalSlippage,
      netTotalReturn: sum.netTotalReturn + perf.netTotalReturn,
      netTotalReturnPercentage: sum.netTotalReturnPercentage + perf.netTotalReturnPercentage,
      netWinRate: sum.netWinRate + perf.netWinRate,
      netProfitFactor: sum.netProfitFactor + perf.netProfitFactor,
      netMaxDrawdown: sum.netMaxDrawdown + perf.netMaxDrawdown,
      netMaxDrawdownPercentage: sum.netMaxDrawdownPercentage + perf.netMaxDrawdownPercentage,
      netSharpeRatio: sum.netSharpeRatio + perf.netSharpeRatio,
      calmarRatio: sum.calmarRatio + perf.calmarRatio,
      sortinoRatio: sum.sortinoRatio + perf.sortinoRatio,
      maxConsecutiveLosses: sum.maxConsecutiveLosses + perf.maxConsecutiveLosses,
      maxConsecutiveWins: sum.maxConsecutiveWins + perf.maxConsecutiveWins,
      averageConsecutiveLosses: sum.averageConsecutiveLosses + perf.averageConsecutiveLosses,
      averageConsecutiveWins: sum.averageConsecutiveWins + perf.averageConsecutiveWins
    }));
    
    const count = performances.length;
    Object.keys(avg).forEach(key => {
      (avg as any)[key] = (avg as any)[key] / count;
    });
    
    return avg;
  }

  private calculateStabilityScore(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Higher stability = lower coefficient of variation
    return stdDev > 0 ? mean / stdDev : 0;
  }

  private getEmptyPerformanceMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0,
      totalReturnPercentage: 0,
      winRate: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      maxDrawdownPercentage: 0,
      sharpeRatio: 0,
      averageTradeDuration: 0,
      totalFees: 0,
      totalSlippage: 0,
      netTotalReturn: 0,
      netTotalReturnPercentage: 0,
      netWinRate: 0,
      netProfitFactor: 0,
      netMaxDrawdown: 0,
      netMaxDrawdownPercentage: 0,
      netSharpeRatio: 0,
      calmarRatio: 0,
      sortinoRatio: 0,
      maxConsecutiveLosses: 0,
      maxConsecutiveWins: 0,
      averageConsecutiveLosses: 0,
      averageConsecutiveWins: 0
    };
  }
}

export const backtestService = new BacktestService(); 