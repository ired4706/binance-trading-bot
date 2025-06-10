export interface PriceData {
    symbol: string;
    price: number;
    change: number;      // Change in current minute
    change1h: number;    // Change in last 1 hour
    change24h: number;   // Change in last 24 hours
}

export interface Position {
    id: number;
    symbol: string;
    type: 'BUY' | 'SELL';
    entryPrice: number;
    currentPrice: number;
    quantity: number;
    pnl: number;
}

export interface AccountData {
    balance: number;
    positions: Position[];
}

export interface TradingSettings {
    timeframe: string;
    riskRewardRatio: number;
    strategy: 'RSI_EMA' | 'BB_RSI' | 'SR_VOLUME' | 'ICHIMOKU';
    enabledStrategies: string[];
} 