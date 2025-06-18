import { BaseStrategy, StrategySignal, BacktestConfig } from './baseStrategy';
import { HistoricalCandle } from '../services/historicalDataService';
import { IndicatorSignals } from '../types/trading.types';

export class RSI_EMA50Strategy extends BaseStrategy {
  constructor(config: BacktestConfig) {
    super('RSI_EMA50', 50, config);
  }

  analyzeSignal(candles: HistoricalCandle[], indicators: IndicatorSignals): StrategySignal {
    const currentPrice = candles[candles.length - 1].close;
    const rsi = indicators.rsi;
    const ema50 = indicators.ema50;
    const signals = indicators.signals;

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    let reason = '';

    // RSI oversold + price above EMA50 = Strong buy signal
    if (rsi < 30 && currentPrice > ema50) {
      action = 'BUY';
      confidence = 0.8;
      reason = `RSI oversold (${rsi.toFixed(2)}) and price above EMA50`;
    }
    // RSI overbought + price below EMA50 = Strong sell signal
    else if (rsi > 70 && currentPrice < ema50) {
      action = 'SELL';
      confidence = 0.8;
      reason = `RSI overbought (${rsi.toFixed(2)}) and price below EMA50`;
    }
    // RSI oversold + price below EMA50 = Weak buy signal
    else if (rsi < 35 && currentPrice < ema50) {
      action = 'BUY';
      confidence = 0.5;
      reason = `RSI oversold (${rsi.toFixed(2)}) but price below EMA50 - weak signal`;
    }
    // RSI overbought + price above EMA50 = Weak sell signal
    else if (rsi > 65 && currentPrice > ema50) {
      action = 'SELL';
      confidence = 0.5;
      reason = `RSI overbought (${rsi.toFixed(2)}) but price above EMA50 - weak signal`;
    }
    // Additional confirmation signals
    else if (signals.includes('HIGH_VOLUME') && rsi < 40 && currentPrice > ema50) {
      action = 'BUY';
      confidence = 0.7;
      reason = `High volume + RSI oversold (${rsi.toFixed(2)}) + price above EMA50`;
    }
    else if (signals.includes('HIGH_VOLUME') && rsi > 60 && currentPrice < ema50) {
      action = 'SELL';
      confidence = 0.7;
      reason = `High volume + RSI overbought (${rsi.toFixed(2)}) + price below EMA50`;
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