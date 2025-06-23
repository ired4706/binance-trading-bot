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

export default router; 