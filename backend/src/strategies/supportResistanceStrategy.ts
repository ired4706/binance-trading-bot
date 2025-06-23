import { BaseStrategy, StrategySignal, BacktestConfig } from './baseStrategy';
import { HistoricalCandle } from '../services/historicalDataService';
import { IndicatorSignals } from '../types/trading.types';

interface PivotPoint {
  price: number;
  timestamp: number;
  type: 'support' | 'resistance';
  strength: number;
  touches: number;
  lastTouch: number;
}

interface MarketStructure {
  supports: PivotPoint[];
  resistances: PivotPoint[];
  currentTrend: 'bullish' | 'bearish' | 'sideways';
  trendStrength: number;
}

export class SupportResistanceStrategy extends BaseStrategy {
  private pivotLookback: number;
  private strengthThreshold: number;
  private volumeThreshold: number;
  private breakoutConfirmation: number;
  private trendPeriod: number;
  private consolidationThreshold: number;
  private retestTolerance: number;

  constructor(config: BacktestConfig) {
    super('Support/Resistance Breakout Strategy', 60, config);
    this.pivotLookback = 20;
    this.strengthThreshold = 3;
    this.volumeThreshold = 1.5;
    this.breakoutConfirmation = 2;
    this.trendPeriod = 14;
    this.consolidationThreshold = 0.02; // 2% range
    this.retestTolerance = 0.005; // 0.5% tolerance
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

    // Identify pivot points
    const pivotPoints = this.identifyPivotPoints(highs, lows, prices, candles);
    
    // Analyze market structure
    const marketStructure = this.analyzeMarketStructure(pivotPoints, currentCandle);
    
    // Calculate volume analysis
    const volumeAnalysis = this.analyzeVolume(volumes);
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / volumeAnalysis.averageVolume;

    // Detect breakout signals
    const breakoutSignal = this.detectBreakout(currentCandle, marketStructure, volumeRatio);
    
    // Detect retest signals
    const retestSignal = this.detectRetest(currentCandle, marketStructure, volumeRatio);

    let signal = 'HOLD';
    let confidence = 0;
    let reason = '';

    // Strong breakout with volume confirmation
    if (breakoutSignal.bullish && volumeRatio >= this.volumeThreshold) {
      signal = 'BUY';
      confidence = Math.min(0.8 + (volumeRatio - this.volumeThreshold) * 0.2, 0.95);
      reason = `Strong bullish breakout: Price above resistance ${breakoutSignal.level?.toFixed(4)}, volume spike ${volumeRatio.toFixed(2)}x, trend=${marketStructure.currentTrend}, strength=${breakoutSignal.strength.toFixed(2)}`;
    }
    else if (breakoutSignal.bearish && volumeRatio >= this.volumeThreshold) {
      signal = 'SELL';
      confidence = Math.min(0.8 + (volumeRatio - this.volumeThreshold) * 0.2, 0.95);
      reason = `Strong bearish breakout: Price below support ${breakoutSignal.level?.toFixed(4)}, volume spike ${volumeRatio.toFixed(2)}x, trend=${marketStructure.currentTrend}, strength=${breakoutSignal.strength.toFixed(2)}`;
    }
    // Retest signals
    else if (retestSignal.bullish && volumeRatio >= 1.2) {
      signal = 'BUY';
      confidence = 0.7;
      reason = `Bullish retest: Price bouncing off support ${retestSignal.level?.toFixed(4)}, volume ${volumeRatio.toFixed(2)}x, touches=${retestSignal.touches}`;
    }
    else if (retestSignal.bearish && volumeRatio >= 1.2) {
      signal = 'SELL';
      confidence = 0.7;
      reason = `Bearish retest: Price rejecting from resistance ${retestSignal.level?.toFixed(4)}, volume ${volumeRatio.toFixed(2)}x, touches=${retestSignal.touches}`;
    }
    // Weak breakout
    else if (breakoutSignal.bullish && volumeRatio >= 1.1) {
      signal = 'BUY';
      confidence = 0.6;
      reason = `Weak bullish breakout: Price above resistance ${breakoutSignal.level?.toFixed(4)}, moderate volume ${volumeRatio.toFixed(2)}x`;
    }
    else if (breakoutSignal.bearish && volumeRatio >= 1.1) {
      signal = 'SELL';
      confidence = 0.6;
      reason = `Weak bearish breakout: Price below support ${breakoutSignal.level?.toFixed(4)}, moderate volume ${volumeRatio.toFixed(2)}x`;
    }
    // Consolidation detection
    else if (this.isConsolidation(prices, marketStructure)) {
      signal = 'HOLD';
      confidence = 0.8;
      reason = `Consolidation detected: Price range ${this.getPriceRange(prices).toFixed(2)}%, waiting for breakout`;
    }
    // Trend continuation
    else if (this.isTrendContinuation(currentCandle, marketStructure, volumeRatio)) {
      if (marketStructure.currentTrend === 'bullish') {
        signal = 'BUY';
        confidence = 0.5;
        reason = `Trend continuation: Bullish trend strength=${marketStructure.trendStrength.toFixed(2)}`;
      } else if (marketStructure.currentTrend === 'bearish') {
        signal = 'SELL';
        confidence = 0.5;
        reason = `Trend continuation: Bearish trend strength=${marketStructure.trendStrength.toFixed(2)}`;
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

  private identifyPivotPoints(highs: number[], lows: number[], prices: number[], candles: HistoricalCandle[]): PivotPoint[] {
    const pivotPoints: PivotPoint[] = [];

    // Identify swing highs (resistance)
    for (let i = this.pivotLookback; i < highs.length - this.pivotLookback; i++) {
      const currentHigh = highs[i];
      let isPivot = true;

      // Check if current high is higher than surrounding highs
      for (let j = i - this.pivotLookback; j < i; j++) {
        if (highs[j] >= currentHigh) {
          isPivot = false;
          break;
        }
      }

      for (let j = i + 1; j <= i + this.pivotLookback; j++) {
        if (highs[j] >= currentHigh) {
          isPivot = false;
          break;
        }
      }

      if (isPivot) {
        pivotPoints.push({
          price: currentHigh,
          timestamp: candles[i].openTime,
          type: 'resistance',
          strength: 1,
          touches: 1,
          lastTouch: candles[i].openTime
        });
      }
    }

    // Identify swing lows (support)
    for (let i = this.pivotLookback; i < lows.length - this.pivotLookback; i++) {
      const currentLow = lows[i];
      let isPivot = true;

      // Check if current low is lower than surrounding lows
      for (let j = i - this.pivotLookback; j < i; j++) {
        if (lows[j] <= currentLow) {
          isPivot = false;
          break;
        }
      }

      for (let j = i + 1; j <= i + this.pivotLookback; j++) {
        if (lows[j] <= currentLow) {
          isPivot = false;
          break;
        }
      }

      if (isPivot) {
        pivotPoints.push({
          price: currentLow,
          timestamp: candles[i].openTime,
          type: 'support',
          strength: 1,
          touches: 1,
          lastTouch: candles[i].openTime
        });
      }
    }

    // Merge nearby pivot points and count touches
    return this.mergePivotPoints(pivotPoints, prices, candles);
  }

  private mergePivotPoints(pivotPoints: PivotPoint[], prices: number[], candles: HistoricalCandle[]): PivotPoint[] {
    const mergedPivots: PivotPoint[] = [];
    const tolerance = 0.01; // 1% tolerance for merging

    for (const pivot of pivotPoints) {
      let merged = false;

      for (const existing of mergedPivots) {
        if (existing.type === pivot.type && 
            Math.abs(existing.price - pivot.price) / existing.price < tolerance) {
          // Merge with existing pivot
          existing.touches++;
          existing.strength = Math.min(existing.strength + 0.5, 5);
          existing.lastTouch = Math.max(existing.lastTouch, pivot.lastTouch);
          merged = true;
          break;
        }
      }

      if (!merged) {
        mergedPivots.push(pivot);
      }
    }

    // Update touches by checking price interactions
    for (const pivot of mergedPivots) {
      let touches = 1;
      for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        const distance = Math.abs(price - pivot.price) / pivot.price;
        
        if (distance < this.retestTolerance) {
          touches++;
          pivot.lastTouch = Math.max(pivot.lastTouch, candles[i].openTime);
        }
      }
      pivot.touches = Math.max(pivot.touches, touches);
      pivot.strength = Math.min(pivot.strength + (touches - 1) * 0.3, 5);
    }

    return mergedPivots.filter(p => p.strength >= this.strengthThreshold);
  }

  private analyzeMarketStructure(pivotPoints: PivotPoint[], currentCandle: HistoricalCandle): MarketStructure {
    const supports = pivotPoints.filter(p => p.type === 'support' && p.price < currentCandle.close);
    const resistances = pivotPoints.filter(p => p.type === 'resistance' && p.price > currentCandle.close);

    // Sort by strength and recency
    supports.sort((a, b) => (b.strength * b.touches) - (a.strength * a.touches));
    resistances.sort((a, b) => (a.strength * a.touches) - (b.strength * b.touches));

    // Determine trend
    const nearestSupport = supports[0];
    const nearestResistance = resistances[0];
    
    let currentTrend: 'bullish' | 'bearish' | 'sideways' = 'sideways';
    let trendStrength = 0;

    if (nearestSupport && nearestResistance) {
      const supportDistance = (currentCandle.close - nearestSupport.price) / nearestSupport.price;
      const resistanceDistance = (nearestResistance.price - currentCandle.close) / nearestResistance.price;
      
      if (supportDistance > resistanceDistance * 1.5) {
        currentTrend = 'bullish';
        trendStrength = Math.min(supportDistance / resistanceDistance, 3);
      } else if (resistanceDistance > supportDistance * 1.5) {
        currentTrend = 'bearish';
        trendStrength = Math.min(resistanceDistance / supportDistance, 3);
      }
    }

    return {
      supports,
      resistances,
      currentTrend,
      trendStrength
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

  private detectBreakout(candle: HistoricalCandle, marketStructure: MarketStructure, volumeRatio: number): { bullish: boolean; bearish: boolean; level?: number; strength: number } {
    const currentPrice = candle.close;
    let bullish = false;
    let bearish = false;
    let level: number | undefined;
    let strength = 0;

    // Check for bullish breakout (above resistance)
    for (const resistance of marketStructure.resistances) {
      if (currentPrice > resistance.price && 
          resistance.strength >= this.strengthThreshold &&
          resistance.touches >= 2) {
        bullish = true;
        level = resistance.price;
        strength = resistance.strength * resistance.touches;
        break;
      }
    }

    // Check for bearish breakout (below support)
    for (const support of marketStructure.supports) {
      if (currentPrice < support.price && 
          support.strength >= this.strengthThreshold &&
          support.touches >= 2) {
        bearish = true;
        level = support.price;
        strength = support.strength * support.touches;
        break;
      }
    }

    return { bullish, bearish, level, strength };
  }

  private detectRetest(candle: HistoricalCandle, marketStructure: MarketStructure, volumeRatio: number): { bullish: boolean; bearish: boolean; level?: number; touches: number } {
    const currentPrice = candle.close;
    let bullish = false;
    let bearish = false;
    let level: number | undefined;
    let touches = 0;

    // Check for bullish retest (bounce off support)
    for (const support of marketStructure.supports) {
      const distance = Math.abs(currentPrice - support.price) / support.price;
      if (distance < this.retestTolerance && support.touches >= 2) {
        bullish = true;
        level = support.price;
        touches = support.touches;
        break;
      }
    }

    // Check for bearish retest (rejection from resistance)
    for (const resistance of marketStructure.resistances) {
      const distance = Math.abs(currentPrice - resistance.price) / resistance.price;
      if (distance < this.retestTolerance && resistance.touches >= 2) {
        bearish = true;
        level = resistance.price;
        touches = resistance.touches;
        break;
      }
    }

    return { bullish, bearish, level, touches };
  }

  private isConsolidation(prices: number[], marketStructure: MarketStructure): boolean {
    const priceRange = this.getPriceRange(prices);
    return priceRange < this.consolidationThreshold && marketStructure.currentTrend === 'sideways';
  }

  private getPriceRange(prices: number[]): number {
    const recentPrices = prices.slice(-this.trendPeriod);
    const max = Math.max(...recentPrices);
    const min = Math.min(...recentPrices);
    return (max - min) / min;
  }

  private isTrendContinuation(candle: HistoricalCandle, marketStructure: MarketStructure, volumeRatio: number): boolean {
    return marketStructure.trendStrength > 1.5 && volumeRatio >= 1.1;
  }
} 