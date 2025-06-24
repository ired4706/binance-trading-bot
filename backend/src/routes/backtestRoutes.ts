import { Router, Request, Response } from 'express';
import { backtestService } from '../services/backtestService';
import { historicalDataService } from '../services/historicalDataService';
import { BacktestConfig } from '../strategies/baseStrategy';

const router = Router();

/**
 * GET /api/backtest/strategies
 * Lấy danh sách các strategy có sẵn
 */
router.get('/strategies', async (req: Request, res: Response) => {
  try {
    const strategies = backtestService.getAvailableStrategies();
    const strategyDetails = strategies.map(strategy => {
      const info = backtestService.getStrategyInfo(strategy);
      return {
        name: strategy,
        ...info
      };
    });

    res.json({
      success: true,
      data: strategyDetails
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get strategies'
    });
  }
});

/**
 * GET /api/backtest/symbols
 * Lấy danh sách các symbol có sẵn
 */
router.get('/symbols', async (req: Request, res: Response) => {
  try {
    const symbols = await historicalDataService.getAvailableSymbols();
    
    // Filter popular symbols for easier selection
    const popularSymbols = symbols.filter(symbol => 
      symbol.endsWith('USDT') && 
      ['BTC', 'ETH', 'ADA', 'WLD', 'XRP', 'SOL', 'NEAR', 'LINK'].some(popular => 
        symbol.startsWith(popular)
      )
    );

    res.json({
      success: true,
      data: {
        all: symbols,
        popular: popularSymbols
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get symbols'
    });
  }
});

/**
 * POST /api/backtest/run
 * Chạy backtest
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      interval,
      strategy,
      startTime,
      endTime,
      config
    } = req.body;

    // Validate required fields
    if (!symbol || !interval || !strategy || !config) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, interval, strategy, config'
      });
    }

    // Validate config
    const backtestConfig: BacktestConfig = {
      initialBalance: config.initialBalance || 10000,
      positionSize: config.positionSize || 10,
      stopLoss: config.stopLoss || 2,
      takeProfit: config.takeProfit || 3,
      maxPositions: config.maxPositions || 1,
      slippage: config.slippage || 0.1,
      tradingFees: config.tradingFees || 0.1,
      makerFees: config.makerFees || 0.075,
      takerFees: config.takerFees || 0.1,
      useMakerFees: config.useMakerFees || false
    };

    // Validate config values
    if (backtestConfig.initialBalance <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Initial balance must be greater than 0'
      });
    }

    if (backtestConfig.positionSize <= 0 || backtestConfig.positionSize > 100) {
      return res.status(400).json({
        success: false,
        error: 'Position size must be between 0 and 100'
      });
    }

    if (backtestConfig.stopLoss <= 0 || backtestConfig.takeProfit <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Stop loss and take profit must be greater than 0'
      });
    }

    const result = await backtestService.runBacktest({
      symbol,
      interval,
      strategy,
      startTime,
      endTime,
      config: backtestConfig
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/backtest/historical-data
 * Lấy dữ liệu lịch sử cho preview
 */
router.get('/historical-data', async (req: Request, res: Response) => {
  try {
    const { symbol, interval, limit = 100 } = req.query;

    if (!symbol || !interval) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: symbol, interval'
      });
    }

    const data = await historicalDataService.getHistoricalData({
      symbol: symbol as string,
      interval: interval as string,
      limit: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: {
        symbol,
        interval,
        candles: data,
        count: data.length
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/backtest/optimize
 * Tối ưu hóa parameters cho strategy
 */
router.post('/optimize', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      interval,
      strategy,
      startTime,
      endTime,
      config,
      paramRanges
    } = req.body;

    // Validate required fields
    if (!symbol || !interval || !strategy || !config || !paramRanges) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, interval, strategy, config, paramRanges'
      });
    }

    // Validate config
    const backtestConfig: BacktestConfig = {
      initialBalance: config.initialBalance || 10000,
      positionSize: config.positionSize || 10,
      stopLoss: config.stopLoss || 2,
      takeProfit: config.takeProfit || 3,
      maxPositions: config.maxPositions || 1,
      slippage: config.slippage || 0.1,
      tradingFees: config.tradingFees || 0.1,
      makerFees: config.makerFees || 0.075,
      takerFees: config.takerFees || 0.1,
      useMakerFees: config.useMakerFees || false
    };

    const result = await backtestService.optimizeParameters({
      symbol,
      interval,
      strategy,
      startTime,
      endTime,
      config: backtestConfig
    }, paramRanges);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/backtest/monte-carlo
 * Chạy Monte Carlo simulation
 */
router.post('/monte-carlo', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      interval,
      strategy,
      startTime,
      endTime,
      config,
      simulations = 1000
    } = req.body;

    // Validate required fields
    if (!symbol || !interval || !strategy || !config) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, interval, strategy, config'
      });
    }

    // Validate config
    const backtestConfig: BacktestConfig = {
      initialBalance: config.initialBalance || 10000,
      positionSize: config.positionSize || 10,
      stopLoss: config.stopLoss || 2,
      takeProfit: config.takeProfit || 3,
      maxPositions: config.maxPositions || 1,
      slippage: config.slippage || 0.1,
      tradingFees: config.tradingFees || 0.1,
      makerFees: config.makerFees || 0.075,
      takerFees: config.takerFees || 0.1,
      useMakerFees: config.useMakerFees || false
    };

    const result = await backtestService.runMonteCarloSimulation({
      symbol,
      interval,
      strategy,
      startTime,
      endTime,
      config: backtestConfig
    }, simulations);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/backtest/walk-forward
 * Chạy Walk-forward analysis
 */
