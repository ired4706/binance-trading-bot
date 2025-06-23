import { BaseStrategy, StrategySignal, BacktestConfig } from './baseStrategy';
import { HistoricalCandle } from '../services/historicalDataService';
import { IndicatorSignals } from '../types/trading.types';

export class MACDVolumeStrategy extends BaseStrategy {
  private macdFastPeriod: number;
  private macdSlowPeriod: number;
  private macdSignalPeriod: number;
  private volumeThreshold: number;
  private rsiPeriod: number;
  private rsiOverbought: number;
  private rsiOversold: number;

  constructor(config: BacktestConfig) {
    super('MACD + Volume Strategy', 50, config);
    this.macdFastPeriod = 12;
    this.macdSlowPeriod = 26;
    this.macdSignalPeriod = 9;
    this.volumeThreshold = 1.5; // Volume spike threshold (150% of average)
    this.rsiPeriod = 14;
    this.rsiOverbought = 70;
    this.rsiOversold = 30;
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

    // Calculate MACD
    const macd = this.calculateMACD(prices);
    const macdLine = macd.macdLine;
    const signalLine = macd.signalLine;
    const histogram = macd.histogram;

    // Calculate volume analysis
    const volumeAnalysis = this.analyzeVolume(volumes);
    const currentVolume = volumes[volumes.length - 1];
    const averageVolume = volumeAnalysis.averageVolume;
    const volumeRatio = currentVolume / averageVolume;

    // Calculate RSI for filter
    const rsi = this.calculateRSI(prices, this.rsiPeriod);
    const currentRSI = rsi[rsi.length - 1];

    // MACD Signal Logic
    let signal = 'HOLD';
    let confidence = 0;
    let reason = '';

    // Bullish Signal
    if (macdLine[macdLine.length - 1] > signalLine[signalLine.length - 1] && 
        macdLine[macdLine.length - 2] <= signalLine[signalLine.length - 2]) {
      
      // MACD bullish crossover
      if (volumeRatio >= this.volumeThreshold && currentRSI < this.rsiOverbought) {
        signal = 'BUY';
        confidence = 0.8;
        reason = `MACD bullish crossover with volume spike (${volumeRatio.toFixed(2)}x avg) and RSI ${currentRSI.toFixed(1)}`;
      } else if (volumeRatio >= 1.2 && currentRSI < this.rsiOverbought) {
        signal = 'BUY';
        confidence = 0.6;
        reason = `MACD bullish crossover with moderate volume (${volumeRatio.toFixed(2)}x avg) and RSI ${currentRSI.toFixed(1)}`;
      }
    }
    // Bearish Signal
    else if (macdLine[macdLine.length - 1] < signalLine[signalLine.length - 1] && 
             macdLine[macdLine.length - 2] >= signalLine[signalLine.length - 2]) {
      
      // MACD bearish crossover
      if (volumeRatio >= this.volumeThreshold && currentRSI > this.rsiOversold) {
        signal = 'SELL';
        confidence = 0.8;
        reason = `MACD bearish crossover with volume spike (${volumeRatio.toFixed(2)}x avg) and RSI ${currentRSI.toFixed(1)}`;
      } else if (volumeRatio >= 1.2 && currentRSI > this.rsiOversold) {
        signal = 'SELL';
        confidence = 0.6;
        reason = `MACD bearish crossover with moderate volume (${volumeRatio.toFixed(2)}x avg) and RSI ${currentRSI.toFixed(1)}`;
      }
    }
    // MACD Histogram Divergence
    else if (this.detectHistogramDivergence(histogram, prices)) {
      if (histogram[histogram.length - 1] > 0 && currentRSI < this.rsiOverbought) {
        signal = 'BUY';
        confidence = 0.7;
        reason = `MACD histogram bullish divergence with RSI ${currentRSI.toFixed(1)}`;
      } else if (histogram[histogram.length - 1] < 0 && currentRSI > this.rsiOversold) {
        signal = 'SELL';
        confidence = 0.7;
        reason = `MACD histogram bearish divergence with RSI ${currentRSI.toFixed(1)}`;
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

  private calculateMACD(prices: number[]): { macdLine: number[], signalLine: number[], histogram: number[] } {
    const ema12 = this.calculateEMA(prices, this.macdFastPeriod);
    const ema26 = this.calculateEMA(prices, this.macdSlowPeriod);
    
    const macdLine = ema12.map((fast, i) => fast - ema26[i]);
    const signalLine = this.calculateEMA(macdLine, this.macdSignalPeriod);
    const histogram = macdLine.map((macd, i) => macd - signalLine[i]);

    return { macdLine, signalLine, histogram };
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
    const recentVolumes = volumes.slice(-20); // Last 20 periods
    const averageVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    
    // Calculate volume trend (positive = increasing, negative = decreasing)
    const volumeTrend = recentVolumes[recentVolumes.length - 1] - recentVolumes[0];

    return { averageVolume, volumeTrend };
  }

  private detectHistogramDivergence(histogram: number[], prices: number[]): boolean {
    if (histogram.length < 10) return false;

    // Look for histogram divergence (price making higher highs but histogram making lower highs, or vice versa)
    const recentHistogram = histogram.slice(-5);
    const recentPrices = prices.slice(-5);

    // Check for bullish divergence (price lower lows, histogram higher lows)
    const priceLowerLow = recentPrices[recentPrices.length - 1] < recentPrices[0];
    const histogramHigherLow = recentHistogram[recentHistogram.length - 1] > recentHistogram[0];

    // Check for bearish divergence (price higher highs, histogram lower highs)
    const priceHigherHigh = recentPrices[recentPrices.length - 1] > recentPrices[0];
    const histogramLowerHigh = recentHistogram[recentHistogram.length - 1] < recentHistogram[0];

    return (priceLowerLow && histogramHigherLow) || (priceHigherHigh && histogramLowerHigh);
  }
} 