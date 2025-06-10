// Technical indicators configuration
exports.INDICATORS = {
    RSI: {
        PERIOD: 14,
        OVERBOUGHT: 70,
        OVERSOLD: 30
    },
    EMA: {
        FAST: 12,
        SLOW: 26,
        SIGNAL: 9,
        EMA50: 50
    },
    FIBONACCI: {
        LEVELS: [0, 0.382, 0.5, 0.618, 1],  // Các mức Fibonacci phổ biến nhất
        DESCRIPTIONS: {
            '0': 'Support',
            '0.382': '38.2% Retracement',
            '0.5': '50% Retracement',
            '0.618': '61.8% Retracement',
            '1': 'Resistance'
        }
    }
};

// Trading parameters
exports.TRADING_PARAMS = {
    DEFAULT_QUANTITY: 0.001,  // Default trading quantity
    TP_PERCENTAGE: 1.5,      // Take profit 1.5% (R/R = 1.5:1)
    SL_PERCENTAGE: 1.0,      // Stop loss 1%
    RISK_REWARD_RATIO: 1.5   // Risk/Reward ratio
}; 