import { BaseStrategy, StrategySignal, BacktestConfig } from './baseStrategy';
import { HistoricalCandle } from '../services/historicalDataService';
import { IndicatorSignals } from '../types/trading.types';

export class StochasticRsiStrategy extends BaseStrategy {
  private stochasticKPeriod: number;
  private stochasticDPeriod: number;
  private stochasticSlowing: number;
  private rsiPeriod: number;
  private rsiOverbought: number;
  private rsiOversold: number;
  private volumeThreshold: number;
  private divergenceLookback: number;

  constructor(config: BacktestConfig) {
    super('Stochastic + RSI Mean Reversion Strategy', 40, config);
    this.stochasticKPeriod = 14;
    this.stochasticDPeriod = 3;
    this.stochasticSlowing = 3;
    this.rsiPeriod = 14;
    this.rsiOverbought = 70;
    this.rsiOversold = 30;
    this.volumeThreshold = 1.3;
    this.divergenceLookback = 10;
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

    // Calculate Stochastic
    const stochastic = this.calculateStochastic(highs, lows, prices);
    const kLine = stochastic.kLine;
    const dLine = stochastic.dLine;

    // Calculate RSI
    const rsi = this.calculateRSI(prices, this.rsiPeriod);
    const currentRSI = rsi[rsi.length - 1];

    // Calculate volume analysis
    const volumeAnalysis = this.analyzeVolume(volumes);
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / volumeAnalysis.averageVolume;

    // Detect divergences
    const rsiDivergence = this.detectRSIDivergence(prices, rsi);
    const stochasticDivergence = this.detectStochasticDivergence(prices, kLine);

    // Mean Reversion Signal Logic
    let signal = 'HOLD';
    let confidence = 0;
    let reason = '';

    // Strong oversold signal with divergence
    if (this.isStrongOversoldSignal(kLine, dLine, currentRSI, rsiDivergence, stochasticDivergence)) {
      if (volumeRatio >= this.volumeThreshold) {
        signal = 'BUY';
        confidence = 0.8;
        reason = `Strong oversold signal: Stochastic K=${kLine[kLine.length - 1].toFixed(1)}, D=${dLine[dLine.length - 1].toFixed(1)}, RSI=${currentRSI.toFixed(1)} with divergence and volume spike (${volumeRatio.toFixed(2)}x)`;
      } else if (volumeRatio >= 1.1) {
        signal = 'BUY';
        confidence = 0.6;
        reason = `Oversold signal: Stochastic K=${kLine[kLine.length - 1].toFixed(1)}, D=${dLine[dLine.length - 1].toFixed(1)}, RSI=${currentRSI.toFixed(1)} with moderate volume`;
      }
    }
    // Strong overbought signal with divergence
    else if (this.isStrongOverboughtSignal(kLine, dLine, currentRSI, rsiDivergence, stochasticDivergence)) {
      if (volumeRatio >= this.volumeThreshold) {
        signal = 'SELL';
        confidence = 0.8;
        reason = `Strong overbought signal: Stochastic K=${kLine[kLine.length - 1].toFixed(1)}, D=${dLine[dLine.length - 1].toFixed(1)}, RSI=${currentRSI.toFixed(1)} with divergence and volume spike (${volumeRatio.toFixed(2)}x)`;
      } else if (volumeRatio >= 1.1) {
        signal = 'SELL';
        confidence = 0.6;
        reason = `Overbought signal: Stochastic K=${kLine[kLine.length - 1].toFixed(1)}, D=${dLine[dLine.length - 1].toFixed(1)}, RSI=${currentRSI.toFixed(1)} with moderate volume`;
      }
    }
    // Stochastic crossover signals
    else if (this.isStochasticCrossover(kLine, dLine, currentRSI)) {
      if (kLine[kLine.length - 1] < 30 && dLine[dLine.length - 1] < 30) {
        signal = 'BUY';
        confidence = 0.7;
        reason = `Stochastic bullish crossover in oversold zone: K=${kLine[kLine.length - 1].toFixed(1)}, D=${dLine[dLine.length - 1].toFixed(1)}, RSI=${currentRSI.toFixed(1)}`;
      } else if (kLine[kLine.length - 1] > 70 && dLine[dLine.length - 1] > 70) {
        signal = 'SELL';
        confidence = 0.7;
        reason = `Stochastic bearish crossover in overbought zone: K=${kLine[kLine.length - 1].toFixed(1)}, D=${dLine[dLine.length - 1].toFixed(1)}, RSI=${currentRSI.toFixed(1)}`;
      }
    }
    // RSI extreme levels with stochastic confirmation
    else if (this.isRSIExtremeWithStochasticConfirmation(kLine, dLine, currentRSI)) {
      if (currentRSI < 25 && kLine[kLine.length - 1] < 20) {
        signal = 'BUY';
        confidence = 0.6;
        reason = `Extreme oversold: RSI=${currentRSI.toFixed(1)}, Stochastic K=${kLine[kLine.length - 1].toFixed(1)}`;
      } else if (currentRSI > 75 && kLine[kLine.length - 1] > 80) {
        signal = 'SELL';
        confidence = 0.6;
        reason = `Extreme overbought: RSI=${currentRSI.toFixed(1)}, Stochastic K=${kLine[kLine.length - 1].toFixed(1)}`;
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

  private calculateStochastic(highs: number[], lows: number[], closes: number[]): { kLine: number[], dLine: number[] } {
    const kLine: number[] = [];
    
    // Calculate %K
    for (let i = this.stochasticKPeriod - 1; i < closes.length; i++) {
      const periodHigh = Math.max(...highs.slice(i - this.stochasticKPeriod + 1, i + 1));
      const periodLow = Math.min(...lows.slice(i - this.stochasticKPeriod + 1, i + 1));
      const currentClose = closes[i];
      
      const kValue = ((currentClose - periodLow) / (periodHigh - periodLow)) * 100;
      kLine.push(kValue);
    }

    // Calculate %D (SMA of %K)
    const dLine: number[] = [];
    for (let i = this.stochasticDPeriod - 1; i < kLine.length; i++) {
      const dValue = kLine.slice(i - this.stochasticDPeriod + 1, i + 1).reduce((sum, val) => sum + val, 0) / this.stochasticDPeriod;
      dLine.push(dValue);
    }

    return { kLine, dLine };
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

  private detectRSIDivergence(prices: number[], rsi: number[]): { bullish: boolean; bearish: boolean } {
    if (prices.length < this.divergenceLookback || rsi.length < this.divergenceLookback) {
      return { bullish: false, bearish: false };
    }

    const recentPrices = prices.slice(-this.divergenceLookback);
    const recentRSI = rsi.slice(-this.divergenceLookback);

    // Check for bullish divergence (price lower lows, RSI higher lows)
    const priceLowerLow = recentPrices[recentPrices.length - 1] < recentPrices[0];
    const rsiHigherLow = recentRSI[recentRSI.length - 1] > recentRSI[0];

    // Check for bearish divergence (price higher highs, RSI lower highs)
    const priceHigherHigh = recentPrices[recentPrices.length - 1] > recentPrices[0];
    const rsiLowerHigh = recentRSI[recentRSI.length - 1] < recentRSI[0];

    return {
      bullish: priceLowerLow && rsiHigherLow,
      bearish: priceHigherHigh && rsiLowerHigh
    };
  }

  private detectStochasticDivergence(prices: number[], kLine: number[]): { bullish: boolean; bearish: boolean } {
    if (prices.length < this.divergenceLookback || kLine.length < this.divergenceLookback) {
      return { bullish: false, bearish: false };
    }

    const recentPrices = prices.slice(-this.divergenceLookback);
    const recentK = kLine.slice(-this.divergenceLookback);

    // Check for bullish divergence (price lower lows, Stochastic higher lows)
    const priceLowerLow = recentPrices[recentPrices.length - 1] < recentPrices[0];
    const kHigherLow = recentK[recentK.length - 1] > recentK[0];

    // Check for bearish divergence (price higher highs, Stochastic lower highs)
    const priceHigherHigh = recentPrices[recentPrices.length - 1] > recentPrices[0];
    const kLowerHigh = recentK[recentK.length - 1] < recentK[0];

    return {
      bullish: priceLowerLow && kHigherLow,
      bearish: priceHigherHigh && kLowerHigh
    };
  }

  private isStrongOversoldSignal(kLine: number[], dLine: number[], rsi: number, rsiDivergence: any, stochasticDivergence: any): boolean {
    const currentK = kLine[kLine.length - 1];
    const currentD = dLine[dLine.length - 1];
    
    return currentK < 20 && currentD < 20 && rsi < this.rsiOversold && 
           (rsiDivergence.bullish || stochasticDivergence.bullish);
  }

  private isStrongOverboughtSignal(kLine: number[], dLine: number[], rsi: number, rsiDivergence: any, stochasticDivergence: any): boolean {
    const currentK = kLine[kLine.length - 1];
    const currentD = dLine[dLine.length - 1];
    
    return currentK > 80 && currentD > 80 && rsi > this.rsiOverbought && 
           (rsiDivergence.bearish || stochasticDivergence.bearish);
  }

  private isStochasticCrossover(kLine: number[], dLine: number[], rsi: number): boolean {
    if (kLine.length < 2 || dLine.length < 2) return false;

    const currentK = kLine[kLine.length - 1];
    const previousK = kLine[kLine.length - 2];
    const currentD = dLine[dLine.length - 1];
    const previousD = dLine[dLine.length - 2];

    // Bullish crossover: K crosses above D
    const bullishCrossover = previousK <= previousD && currentK > currentD;
    
    // Bearish crossover: K crosses below D
    const bearishCrossover = previousK >= previousD && currentK < currentD;

    return bullishCrossover || bearishCrossover;
  }

  private isRSIExtremeWithStochasticConfirmation(kLine: number[], dLine: number[], rsi: number): boolean {
    const currentK = kLine[kLine.length - 1];
    
    return (rsi < 25 && currentK < 20) || (rsi > 75 && currentK > 80);
  }
} 