router.post('/walk-forward', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      interval,
      strategy,
      startTime,
      endTime,
      config,
      windowSize = 30,
      stepSize = 7
    } = req.body;

    // Validate required fields
    if (!symbol || !interval || !strategy || !config) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, interval, strategy, config'
      });
    }

    // Validate config
    const backtestConfig: BacktestConfig = {
      initialBalance: config.initialBalance || 10000,
      positionSize: config.positionSize || 10,
      stopLoss: config.stopLoss || 2,
      takeProfit: config.takeProfit || 3,
      maxPositions: config.maxPositions || 1,
      slippage: config.slippage || 0.1,
      tradingFees: config.tradingFees || 0.1,
      makerFees: config.makerFees || 0.075,
      takerFees: config.takerFees || 0.1,
      useMakerFees: config.useMakerFees || false
    };

    const result = await backtestService.runWalkForwardAnalysis({
      symbol,
      interval,
      strategy,
      startTime,
      endTime,
      config: backtestConfig
    }, windowSize, stepSize);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/backtest/risk-metrics
 * Tính toán các risk metrics nâng cao
 */
router.post('/risk-metrics', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      interval,
      strategy,
      startTime,
      endTime,
      config
    } = req.body;

    // Validate required fields
    if (!symbol || !interval || !strategy || !config) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, interval, strategy, config'
      });
    }

    // Validate config
    const backtestConfig: BacktestConfig = {
      initialBalance: config.initialBalance || 10000,
      positionSize: config.positionSize || 10,
      stopLoss: config.stopLoss || 2,
      takeProfit: config.takeProfit || 3,
      maxPositions: config.maxPositions || 1,
      slippage: config.slippage || 0.1,
      tradingFees: config.tradingFees || 0.1,
      makerFees: config.makerFees || 0.075,
      takerFees: config.takerFees || 0.1,
      useMakerFees: config.useMakerFees || false
    };

    // Run backtest first to get trades
    const backtestResult = await backtestService.runBacktest({
      symbol,
      interval,
      strategy,
      startTime,
      endTime,
      config: backtestConfig
    });

    if (!backtestResult.success || !backtestResult.data) {
      return res.status(400).json(backtestResult);
    }

    const trades = backtestResult.data.trades;

    // Calculate advanced risk metrics
    const riskMetrics = {
      var95: backtestService.calculateVaR(trades, 0.95),
      var99: backtestService.calculateVaR(trades, 0.99),
      expectedShortfall95: backtestService.calculateExpectedShortfall(trades, 0.95),
      expectedShortfall99: backtestService.calculateExpectedShortfall(trades, 0.99),
      omegaRatio: backtestService.calculateOmegaRatio(trades, 0),
      ulcerIndex: backtestService.calculateUlcerIndex(trades, backtestConfig),
      performance: backtestResult.data.performance
    };

    res.json({
      success: true,
      data: riskMetrics
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/backtest/compare
 * So sánh nhiều strategies
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      interval,
      startTime,
      endTime,
      config,
      strategies
    } = req.body;

    // Validate required fields
    if (!symbol || !interval || !config || !strategies || !Array.isArray(strategies)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, interval, config, strategies (array)'
      });
    }

    // Validate config
    const backtestConfig: BacktestConfig = {
      initialBalance: config.initialBalance || 10000,
      positionSize: config.positionSize || 10,
      stopLoss: config.stopLoss || 2,
      takeProfit: config.takeProfit || 3,
      maxPositions: config.maxPositions || 1,
      slippage: config.slippage || 0.1,
      tradingFees: config.tradingFees || 0.1,
      makerFees: config.makerFees || 0.075,
      takerFees: config.takerFees || 0.1,
      useMakerFees: config.useMakerFees || false
    };

    const comparisonResults = [];

    for (const strategy of strategies) {
      try {
        const result = await backtestService.runBacktest({
          symbol,
          interval,
          strategy,
          startTime,
          endTime,
          config: backtestConfig
        });

        if (result.success && result.data) {
          comparisonResults.push({
            strategy,
            performance: result.data.performance,
            totalTrades: result.data.trades.length,
            success: true
          });
        } else {
          comparisonResults.push({
            strategy,
            error: result.error,
            success: false
          });
        }
      } catch (error) {
        comparisonResults.push({
          strategy,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }

    // Sort by Sharpe ratio
    const successfulResults = comparisonResults.filter(r => r.success);
    successfulResults.sort((a, b) => {
      if (!a.performance || !b.performance) return 0;
      return b.performance.netSharpeRatio - a.performance.netSharpeRatio;
    });

    res.json({
      success: true,
      data: {
        results: comparisonResults,
        ranking: successfulResults.map(r => r.strategy),
        bestStrategy: successfulResults.length > 0 ? successfulResults[0].strategy : null
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router; 