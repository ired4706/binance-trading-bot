export interface PriceData {
    symbol: string;
    price: number;
    change: number;      // Change in current minute
    change1h: number;    // Change in last 1 hour
    change24h: number;   // Change in last 24 hours
    timestamp: number;   // Unix timestamp in milliseconds
    lastUpdate: number;  // Last time this price was updated
    changePercent: number;
}

export interface Position {
    id: number;
    symbol: string;
    type: 'BUY' | 'SELL';
    entryPrice: number;
    currentPrice: number;
    quantity: number;
    pnl: number;
    pnlPercent: number;
}

export interface AccountData {
    balance: number;
    positions: Position[];
}

export interface TradingSettings {
    timeframe: string;
    riskRewardRatio: number;
    strategy: 'RSI_EMA50' | 'RSI_EMA200' | 'BB_RSI' | 'SR_VOLUME' | 'ICHIMOKU' | 'MACD_VOLUME' | 'ATR_DYNAMIC' | 'MTF_TREND' | 'STOCHASTIC_RSI' | 'BB_SQUEEZE' | 'SUPPORT_RESISTANCE';
    enabledStrategies: string[];
} 