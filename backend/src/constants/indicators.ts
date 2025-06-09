interface RSIConfig {
    PERIOD: number;
    OVERBOUGHT: number;
    OVERSOLD: number;
}

interface EMAConfig {
    FAST: number;
    SLOW: number;
    SIGNAL: number;
    EMA50: number;
}

interface FibonacciConfig {
    LEVELS: number[];
    DESCRIPTIONS: { [key: string]: string };
}

interface TradingParamsConfig {
    DEFAULT_QUANTITY: number;
    TP_PERCENTAGE: number;
    SL_PERCENTAGE: number;
    RISK_REWARD_RATIO: number;
}

interface IndicatorsConfig {
    RSI: RSIConfig;
    EMA: EMAConfig;
    FIBONACCI: FibonacciConfig;
}

// Technical indicators configuration
export const INDICATORS: IndicatorsConfig = {
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
export const TRADING_PARAMS: TradingParamsConfig = {
    DEFAULT_QUANTITY: 0.001,  // Default trading quantity
    TP_PERCENTAGE: 2.0,      // Take profit 2% (R/R = 2:1)
    SL_PERCENTAGE: 1.0,      // Stop loss 1%
    RISK_REWARD_RATIO: 2     // Risk/Reward ratio
}; 