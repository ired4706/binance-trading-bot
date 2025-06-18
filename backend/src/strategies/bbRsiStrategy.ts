import { BaseStrategy, StrategySignal, BacktestConfig } from './baseStrategy';
import { HistoricalCandle } from '../services/historicalDataService';
import { IndicatorSignals } from '../types/trading.types';

export class BB_RSIStrategy extends BaseStrategy {
  constructor(config: BacktestConfig) {
    super('BB_RSI', 20, config);
  }

  analyzeSignal(candles: HistoricalCandle[], indicators: IndicatorSignals): StrategySignal {
    const currentPrice = candles[candles.length - 1].close;
    const rsi = indicators.rsi;
    const bb = indicators.bollingerBands;
    const signals = indicators.signals;

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    let reason = '';

    if (!bb) {
      return {
        action: 'HOLD',
        confidence: 0,
        reason: 'Bollinger Bands not available',
        price: currentPrice,
        timestamp: candles[candles.length - 1].openTime
      };
    }

    // Price touches lower Bollinger Band + RSI oversold = Strong buy
    if (currentPrice <= bb.lower && rsi < 30) {
      action = 'BUY';
      confidence = 0.9;
      reason = `Price at lower BB (${bb.lower.toFixed(2)}) + RSI oversold (${rsi.toFixed(2)})`;
    }
    // Price touches upper Bollinger Band + RSI overbought = Strong sell
    else if (currentPrice >= bb.upper && rsi > 70) {
      action = 'SELL';
      confidence = 0.9;
      reason = `Price at upper BB (${bb.upper.toFixed(2)}) + RSI overbought (${rsi.toFixed(2)})`;
    }
    // Price near lower BB + RSI < 40 = Moderate buy
    else if (currentPrice <= bb.lower * 1.01 && rsi < 40) {
      action = 'BUY';
      confidence = 0.7;
      reason = `Price near lower BB + RSI oversold (${rsi.toFixed(2)})`;
    }
    // Price near upper BB + RSI > 60 = Moderate sell
    else if (currentPrice >= bb.upper * 0.99 && rsi > 60) {
      action = 'SELL';
      confidence = 0.7;
      reason = `Price near upper BB + RSI overbought (${rsi.toFixed(2)})`;
    }
    // Mean reversion: Price at extreme + RSI divergence
    else if (currentPrice <= bb.lower && rsi > 40) {
      action = 'BUY';
      confidence = 0.6;
      reason = `Price at lower BB but RSI not oversold - mean reversion`;
    }
    else if (currentPrice >= bb.upper && rsi < 60) {
      action = 'SELL';
      confidence = 0.6;
      reason = `Price at upper BB but RSI not overbought - mean reversion`;
    }
    // Volume confirmation
    else if (signals.includes('HIGH_VOLUME')) {
      if (currentPrice <= bb.lower && rsi < 35) {
        action = 'BUY';
        confidence = 0.8;
        reason = `High volume + Price at lower BB + RSI oversold`;
      } else if (currentPrice >= bb.upper && rsi > 65) {
        action = 'SELL';
        confidence = 0.8;
        reason = `High volume + Price at upper BB + RSI overbought`;
      }
    }

    return {
      action,
      confidence,
      reason,
      price: currentPrice,
      timestamp: candles[candles.length - 1].openTime
    };
  }
} 