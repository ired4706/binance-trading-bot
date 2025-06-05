export interface PriceData {
    symbol: string;
    price: number;
    change: number;
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