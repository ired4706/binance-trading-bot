import { BaseStrategy, StrategySignal, BacktestConfig } from './baseStrategy';
import { HistoricalCandle } from '../services/historicalDataService';
import { IndicatorSignals } from '../types/trading.types';

export class BBSqueezeStrategy extends BaseStrategy {
  private bbPeriod: number;
  private bbStdDev: number;
  private keltnerPeriod: number;
  private keltnerMultiplier: number;
  private atrPeriod: number;
  private squeezeThreshold: number;
  private volumeThreshold: number;
  private breakoutConfirmation: number;
  private momentumPeriod: number;

  constructor(config: BacktestConfig) {
    super('Bollinger Bands Squeeze Strategy', 50, config);
    this.bbPeriod = 20;
    this.bbStdDev = 2;
    this.keltnerPeriod = 20;
    this.keltnerMultiplier = 1.5;
    this.atrPeriod = 14;
    this.squeezeThreshold = 0.5;
    this.volumeThreshold = 1.5;
    this.breakoutConfirmation = 2;
    this.momentumPeriod = 14;
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

    // Calculate Bollinger Bands
    const bb = this.calculateBollingerBands(prices);
    
    // Calculate Keltner Channels
    const keltner = this.calculateKeltnerChannels(highs, lows, prices);
    
    // Calculate ATR
    const atr = this.calculateATR(highs, lows, prices);
    
    // Calculate momentum indicators
    const momentum = this.calculateMomentum(prices);
    
    // Analyze squeeze conditions
    const squeezeAnalysis = this.analyzeSqueeze(bb, keltner, atr);
    
    // Analyze volume
    const volumeAnalysis = this.analyzeVolume(volumes);
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / volumeAnalysis.averageVolume;

    // Detect breakout signals
    const breakoutSignal = this.detectBreakout(currentCandle, bb, keltner, momentum, volumeRatio);

    let signal = 'HOLD';
    let confidence = 0;
    let reason = '';

    // Squeeze detection
    if (squeezeAnalysis.isSqueeze) {
      if (squeezeAnalysis.squeezeIntensity > 0.8) {
        signal = 'HOLD';
        confidence = 0.9;
        reason = `Strong squeeze detected: BB width=${squeezeAnalysis.bbWidth.toFixed(4)}, KC width=${squeezeAnalysis.kcWidth.toFixed(4)}, intensity=${squeezeAnalysis.squeezeIntensity.toFixed(2)}. Waiting for breakout.`;
      } else {
        signal = 'HOLD';
        confidence = 0.7;
        reason = `Moderate squeeze: BB width=${squeezeAnalysis.bbWidth.toFixed(4)}, KC width=${squeezeAnalysis.kcWidth.toFixed(4)}. Monitor for breakout.`;
      }
    }
    // Bullish breakout
    else if (breakoutSignal.bullish && volumeRatio >= this.volumeThreshold) {
      signal = 'BUY';
      confidence = Math.min(0.8 + (volumeRatio - this.volumeThreshold) * 0.2, 0.95);
      reason = `Bullish breakout: Price above BB upper=${bb.upper[bb.upper.length - 1].toFixed(4)}, KC upper=${keltner.upper[keltner.upper.length - 1].toFixed(4)}, volume spike ${volumeRatio.toFixed(2)}x, momentum=${momentum.current.toFixed(2)}`;
    }
    // Bearish breakout
    else if (breakoutSignal.bearish && volumeRatio >= this.volumeThreshold) {
      signal = 'SELL';
      confidence = Math.min(0.8 + (volumeRatio - this.volumeThreshold) * 0.2, 0.95);
      reason = `Bearish breakout: Price below BB lower=${bb.lower[bb.lower.length - 1].toFixed(4)}, KC lower=${keltner.lower[keltner.lower.length - 1].toFixed(4)}, volume spike ${volumeRatio.toFixed(2)}x, momentum=${momentum.current.toFixed(2)}`;
    }
    // Weak breakout with moderate volume
    else if (breakoutSignal.bullish && volumeRatio >= 1.2) {
      signal = 'BUY';
      confidence = 0.6;
      reason = `Weak bullish breakout: Price above BB upper, moderate volume ${volumeRatio.toFixed(2)}x, momentum=${momentum.current.toFixed(2)}`;
    }
    else if (breakoutSignal.bearish && volumeRatio >= 1.2) {
      signal = 'SELL';
      confidence = 0.6;
      reason = `Weak bearish breakout: Price below BB lower, moderate volume ${volumeRatio.toFixed(2)}x, momentum=${momentum.current.toFixed(2)}`;
    }
    // Momentum continuation
    else if (this.isMomentumContinuation(momentum, currentCandle, bb, keltner)) {
      if (momentum.current > 0 && momentum.trend > 0) {
        signal = 'BUY';
        confidence = 0.5;
        reason = `Momentum continuation: Positive momentum=${momentum.current.toFixed(2)}, trend=${momentum.trend.toFixed(2)}`;
      } else if (momentum.current < 0 && momentum.trend < 0) {
        signal = 'SELL';
        confidence = 0.5;
        reason = `Momentum continuation: Negative momentum=${momentum.current.toFixed(2)}, trend=${momentum.trend.toFixed(2)}`;
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

  private calculateBollingerBands(prices: number[]): { upper: number[], middle: number[], lower: number[], width: number[] } {
    const upper: number[] = [];
    const middle: number[] = [];
    const lower: number[] = [];
    const width: number[] = [];

    for (let i = this.bbPeriod - 1; i < prices.length; i++) {
      const periodPrices = prices.slice(i - this.bbPeriod + 1, i + 1);
      const sma = periodPrices.reduce((sum, price) => sum + price, 0) / this.bbPeriod;
      
      const variance = periodPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / this.bbPeriod;
      const stdDev = Math.sqrt(variance);
      
      const upperBand = sma + (this.bbStdDev * stdDev);
      const lowerBand = sma - (this.bbStdDev * stdDev);
      const bandWidth = (upperBand - lowerBand) / sma;

      upper.push(upperBand);
      middle.push(sma);
      lower.push(lowerBand);
      width.push(bandWidth);
    }

    return { upper, middle, lower, width };
  }

  private calculateKeltnerChannels(highs: number[], lows: number[], prices: number[]): { upper: number[], middle: number[], lower: number[], width: number[] } {
    const upper: number[] = [];
    const middle: number[] = [];
    const lower: number[] = [];
    const width: number[] = [];

    for (let i = this.keltnerPeriod - 1; i < prices.length; i++) {
      const periodPrices = prices.slice(i - this.keltnerPeriod + 1, i + 1);
      const periodHighs = highs.slice(i - this.keltnerPeriod + 1, i + 1);
      const periodLows = lows.slice(i - this.keltnerPeriod + 1, i + 1);
      
      const sma = periodPrices.reduce((sum, price) => sum + price, 0) / this.keltnerPeriod;
      
      const trueRanges = [];
      for (let j = 1; j < periodPrices.length; j++) {
        const tr = Math.max(
          periodHighs[j] - periodLows[j],
          Math.abs(periodHighs[j] - periodPrices[j - 1]),
          Math.abs(periodLows[j] - periodPrices[j - 1])
        );
        trueRanges.push(tr);
      }
      
      const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
      
      const upperChannel = sma + (this.keltnerMultiplier * atr);
      const lowerChannel = sma - (this.keltnerMultiplier * atr);
      const channelWidth = (upperChannel - lowerChannel) / sma;

      upper.push(upperChannel);
      middle.push(sma);
      lower.push(lowerChannel);
      width.push(channelWidth);
    }

    return { upper, middle, lower, width };
  }

  private calculateATR(highs: number[], lows: number[], prices: number[]): number[] {
    const atr: number[] = [];
    const trueRanges: number[] = [];

    // Calculate True Range
    for (let i = 1; i < prices.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - prices[i - 1]),
        Math.abs(lows[i] - prices[i - 1])
      );
      trueRanges.push(tr);
    }

    // Calculate ATR
    for (let i = this.atrPeriod - 1; i < trueRanges.length; i++) {
      const periodTR = trueRanges.slice(i - this.atrPeriod + 1, i + 1);
      const avgTR = periodTR.reduce((sum, tr) => sum + tr, 0) / this.atrPeriod;
      atr.push(avgTR);
    }

    return atr;
  }

  private calculateMomentum(prices: number[]): { current: number; trend: number; acceleration: number } {
    if (prices.length < this.momentumPeriod + 2) {
      return { current: 0, trend: 0, acceleration: 0 };
    }

    const currentMomentum = prices[prices.length - 1] - prices[prices.length - this.momentumPeriod - 1];
    const previousMomentum = prices[prices.length - 2] - prices[prices.length - this.momentumPeriod - 2];
    const trend = currentMomentum - previousMomentum;
    
    const currentAccel = prices[prices.length - 1] - 2 * prices[prices.length - 2] + prices[prices.length - 3];
    const previousAccel = prices[prices.length - 2] - 2 * prices[prices.length - 3] + prices[prices.length - 4];
    const acceleration = currentAccel - previousAccel;

    return { current: currentMomentum, trend, acceleration };
  }

  private analyzeSqueeze(bb: any, keltner: any, atr: number[]): { isSqueeze: boolean; squeezeIntensity: number; bbWidth: number; kcWidth: number } {
    if (bb.width.length < 2 || keltner.width.length < 2) {
      return { isSqueeze: false, squeezeIntensity: 0, bbWidth: 0, kcWidth: 0 };
    }

    const currentBBWidth = bb.width[bb.width.length - 1];
    const currentKCWidth = keltner.width[keltner.width.length - 1];
    const previousBBWidth = bb.width[bb.width.length - 2];
    const previousKCWidth = keltner.width[keltner.width.length - 2];

    // Check if BB is inside KC (squeeze condition)
    const isSqueeze = currentBBWidth < currentKCWidth;
    
    // Calculate squeeze intensity (0-1)
    const bbWidthRatio = currentBBWidth / previousBBWidth;
    const kcWidthRatio = currentKCWidth / previousKCWidth;
    const squeezeIntensity = Math.min(bbWidthRatio, kcWidthRatio);

    return {
      isSqueeze,
      squeezeIntensity,
      bbWidth: currentBBWidth,
      kcWidth: currentKCWidth
    };
  }

  private analyzeVolume(volumes: number[]): { averageVolume: number; volumeTrend: number; volumeVolatility: number } {
    const recentVolumes = volumes.slice(-20);
    const averageVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    
    const volumeChanges = [];
    for (let i = 1; i < recentVolumes.length; i++) {
      volumeChanges.push(recentVolumes[i] - recentVolumes[i - 1]);
    }
    
    const volumeTrend = volumeChanges.reduce((sum, change) => sum + change, 0) / volumeChanges.length;
    const volumeVolatility = Math.sqrt(volumeChanges.reduce((sum, change) => sum + Math.pow(change - volumeTrend, 2), 0) / volumeChanges.length);

    return { averageVolume, volumeTrend, volumeVolatility };
  }

  private detectBreakout(candle: HistoricalCandle, bb: any, keltner: any, momentum: any, volumeRatio: number): { bullish: boolean; bearish: boolean; strength: number } {
    const currentPrice = candle.close;
    const bbUpper = bb.upper[bb.upper.length - 1];
    const bbLower = bb.lower[bb.lower.length - 1];
    const kcUpper = keltner.upper[keltner.upper.length - 1];
    const kcLower = keltner.lower[keltner.lower.length - 1];

    let bullish = false;
    let bearish = false;
    let strength = 0;

    // Bullish breakout: price above both BB and KC upper bands
    if (currentPrice > bbUpper && currentPrice > kcUpper) {
      bullish = true;
      strength = Math.min((currentPrice - bbUpper) / bbUpper * 100, 5); // Max 5% strength
    }
    // Bearish breakout: price below both BB and KC lower bands
    else if (currentPrice < bbLower && currentPrice < kcLower) {
      bearish = true;
      strength = Math.min((bbLower - currentPrice) / bbLower * 100, 5); // Max 5% strength
    }
    // Weak breakout: price outside BB but inside KC
    else if (currentPrice > bbUpper && currentPrice <= kcUpper) {
      bullish = true;
      strength = 0.5;
    }
    else if (currentPrice < bbLower && currentPrice >= kcLower) {
      bearish = true;
      strength = 0.5;
    }

    return { bullish, bearish, strength };
  }

  private isMomentumContinuation(momentum: any, candle: HistoricalCandle, bb: any, keltner: any): boolean {
    const currentPrice = candle.close;
    const bbMiddle = bb.middle[bb.middle.length - 1];
    const kcMiddle = keltner.middle[keltner.middle.length - 1];

    // Check if price is in the middle zone and momentum is strong
    const inMiddleZone = currentPrice >= Math.min(bbMiddle, kcMiddle) && 
                        currentPrice <= Math.max(bbMiddle, kcMiddle);
    
    const strongMomentum = Math.abs(momentum.current) > Math.abs(momentum.trend) * 1.5;

    return inMiddleZone && strongMomentum;
  }
} 