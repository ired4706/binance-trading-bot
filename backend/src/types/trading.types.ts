export interface Position {
    pair: string;
    type: 'BUY' | 'SELL';
    entryPrice: number;
    quantity: number;
    takeProfit: number;
    stopLoss: number;
    openTime: Date;
    currentPrice?: number;
}

export interface Trade {
    pair: string;
    type: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    openTime: Date;
    closeTime: Date;
}

export interface AccountSummary {
    balance: number;
    openPositions: Position[];
    tradeHistory: Trade[];
}

export interface TradingSettings {
    timeframe: string;
    riskRewardRatio: number;
    strategy: 'RSI_EMA' | 'BB_RSI' | 'SR_VOLUME' | 'ICHIMOKU';
    enabledStrategies: string[];
}

export interface BollingerBands {
    upper: number;
    middle: number;
    lower: number;
}

export interface IchimokuCloud {
    conversionLine: number;    // Tenkan-sen
    baseLine: number;         // Kijun-sen
    leadingSpanA: number;    // Senkou Span A
    leadingSpanB: number;    // Senkou Span B
    laggingSpan: number;     // Chikou Span
}

export interface VolumeProfile {
    volume: number;
    averageVolume: number;
    isHighVolume: boolean;
}

export interface SupportResistance {
    supports: number[];
    resistances: number[];
    nearestSupport: number;
    nearestResistance: number;
}

export interface IndicatorSignals {
    rsi: number;
    ema50: number;
    bollingerBands?: BollingerBands;
    ichimoku?: IchimokuCloud;
    volumeProfile?: VolumeProfile;
    supportResistance?: SupportResistance;
    signals: string[];
} 