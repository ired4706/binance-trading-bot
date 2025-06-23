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
  entryFees: number;
  exitFees: number;
  entrySlippage: number;
  exitSlippage: number;
  netPnl: number;
  netPnlPercentage: number;
  exitReason: 'SIGNAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'END_OF_DATA';
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
  totalFees: number;
  totalSlippage: number;
  netTotalReturn: number;
  netTotalReturnPercentage: number;
  netWinRate: number;
  netProfitFactor: number;
  netMaxDrawdown: number;
  netMaxDrawdownPercentage: number;
  netSharpeRatio: number;
  calmarRatio: number;
  sortinoRatio: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  averageConsecutiveLosses: number;
  averageConsecutiveWins: number;
}

export interface BacktestConfig {
  initialBalance: number;
  positionSize: number; // Percentage of balance per trade
  stopLoss: number; // Percentage
  takeProfit: number; // Percentage
  maxPositions: number;
  slippage: number; // Percentage
  tradingFees: number;
  makerFees: number;
  takerFees: number;
  useMakerFees: boolean;
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

    // Basic metrics
    const totalReturn = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const totalFees = trades.reduce((sum, trade) => sum + trade.entryFees + trade.exitFees, 0);
    const totalSlippage = trades.reduce((sum, trade) => sum + trade.entrySlippage + trade.exitSlippage, 0);
    const netTotalReturn = trades.reduce((sum, trade) => sum + trade.netPnl, 0);
    
    const winningTrades = trades.filter(trade => trade.netPnl > 0);
    const losingTrades = trades.filter(trade => trade.netPnl < 0);
    
    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
    const netWinRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
    
    const averageWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, trade) => sum + trade.pnl, 0) / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? 
      Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0) / losingTrades.length) : 0;
    
    const netAverageWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, trade) => sum + trade.netPnl, 0) / winningTrades.length : 0;
    const netAverageLoss = losingTrades.length > 0 ? 
      Math.abs(losingTrades.reduce((sum, trade) => sum + trade.netPnl, 0) / losingTrades.length) : 0;
    
    const profitFactor = averageLoss > 0 ? averageWin / averageLoss : 0;
    const netProfitFactor = netAverageLoss > 0 ? netAverageWin / netAverageLoss : 0;
    
    // Calculate max drawdown (both gross and net)
    let maxDrawdown = 0;
    let netMaxDrawdown = 0;
    let peak = this.config.initialBalance;
    let netPeak = this.config.initialBalance;
    let runningBalance = this.config.initialBalance;
    let netRunningBalance = this.config.initialBalance;
    
    trades.forEach(trade => {
      runningBalance += trade.pnl;
      netRunningBalance += trade.netPnl;
      
      if (runningBalance > peak) {
        peak = runningBalance;
      }
      if (netRunningBalance > netPeak) {
        netPeak = netRunningBalance;
      }
      
      const drawdown = peak - runningBalance;
      const netDrawdown = netPeak - netRunningBalance;
      
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
      if (netDrawdown > netMaxDrawdown) {
        netMaxDrawdown = netDrawdown;
      }
    });

    // Calculate Sharpe Ratio (both gross and net)
    const returns = trades.map(trade => trade.pnlPercentage);
    const netReturns = trades.map(trade => trade.netPnlPercentage);
    
    const averageReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const netAverageReturn = netReturns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - averageReturn, 2), 0) / returns.length;
    const netVariance = netReturns.reduce((sum, ret) => sum + Math.pow(ret - netAverageReturn, 2), 0) / returns.length;
    
    const sharpeRatio = variance > 0 ? averageReturn / Math.sqrt(variance) : 0;
    const netSharpeRatio = netVariance > 0 ? netAverageReturn / Math.sqrt(netVariance) : 0;

    // Calculate Sortino Ratio (using downside deviation)
    const downsideReturns = returns.filter(ret => ret < 0);
    const netDownsideReturns = netReturns.filter(ret => ret < 0);
    
    const downsideVariance = downsideReturns.length > 0 ? 
      downsideReturns.reduce((sum, ret) => sum + Math.pow(ret, 2), 0) / downsideReturns.length : 0;
    const netDownsideVariance = netDownsideReturns.length > 0 ? 
      netDownsideReturns.reduce((sum, ret) => sum + Math.pow(ret, 2), 0) / netDownsideReturns.length : 0;
    
    const sortinoRatio = downsideVariance > 0 ? averageReturn / Math.sqrt(downsideVariance) : 0;

    // Calculate Calmar Ratio (annualized return / max drawdown)
    const totalDays = trades.length > 0 ? 
      (trades[trades.length - 1].exitTime - trades[0].entryTime) / (1000 * 60 * 60 * 24) : 1;
    const annualizedReturn = totalDays > 0 ? (netTotalReturn / this.config.initialBalance) * (365 / totalDays) : 0;
    const calmarRatio = netMaxDrawdown > 0 ? annualizedReturn / (netMaxDrawdown / this.config.initialBalance) : 0;

    // Calculate consecutive wins/losses
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;
    const consecutiveWins: number[] = [];
    const consecutiveLosses: number[] = [];
    
    trades.forEach(trade => {
      if (trade.netPnl > 0) {
        currentWins++;
        currentLosses = 0;
        if (currentWins > maxConsecutiveWins) {
          maxConsecutiveWins = currentWins;
        }
      } else if (trade.netPnl < 0) {
        if (currentWins > 0) {
          consecutiveWins.push(currentWins);
        }
        currentWins = 0;
        currentLosses++;
        if (currentLosses > maxConsecutiveLosses) {
          maxConsecutiveLosses = currentLosses;
        }
      }
    });
    
    // Add final streaks
    if (currentWins > 0) consecutiveWins.push(currentWins);
    if (currentLosses > 0) consecutiveLosses.push(currentLosses);
    
    const averageConsecutiveWins = consecutiveWins.length > 0 ? 
      consecutiveWins.reduce((sum, wins) => sum + wins, 0) / consecutiveWins.length : 0;
    const averageConsecutiveLosses = consecutiveLosses.length > 0 ? 
      consecutiveLosses.reduce((sum, losses) => sum + losses, 0) / consecutiveLosses.length : 0;

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
      averageTradeDuration,
      totalFees,
      totalSlippage,
      netTotalReturn,
      netTotalReturnPercentage: (netTotalReturn / this.config.initialBalance) * 100,
      netWinRate: netWinRate * 100,
      netProfitFactor,
      netMaxDrawdown,
      netMaxDrawdownPercentage: (netMaxDrawdown / this.config.initialBalance) * 100,
      netSharpeRatio,
      calmarRatio,
      sortinoRatio,
      maxConsecutiveLosses,
      maxConsecutiveWins,
      averageConsecutiveLosses,
      averageConsecutiveWins
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

  getName(): string {
    return this.name;
  }

  getRequiredCandles(): number {
    return this.requiredCandles;
  }
} 