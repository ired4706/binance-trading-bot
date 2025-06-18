import { HistoricalCandle } from '../services/historicalDataService';
import { IndicatorSignals } from '../types/trading.types';

export interface StrategySignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-1
  reason: string;
  price: number;
  timestamp: number;
}

export interface StrategyResult {
  signals: StrategySignal[];
  trades: Trade[];
  performance: PerformanceMetrics;
}

export interface Trade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  type: 'BUY' | 'SELL';
  quantity: number;
  pnl: number;
  pnlPercentage: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercentage: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  sharpeRatio: number;
  averageTradeDuration: number;
}

export interface BacktestConfig {
  initialBalance: number;
  positionSize: number; // Percentage of balance per trade
  stopLoss: number; // Percentage
  takeProfit: number; // Percentage
  maxPositions: number;
  slippage: number; // Percentage
}

export abstract class BaseStrategy {
  protected name: string;
  protected requiredCandles: number;
  protected config: BacktestConfig;

  constructor(name: string, requiredCandles: number, config: BacktestConfig) {
    this.name = name;
    this.requiredCandles = requiredCandles;
    this.config = config;
  }

  /**
   * Phân tích tín hiệu từ dữ liệu hiện tại
   */
  abstract analyzeSignal(
    candles: HistoricalCandle[], 
    indicators: IndicatorSignals
  ): StrategySignal;

  /**
   * Kiểm tra xem có đủ dữ liệu để phân tích không
   */
  hasEnoughData(candles: HistoricalCandle[]): boolean {
    return candles.length >= this.requiredCandles;
  }

  /**
   * Tính toán performance metrics
   */
  calculatePerformanceMetrics(trades: Trade[]): PerformanceMetrics {
    if (trades.length === 0) {
      return this.getEmptyPerformanceMetrics();
    }

    const totalReturn = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const winningTrades = trades.filter(trade => trade.pnl > 0);
    const losingTrades = trades.filter(trade => trade.pnl < 0);
    
    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
    const averageWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, trade) => sum + trade.pnl, 0) / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? 
      Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0) / losingTrades.length) : 0;
    
    const profitFactor = averageLoss > 0 ? averageWin / averageLoss : 0;
    
    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = 0;
    let runningBalance = this.config.initialBalance;
    
    trades.forEach(trade => {
      runningBalance += trade.pnl;
      if (runningBalance > peak) {
        peak = runningBalance;
      }
      const drawdown = peak - runningBalance;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    // Calculate Sharpe Ratio (simplified)
    const returns = trades.map(trade => trade.pnlPercentage);
    const averageReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - averageReturn, 2), 0) / returns.length;
    const sharpeRatio = variance > 0 ? averageReturn / Math.sqrt(variance) : 0;

    // Calculate average trade duration
    const totalDuration = trades.reduce((sum, trade) => sum + (trade.exitTime - trade.entryTime), 0);
    const averageTradeDuration = trades.length > 0 ? totalDuration / trades.length : 0;

    return {
      totalReturn,
      totalReturnPercentage: (totalReturn / this.config.initialBalance) * 100,
      winRate: winRate * 100,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      averageWin,
      averageLoss,
      profitFactor,
      maxDrawdown,
      maxDrawdownPercentage: (maxDrawdown / this.config.initialBalance) * 100,
      sharpeRatio,
      averageTradeDuration
    };
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
      averageTradeDuration: 0
    };
  }

  getName(): string {
    return this.name;
  }

  getRequiredCandles(): number {
    return this.requiredCandles;
  }
} 