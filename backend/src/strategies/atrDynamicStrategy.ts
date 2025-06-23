import { BaseStrategy, StrategySignal, BacktestConfig } from './baseStrategy';
import { HistoricalCandle } from '../services/historicalDataService';
import { IndicatorSignals } from '../types/trading.types';

export class ATRDynamicStrategy extends BaseStrategy {
  private atrPeriod: number;
  private atrMultiplier: number;
  private volatilityThreshold: number;
  private rsiPeriod: number;
  private rsiOverbought: number;
  private rsiOversold: number;
  private volumeThreshold: number;

  constructor(config: BacktestConfig) {
    super('ATR Dynamic Strategy', 30, config);
    this.atrPeriod = 14;
    this.atrMultiplier = 2.0; // ATR multiplier for stop loss
    this.volatilityThreshold = 0.02; // 2% volatility threshold
    this.rsiPeriod = 14;
    this.rsiOverbought = 70;
    this.rsiOversold = 30;
    this.volumeThreshold = 1.3; // 130% of average volume
  }

  analyzeSignal(candles: HistoricalCandle[], indicators: IndicatorSignals): StrategySignal {
    if (!this.hasEnoughData(candles)) {
      return {
        action: 'HOLD',
        confidence: 0,
        reason: 'Insufficient data',
        price: candles[candles.length - 1].close,
        timestamp: candles[candles.length - 1].openTime
      };
    }

    const currentCandle = candles[candles.length - 1];
    const prices = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    // Calculate ATR
    const atr = this.calculateATR(highs, lows, prices, this.atrPeriod);
    const currentATR = atr[atr.length - 1];
    const averageATR = atr.slice(-10).reduce((sum, val) => sum + val, 0) / 10;

    // Calculate RSI
    const rsi = this.calculateRSI(prices, this.rsiPeriod);
    const currentRSI = rsi[rsi.length - 1];

    // Calculate volume analysis
    const volumeAnalysis = this.analyzeVolume(volumes);
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / volumeAnalysis.averageVolume;

    // Calculate volatility
    const volatility = currentATR / currentCandle.close;
    const isHighVolatility = volatility > this.volatilityThreshold;

    // ATR-based signal logic
    let signal = 'HOLD';
    let confidence = 0;
    let reason = '';

    // Volatility breakout signal
    if (isHighVolatility && volumeRatio >= this.volumeThreshold) {
      // Bullish breakout
      if (currentRSI < this.rsiOverbought && this.isPriceBreakingOut(prices, 'up')) {
        signal = 'BUY';
        confidence = 0.8;
        reason = `Volatility breakout (${(volatility * 100).toFixed(2)}%) with volume spike (${volumeRatio.toFixed(2)}x) and RSI ${currentRSI.toFixed(1)}`;
      }
      // Bearish breakout
      else if (currentRSI > this.rsiOversold && this.isPriceBreakingOut(prices, 'down')) {
        signal = 'SELL';
        confidence = 0.8;
        reason = `Volatility breakdown (${(volatility * 100).toFixed(2)}%) with volume spike (${volumeRatio.toFixed(2)}x) and RSI ${currentRSI.toFixed(1)}`;
      }
    }
    // ATR contraction/expansion signal
    else if (this.detectATRPattern(atr)) {
      if (currentRSI < this.rsiOverbought && volumeRatio >= 1.1) {
        signal = 'BUY';
        confidence = 0.7;
        reason = `ATR pattern bullish with moderate volume (${volumeRatio.toFixed(2)}x) and RSI ${currentRSI.toFixed(1)}`;
      } else if (currentRSI > this.rsiOversold && volumeRatio >= 1.1) {
        signal = 'SELL';
        confidence = 0.7;
        reason = `ATR pattern bearish with moderate volume (${volumeRatio.toFixed(2)}x) and RSI ${currentRSI.toFixed(1)}`;
      }
    }
    // Mean reversion in low volatility
    else if (!isHighVolatility && this.detectMeanReversion(prices, rsi)) {
      if (currentRSI < 40 && volumeRatio >= 1.2) {
        signal = 'BUY';
        confidence = 0.6;
        reason = `Mean reversion bullish in low volatility with RSI ${currentRSI.toFixed(1)}`;
      } else if (currentRSI > 60 && volumeRatio >= 1.2) {
        signal = 'SELL';
        confidence = 0.6;
        reason = `Mean reversion bearish in low volatility with RSI ${currentRSI.toFixed(1)}`;
      }
    }

    return {
      action: signal as 'BUY' | 'SELL' | 'HOLD',
      confidence,
      reason,
      price: currentCandle.close,
      timestamp: currentCandle.openTime
    };
  }

