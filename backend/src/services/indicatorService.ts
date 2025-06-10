import { INDICATORS } from '../constants/indicators';
import { BollingerBands, IchimokuCloud, VolumeProfile, SupportResistance, IndicatorSignals } from '../types/trading.types';

export class IndicatorService {
    // Calculate RSI
    private calculateRSI(prices: number[]): number {
        const period = INDICATORS.RSI.PERIOD;
        const changes = [];
        
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }
        
        const gains = changes.map(change => change > 0 ? change : 0);
        const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);
        
        const avgGain = gains.slice(-period).reduce((a, b) => a + b) / period;
        const avgLoss = losses.slice(-period).reduce((a, b) => a + b) / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    // Calculate EMA
    private calculateEMA(prices: number[], period: number): number {
        const k = 2 / (period + 1);
        let ema = prices[0];
        
        for (let i = 1; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }
        
        return ema;
    }

    // Calculate Bollinger Bands
    private calculateBollingerBands(prices: number[]): BollingerBands {
        const period = INDICATORS.BOLLINGER.PERIOD;
        const stdDev = INDICATORS.BOLLINGER.STANDARD_DEVIATION;
        
        const sma = prices.slice(-period).reduce((a, b) => a + b) / period;
        const squaredDiffs = prices.slice(-period).map(p => Math.pow(p - sma, 2));
        const standardDeviation = Math.sqrt(squaredDiffs.reduce((a, b) => a + b) / period);
        
        return {
            upper: sma + (standardDeviation * stdDev),
            middle: sma,
            lower: sma - (standardDeviation * stdDev)
        };
    }

    // Calculate Ichimoku Cloud
    private calculateIchimoku(prices: number[]): IchimokuCloud {
        const { CONVERSION_PERIOD, BASE_PERIOD, LEADING_SPAN_B_PERIOD, DISPLACEMENT } = INDICATORS.ICHIMOKU;
        
        const getHighLow = (period: number) => {
            const slice = prices.slice(-period);
            return {
                high: Math.max(...slice),
                low: Math.min(...slice)
            };
        };

        const conversionHL = getHighLow(CONVERSION_PERIOD);
        const baseHL = getHighLow(BASE_PERIOD);
        const spanBHL = getHighLow(LEADING_SPAN_B_PERIOD);

        const conversionLine = (conversionHL.high + conversionHL.low) / 2;
        const baseLine = (baseHL.high + baseHL.low) / 2;
        const leadingSpanA = (conversionLine + baseLine) / 2;
        const leadingSpanB = (spanBHL.high + spanBHL.low) / 2;
        const laggingSpan = prices[prices.length - DISPLACEMENT - 1] || prices[prices.length - 1];

        return {
            conversionLine,
            baseLine,
            leadingSpanA,
            leadingSpanB,
            laggingSpan
        };
    }

    // Calculate Volume Profile
    private calculateVolumeProfile(volumes: number[]): VolumeProfile {
        const period = INDICATORS.VOLUME.PERIOD;
        const recentVolumes = volumes.slice(-period);
        const averageVolume = recentVolumes.reduce((a, b) => a + b) / period;
        const currentVolume = volumes[volumes.length - 1];
        
        return {
            volume: currentVolume,
            averageVolume,
            isHighVolume: currentVolume > averageVolume * INDICATORS.VOLUME.HIGH_VOLUME_THRESHOLD
        };
    }

    // Calculate Support and Resistance levels using Fibonacci
    private calculateSupportResistance(prices: number[]): SupportResistance {
        const period = 100; // Look back period for S/R
        const recentPrices = prices.slice(-period);
        const high = Math.max(...recentPrices);
        const low = Math.min(...recentPrices);
        const range = high - low;
        
        const currentPrice = prices[prices.length - 1];
        const fibLevels = INDICATORS.FIBONACCI.LEVELS.map(level => low + range * level);
        
        const supports = fibLevels.filter(level => level < currentPrice);
        const resistances = fibLevels.filter(level => level > currentPrice);
        
        return {
            supports,
            resistances,
            nearestSupport: Math.max(...supports),
            nearestResistance: Math.min(...resistances)
        };
    }

    // Analyze price with all indicators
    public analyzePriceWithIndicators(prices: number[], volumes?: number[]): IndicatorSignals {
        const currentPrice = prices[prices.length - 1];
        const rsi = this.calculateRSI(prices);
        const ema50 = this.calculateEMA(prices, INDICATORS.EMA.EMA50);
        const bb = this.calculateBollingerBands(prices);
        const ichimoku = this.calculateIchimoku(prices);
        const sr = this.calculateSupportResistance(prices);
        
        let volumeProfile: VolumeProfile | undefined;
        if (volumes && volumes.length > 0) {
            volumeProfile = this.calculateVolumeProfile(volumes);
        }
        
        const signals: string[] = [];

        // RSI signals
        if (rsi > INDICATORS.RSI.OVERBOUGHT) {
            signals.push('RSI_OVERBOUGHT');
        } else if (rsi < INDICATORS.RSI.OVERSOLD) {
            signals.push('RSI_OVERSOLD');
        }

        // EMA signals
        if (currentPrice > ema50) {
            signals.push('ABOVE_EMA50');
        } else {
            signals.push('BELOW_EMA50');
        }

        // Bollinger Bands signals
        if (currentPrice <= bb.lower) {
            signals.push('BB_LOWER_TOUCH');
        } else if (currentPrice >= bb.upper) {
            signals.push('BB_UPPER_TOUCH');
        }

        // Ichimoku signals
        const isAboveCloud = currentPrice > ichimoku.leadingSpanA && currentPrice > ichimoku.leadingSpanB;
        const isBelowCloud = currentPrice < ichimoku.leadingSpanA && currentPrice < ichimoku.leadingSpanB;
        const isChikouAbovePrice = ichimoku.laggingSpan > currentPrice;

        if (isAboveCloud && isChikouAbovePrice) {
            signals.push('ICHIMOKU_BULLISH');
        } else if (isBelowCloud && !isChikouAbovePrice) {
            signals.push('ICHIMOKU_BEARISH');
        }

        // Support/Resistance signals
        if (Math.abs(currentPrice - sr.nearestSupport) / currentPrice < 0.002) { // Within 0.2% of support
            signals.push('AT_SUPPORT');
        } else if (Math.abs(currentPrice - sr.nearestResistance) / currentPrice < 0.002) { // Within 0.2% of resistance
            signals.push('AT_RESISTANCE');
        }

        // Volume signals
        if (volumeProfile?.isHighVolume) {
            signals.push('HIGH_VOLUME');
        }

        return {
            rsi,
            ema50,
            bollingerBands: bb,
            ichimoku,
            volumeProfile,
            supportResistance: sr,
            signals
        };
    }
} 