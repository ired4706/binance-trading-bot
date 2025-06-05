const { INDICATORS } = require('../constants/indicators');

class IndicatorService {
    // Calculate RSI
    calculateRSI(prices, period = INDICATORS.RSI.PERIOD) {
        if (prices.length < period + 1) {
            return null;
        }

        let gains = 0;
        let losses = 0;

        // Calculate initial average gain and loss
        for (let i = 1; i <= period; i++) {
            const difference = prices[i] - prices[i - 1];
            if (difference >= 0) {
                gains += difference;
            } else {
                losses -= difference;
            }
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        // Calculate RSI using smoothed averages
        for (let i = period + 1; i < prices.length; i++) {
            const difference = prices[i] - prices[i - 1];
            if (difference >= 0) {
                avgGain = (avgGain * (period - 1) + difference) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) - difference) / period;
            }
        }

        const RS = avgGain / avgLoss;
        const RSI = 100 - (100 / (1 + RS));

        return RSI;
    }

    // Calculate EMA
    calculateEMA(prices, period) {
        if (prices.length < period) {
            return null;
        }

        const multiplier = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] - ema) * multiplier + ema;
        }

        return ema;
    }

    // Calculate Fibonacci levels
    calculateFibonacciLevels(high, low) {
        const diff = high - low;
        return INDICATORS.FIBONACCI.LEVELS.map(level => {
            return {
                level: level,
                description: INDICATORS.FIBONACCI.DESCRIPTIONS[level],
                price: high - (diff * level)
            };
        });
    }

    // Analyze price with indicators
    analyzePriceWithIndicators(prices) {
        const currentPrice = prices[prices.length - 1];
        const rsi = this.calculateRSI(prices);
        const ema50 = this.calculateEMA(prices, INDICATORS.EMA.EMA50);
        
        let signals = {
            price: currentPrice,
            rsi: rsi,
            ema50: ema50,
            signals: []
        };

        // RSI signals
        if (rsi > INDICATORS.RSI.OVERBOUGHT) {
            signals.signals.push('RSI_OVERBOUGHT');
        } else if (rsi < INDICATORS.RSI.OVERSOLD) {
            signals.signals.push('RSI_OVERSOLD');
        }

        // EMA signals
        if (currentPrice > ema50) {
            signals.signals.push('ABOVE_EMA50');
        } else {
            signals.signals.push('BELOW_EMA50');
        }

        return signals;
    }
}

module.exports = new IndicatorService(); 