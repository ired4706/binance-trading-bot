const { TRADING_PARAMS } = require('../constants/indicators');
const { logTrade } = require('../utils/logger');

class VirtualAccount {
    constructor(initialBalance = 10000) {
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

    updateSettings(settings) {
        this.settings = settings;
    }

    // Open a new position
    openPosition(pair, type, price, quantity = TRADING_PARAMS.DEFAULT_QUANTITY) {
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

        const position = {
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
    closePosition(pair, currentPrice) {
        const position = this.positions.get(pair);
        if (!position) {
            throw new Error(`No position found for ${pair}`);
        }

        const pnl = position.type === 'BUY' ?
            (currentPrice - position.entryPrice) * position.quantity :
            (position.entryPrice - currentPrice) * position.quantity;

        this.balance += (position.entryPrice * position.quantity) + pnl;
        
        const trade = {
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
    checkPositions(pair, currentPrice) {
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
    getAccountSummary() {
        return {
            balance: this.balance,
            openPositions: Array.from(this.positions.entries()).map(([pair, position]) => ({
                pair,
                ...position
            })),
            tradeHistory: this.tradeHistory
        };
    }
}

// Export a singleton instance
const virtualAccount = new VirtualAccount();
module.exports = { virtualAccount }; 