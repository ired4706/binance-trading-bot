import { TRADING_PARAMS } from '../constants/indicators';
import { logTrade } from '../utils/logger';
import { Position, Trade, AccountSummary } from '../types/trading.types';

class VirtualAccount {
    private balance: number;
    private positions: Map<string, Position>;
    private tradeHistory: Trade[];

    constructor(initialBalance: number = 10000) {
        this.balance = initialBalance;
        this.positions = new Map();
        this.tradeHistory = [];
    }

    // Open a new position
    public openPosition(pair: string, type: 'BUY' | 'SELL', price: number, quantity: number = TRADING_PARAMS.DEFAULT_QUANTITY): Position {
        if (this.positions.has(pair)) {
            throw new Error(`Position already exists for ${pair}`);
        }

        const cost = price * quantity;
        if (cost > this.balance) {
            throw new Error('Insufficient balance');
        }

        const position: Position = {
            pair,
            type,
            entryPrice: price,
            quantity,
            takeProfit: type === 'BUY' ? 
                price * (1 + TRADING_PARAMS.TP_PERCENTAGE / 100) :
                price * (1 - TRADING_PARAMS.TP_PERCENTAGE / 100),
            stopLoss: type === 'BUY' ?
                price * (1 - TRADING_PARAMS.SL_PERCENTAGE / 100) :
                price * (1 + TRADING_PARAMS.SL_PERCENTAGE / 100),
            openTime: new Date()
        };

        this.positions.set(pair, position);
        this.balance -= cost;

        // Log the trade
        logTrade({
            pair,
            type: 'OPEN',
            price,
            quantity,
            takeProfit: position.takeProfit,
            stopLoss: position.stopLoss
        });

        return position;
    }

    // Close a position
    public closePosition(pair: string, currentPrice: number): Trade {
        const position = this.positions.get(pair);
        if (!position) {
            throw new Error(`No position found for ${pair}`);
        }

        const pnl = position.type === 'BUY' ?
            (currentPrice - position.entryPrice) * position.quantity :
            (position.entryPrice - currentPrice) * position.quantity;

        this.balance += (position.entryPrice * position.quantity) + pnl;
        
        const trade: Trade = {
            pair,
            type: position.type,
            entryPrice: position.entryPrice,
            exitPrice: currentPrice,
            quantity: position.quantity,
            pnl,
            openTime: position.openTime,
            closeTime: new Date()
        };

        this.tradeHistory.push(trade);
        this.positions.delete(pair);

        // Log the trade
        logTrade({
            pair,
            type: 'CLOSE',
            price: currentPrice,
            quantity: position.quantity,
            pnl
        });

        return trade;
    }

    // Check if price hits TP or SL
    public checkPositions(pair: string, currentPrice: number): Trade | null {
        const position = this.positions.get(pair);
        if (!position) return null;

        if (position.type === 'BUY') {
            if (currentPrice >= position.takeProfit) {
                return this.closePosition(pair, currentPrice);
            }
            if (currentPrice <= position.stopLoss) {
                return this.closePosition(pair, currentPrice);
            }
        } else {
            if (currentPrice <= position.takeProfit) {
                return this.closePosition(pair, currentPrice);
            }
            if (currentPrice >= position.stopLoss) {
                return this.closePosition(pair, currentPrice);
            }
        }

        return null;
    }

    // Get account summary
    public getAccountSummary(): AccountSummary {
        return {
            balance: this.balance,
            openPositions: Array.from(this.positions.entries()).map(([_, position]) => ({
                ...position
            })),
            tradeHistory: this.tradeHistory
        };
    }
}

// Export a singleton instance
export const virtualAccount = new VirtualAccount(); 