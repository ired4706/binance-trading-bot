import { TRADING_PARAMS } from '../constants/indicators';
import { logTrade } from '../utils/logger';
import { Position, Trade, AccountSummary, TradingSettings } from '../types/trading.types';

class VirtualAccount {
    private balance: number;
    private positions: Map<string, Position>;
    private tradeHistory: Trade[];
    private settings: TradingSettings;

    constructor(initialBalance: number = 10000) {
        this.balance = initialBalance;
        this.positions = new Map();
        this.tradeHistory = [];
        this.settings = {
            timeframe: '1m',
            riskRewardRatio: TRADING_PARAMS.RISK_REWARD_RATIO,
            strategy: 'BB_RSI',
            enabledStrategies: ['BB_RSI', 'SR_VOLUME', 'ICHIMOKU']
        };
    }

    public updateSettings(settings: TradingSettings) {
        this.settings = settings;
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

        // Calculate SL and TP based on settings.riskRewardRatio
        const slPercentage = TRADING_PARAMS.SL_PERCENTAGE;
        const tpPercentage = slPercentage * this.settings.riskRewardRatio;

        const position: Position = {
            pair,
            type,
            entryPrice: price,
            quantity,
            takeProfit: type === 'BUY' ? 
                price * (1 + tpPercentage / 100) :
                price * (1 - tpPercentage / 100),
            stopLoss: type === 'BUY' ?
                price * (1 - slPercentage / 100) :
                price * (1 + slPercentage / 100),
            openTime: new Date()
        };

        this.positions.set(pair, position);
        this.balance -= cost;

        // Log the trade
        logTrade({
            symbol: pair,
            type: type,
            price: position.entryPrice,
            quantity: position.quantity,
            takeProfit: position.takeProfit,
            stopLoss: position.stopLoss
        });

        return position;
    }

    // Close a position
    public closePosition(pair: string, currentPrice: number): Trade {
        const position = this.positions.get(pair);
        if (!position) {
            throw new Error(`No position exists for ${pair}`);
        }

        const pnl = (currentPrice - position.entryPrice) * position.quantity;
        this.balance += currentPrice * position.quantity;
        this.positions.delete(pair);

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

        // Log the trade
        logTrade({
            symbol: pair,
            type: position.type === 'BUY' ? 'SELL' : 'BUY',
            price: currentPrice,
            quantity: position.quantity,
            takeProfit: position.takeProfit,
            stopLoss: position.stopLoss
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