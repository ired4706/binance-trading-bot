import { BaseStrategy, StrategySignal, BacktestConfig } from './baseStrategy';
import { HistoricalCandle } from '../services/historicalDataService';
import { IndicatorSignals } from '../types/trading.types';

export interface MTFData {
  timeframe: string;
  candles: HistoricalCandle[];
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number; // 0-1
  ema20: number;
  ema50: number;
  rsi: number;
}

export class MTFTrendStrategy extends BaseStrategy {
  private timeframes: string[];
  private rsiPeriod: number;
  private rsiOverbought: number;
  private rsiOversold: number;
  private volumeThreshold: number;
  private trendStrengthThreshold: number;

  constructor(config: BacktestConfig) {
    super('Multi-Timeframe Trend Strategy', 100, config);
    this.timeframes = ['15m', '1h', '4h']; // Lower to higher timeframes
    this.rsiPeriod = 14;
    this.rsiOverbought = 70;
    this.rsiOversold = 30;
    this.volumeThreshold = 1.2;
    this.trendStrengthThreshold = 0.6;
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
    const volumes = candles.map(c => c.volume);

    // Analyze current timeframe
    const currentTimeframeAnalysis = this.analyzeTimeframe(candles);
    
    // For demo purposes, we'll simulate MTF analysis
    // In a real implementation, you'd fetch data for different timeframes
    const mtfAnalysis = this.simulateMTFAnalysis(currentTimeframeAnalysis);

    // Calculate volume analysis
    const volumeAnalysis = this.analyzeVolume(volumes);
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / volumeAnalysis.averageVolume;

    // MTF Signal Logic
    let signal = 'HOLD';
    let confidence = 0;
    let reason = '';

    // Strong bullish signal with MTF confirmation
    if (this.isStrongBullishSignal(currentTimeframeAnalysis, mtfAnalysis) && volumeRatio >= this.volumeThreshold) {
      signal = 'BUY';
      confidence = 0.9;
      reason = `Strong bullish MTF trend (${mtfAnalysis.bullishCount}/${mtfAnalysis.totalTimeframes} timeframes) with volume spike (${volumeRatio.toFixed(2)}x)`;
    }
    // Strong bearish signal with MTF confirmation
    else if (this.isStrongBearishSignal(currentTimeframeAnalysis, mtfAnalysis) && volumeRatio >= this.volumeThreshold) {
      signal = 'SELL';
      confidence = 0.9;
      reason = `Strong bearish MTF trend (${mtfAnalysis.bearishCount}/${mtfAnalysis.totalTimeframes} timeframes) with volume spike (${volumeRatio.toFixed(2)}x)`;
    }
    // Moderate signal with partial MTF confirmation
    else if (this.isModerateBullishSignal(currentTimeframeAnalysis, mtfAnalysis) && volumeRatio >= 1.1) {
      signal = 'BUY';
      confidence = 0.7;
      reason = `Moderate bullish MTF trend (${mtfAnalysis.bullishCount}/${mtfAnalysis.totalTimeframes} timeframes) with moderate volume`;
    }
    else if (this.isModerateBearishSignal(currentTimeframeAnalysis, mtfAnalysis) && volumeRatio >= 1.1) {
      signal = 'SELL';
      confidence = 0.7;
      reason = `Moderate bearish MTF trend (${mtfAnalysis.bearishCount}/${mtfAnalysis.totalTimeframes} timeframes) with moderate volume`;
    }
    // Counter-trend opportunity (higher risk)
    else if (this.isCounterTrendOpportunity(currentTimeframeAnalysis, mtfAnalysis) && volumeRatio >= 1.5) {
      if (currentTimeframeAnalysis.rsi < this.rsiOversold) {
        signal = 'BUY';
        confidence = 0.5;
        reason = `Counter-trend bullish opportunity with oversold RSI (${currentTimeframeAnalysis.rsi.toFixed(1)}) and high volume`;
      } else if (currentTimeframeAnalysis.rsi > this.rsiOverbought) {
        signal = 'SELL';
        confidence = 0.5;
        reason = `Counter-trend bearish opportunity with overbought RSI (${currentTimeframeAnalysis.rsi.toFixed(1)}) and high volume`;
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

  private analyzeTimeframe(candles: HistoricalCandle[]): MTFData {
    const prices = candles.map(c => c.close);
    const ema20 = this.calculateEMA(prices, 20);
    const ema50 = this.calculateEMA(prices, 50);
    const rsi = this.calculateRSI(prices, this.rsiPeriod);

    const currentEMA20 = ema20[ema20.length - 1];
    const currentEMA50 = ema50[ema50.length - 1];
    const currentRSI = rsi[rsi.length - 1];

    // Determine trend
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let strength = 0;

    if (currentEMA20 > currentEMA50) {
      trend = 'BULLISH';
      strength = Math.min(1, (currentEMA20 - currentEMA50) / currentEMA50);
    } else if (currentEMA20 < currentEMA50) {
      trend = 'BEARISH';
      strength = Math.min(1, (currentEMA50 - currentEMA20) / currentEMA50);
    }

    return {
      timeframe: 'current',
      candles,
      trend,
      strength,
      ema20: currentEMA20,
      ema50: currentEMA50,
      rsi: currentRSI
    };
  }

  private simulateMTFAnalysis(currentAnalysis: MTFData): {
    bullishCount: number;
    bearishCount: number;
    neutralCount: number;
    totalTimeframes: number;
    averageStrength: number;
  } {
    // Simulate MTF analysis based on current timeframe
    // In real implementation, you'd analyze actual data from different timeframes
    
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;
    let totalStrength = 0;

    // Simulate higher timeframe analysis
    if (currentAnalysis.trend === 'BULLISH') {
      bullishCount = 2; // Higher timeframes tend to follow current trend
      bearishCount = 0;
      neutralCount = 1;
      totalStrength = currentAnalysis.strength * 2.5;
    } else if (currentAnalysis.trend === 'BEARISH') {
      bullishCount = 0;
      bearishCount = 2;
      neutralCount = 1;
      totalStrength = currentAnalysis.strength * 2.5;
    } else {
      bullishCount = 1;
      bearishCount = 1;
      neutralCount = 1;
      totalStrength = currentAnalysis.strength;
    }

    return {
      bullishCount,
      bearishCount,
      neutralCount,
      totalTimeframes: 3,
      averageStrength: totalStrength / 3
    };
  }

  private isStrongBullishSignal(currentAnalysis: MTFData, mtfAnalysis: any): boolean {
    return currentAnalysis.trend === 'BULLISH' && 
           currentAnalysis.strength >= this.trendStrengthThreshold &&
           mtfAnalysis.bullishCount >= 2 &&
           currentAnalysis.rsi < this.rsiOverbought;
  }

  private isStrongBearishSignal(currentAnalysis: MTFData, mtfAnalysis: any): boolean {
    return currentAnalysis.trend === 'BEARISH' && 
           currentAnalysis.strength >= this.trendStrengthThreshold &&
           mtfAnalysis.bearishCount >= 2 &&
           currentAnalysis.rsi > this.rsiOversold;
  }

  private isModerateBullishSignal(currentAnalysis: MTFData, mtfAnalysis: any): boolean {
    return currentAnalysis.trend === 'BULLISH' && 
           mtfAnalysis.bullishCount >= 1 &&
           currentAnalysis.rsi < this.rsiOverbought;
  }

  private isModerateBearishSignal(currentAnalysis: MTFData, mtfAnalysis: any): boolean {
    return currentAnalysis.trend === 'BEARISH' && 
           mtfAnalysis.bearishCount >= 1 &&
           currentAnalysis.rsi > this.rsiOversold;
  }

  private isCounterTrendOpportunity(currentAnalysis: MTFData, mtfAnalysis: any): boolean {
    // Look for counter-trend opportunities when MTF is mixed
    return mtfAnalysis.bullishCount === 1 && mtfAnalysis.bearishCount === 1 && 
           (currentAnalysis.rsi < this.rsiOversold || currentAnalysis.rsi > this.rsiOverbought);
  }

  private calculateEMA(data: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // First EMA is SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i];
    }
    ema.push(sum / period);

    // Calculate EMA
    for (let i = period; i < data.length; i++) {
      const newEMA = (data[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(newEMA);
    }

    return ema;
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
} 