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
    BOLLINGER: {
        PERIOD: number;
        STANDARD_DEVIATION: number;
    };
    ICHIMOKU: {
        CONVERSION_PERIOD: number;
        BASE_PERIOD: number;
        LEADING_SPAN_B_PERIOD: number;
        DISPLACEMENT: number;
    };
    VOLUME: {
        PERIOD: number;
        HIGH_VOLUME_THRESHOLD: number;
    };
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
        LEVELS: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
        DESCRIPTIONS: {
            '0': 'Support',
            '0.236': '23.6% Retracement',
            '0.382': '38.2% Retracement',
            '0.5': '50% Retracement',
            '0.618': '61.8% Retracement',
            '0.786': '78.6% Retracement',
            '1': 'Resistance'
        }
    },
    BOLLINGER: {
        PERIOD: 20,
        STANDARD_DEVIATION: 2
    },
    ICHIMOKU: {
        CONVERSION_PERIOD: 9,
        BASE_PERIOD: 26,
        LEADING_SPAN_B_PERIOD: 52,
        DISPLACEMENT: 26
    },
    VOLUME: {
        PERIOD: 20,
        HIGH_VOLUME_THRESHOLD: 1.5  // 150% of average volume
    }
};

// Trading parameters
export const TRADING_PARAMS: TradingParamsConfig = {
    DEFAULT_QUANTITY: 0.001,
    TP_PERCENTAGE: 1.5,
    SL_PERCENTAGE: 1.0,
    RISK_REWARD_RATIO: 1.5
}; 