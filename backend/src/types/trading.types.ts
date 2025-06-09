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
} 