  /**
   * Calculate dynamic stop loss based on ATR
   */
  getDynamicStopLoss(entryPrice: number, isLong: boolean, atr: number): number {
    const stopDistance = atr * this.atrMultiplier;
    return isLong ? entryPrice - stopDistance : entryPrice + stopDistance;
  }

  /**
   * Calculate position size based on ATR and risk
   */
  calculatePositionSize(balance: number, entryPrice: number, stopLoss: number, atr: number): number {
    const riskAmount = balance * (this.config.positionSize / 100);
    const stopDistance = Math.abs(entryPrice - stopLoss);
    const positionSize = riskAmount / stopDistance;
    
    // Adjust for volatility (smaller position in high volatility)
    const volatilityAdjustment = Math.min(1, 0.02 / (atr / entryPrice));
    
    return positionSize * volatilityAdjustment;
  }

  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const trueRanges: number[] = [];
    
    // Calculate True Range
    for (let i = 1; i < highs.length; i++) {
      const highLow = highs[i] - lows[i];
      const highClose = Math.abs(highs[i] - closes[i - 1]);
      const lowClose = Math.abs(lows[i] - closes[i - 1]);
      
      const trueRange = Math.max(highLow, highClose, lowClose);
      trueRanges.push(trueRange);
    }

    // Calculate ATR using EMA
    const atr: number[] = [];
    let sum = 0;
    
    // First ATR is SMA
    for (let i = 0; i < period; i++) {
      sum += trueRanges[i];
    }
    atr.push(sum / period);

    // Calculate ATR using EMA
    const multiplier = 2 / (period + 1);
    for (let i = period; i < trueRanges.length; i++) {
      const newATR = (trueRanges[i] - atr[atr.length - 1]) * multiplier + atr[atr.length - 1];
      atr.push(newATR);
    }

    return atr;
  }

  private calculateRSI(prices: number[], period: number): number[] {
    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

    // Calculate first RSI
    const rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));

    // Calculate subsequent RSI values
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }

    return rsi;
  }

  private analyzeVolume(volumes: number[]): { averageVolume: number, volumeTrend: number } {
    const recentVolumes = volumes.slice(-20);
    const averageVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    const volumeTrend = recentVolumes[recentVolumes.length - 1] - recentVolumes[0];

    return { averageVolume, volumeTrend };
  }

  private isPriceBreakingOut(prices: number[], direction: 'up' | 'down'): boolean {
    if (prices.length < 10) return false;

    const recentPrices = prices.slice(-5);
    const previousPrices = prices.slice(-10, -5);

    if (direction === 'up') {
      const recentHigh = Math.max(...recentPrices);
      const previousHigh = Math.max(...previousPrices);
      return recentHigh > previousHigh;
    } else {
      const recentLow = Math.min(...recentPrices);
      const previousLow = Math.min(...previousPrices);
      return recentLow < previousLow;
    }
  }

  private detectATRPattern(atr: number[]): boolean {
    if (atr.length < 10) return false;

    const recentATR = atr.slice(-5);
    const previousATR = atr.slice(-10, -5);

    // Check for ATR expansion (increasing volatility)
    const recentAvg = recentATR.reduce((sum, val) => sum + val, 0) / recentATR.length;
    const previousAvg = previousATR.reduce((sum, val) => sum + val, 0) / previousATR.length;

    return recentAvg > previousAvg * 1.1; // 10% increase in ATR
  }

  private detectMeanReversion(prices: number[], rsi: number[]): boolean {
    if (prices.length < 20 || rsi.length < 20) return false;

    const recentPrices = prices.slice(-5);
    const recentRSI = rsi.slice(-5);

    // Check for oversold/overbought conditions with price stabilization
    const currentRSI = recentRSI[recentRSI.length - 1];
    const priceChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];

    return (currentRSI < 40 && priceChange > 0) || (currentRSI > 60 && priceChange < 0);
  }
} 