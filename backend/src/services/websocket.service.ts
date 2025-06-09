import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Server } from 'http';
import { logger } from '../utils/logger';
import { virtualAccount } from '../models/VirtualAccount';
import { Position, AccountSummary, TradingSettings } from '../types/trading.types';

interface KlineData {
  e: string;  // Event type
  s: string;  // Symbol
  k: {
    c: string;  // Close price
    o: string;  // Open price
  };
}

interface SymbolData {
  lastPrice: number;
  price1hAgo: number;
  price24hAgo: number;
}

interface WebSocketMessage {
  type: "PRICE" | "ACCOUNT" | "SETTINGS" | "UPDATE_SETTINGS";
  payload: any;
}

interface WebSocketPricePayload {
  symbol: string;
  price: number;
  change: number;
  change1h: number;
  change24h: number;
}

interface WebSocketAccountPayload {
  balance: number;
  positions: Array<{
    id: number;
    symbol: string;
    type: 'BUY' | 'SELL';
    entryPrice: number;
    currentPrice: number;
    quantity: number;
    pnl: number;
  }>;
}

export class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly baseUrl: string = 'wss://stream.binance.com:9443/ws';
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private wss: WebSocket.Server | null = null;
  private clients: Set<WebSocket> = new Set();
  private symbolData: Map<string, SymbolData> = new Map();
  private currentSettings: TradingSettings = {
    timeframe: '1m',
    riskRewardRatio: 2
  };
  private accountUpdateInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  public initialize(server: Server): void {
    this.wss = new WebSocket.Server({ server, path: '/ws' });
    
    this.wss.on('connection', (ws) => {
      logger.info('New client connected');
      this.clients.add(ws);

      // Send current settings to new client
      this.broadcastToClients({
        type: 'SETTINGS',
        payload: this.currentSettings
      });

      // Send initial account data
      this.sendAccountUpdate();

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          if (message.type === 'UPDATE_SETTINGS') {
            this.handleSettingsUpdate(message.payload as TradingSettings);
          }
        } catch (error) {
          logger.error('Error processing client message:', error);
        }
      });

      ws.on('close', () => {
        logger.info('Client disconnected');
        this.clients.delete(ws);
      });
    });

    // Start periodic account updates
    this.startAccountUpdates();
  }

  private startAccountUpdates(): void {
    if (this.accountUpdateInterval) {
      clearInterval(this.accountUpdateInterval);
    }

    this.accountUpdateInterval = setInterval(() => {
      this.sendAccountUpdate();
    }, 1000); // Update every second
  }

  private sendAccountUpdate(): void {
    const accountData = virtualAccount.getAccountSummary();
    const payload: WebSocketAccountPayload = {
      balance: accountData.balance,
      positions: accountData.openPositions.map(pos => ({
        id: Math.random(), // Temporary ID for frontend
        symbol: pos.pair,
        type: pos.type,
        entryPrice: pos.entryPrice,
        currentPrice: pos.currentPrice || pos.entryPrice,
        quantity: pos.quantity,
        pnl: ((pos.currentPrice || pos.entryPrice) - pos.entryPrice) * pos.quantity
      }))
    };

    this.broadcastToClients({
      type: 'ACCOUNT',
      payload
    });
  }

  private handleSettingsUpdate(settings: TradingSettings): void {
    logger.info('Updating trading settings:', settings);
    
    // Update current settings
    this.currentSettings = settings;

    // Reconnect to Binance with new timeframe if it changed
    if (this.ws && settings.timeframe !== this.currentSettings.timeframe) {
      this.disconnect();
      this.connect(this.getSubscribedSymbols());
    }

    // Broadcast new settings to all clients
    this.broadcastToClients({
      type: 'SETTINGS',
      payload: settings
    });
  }

  private getSubscribedSymbols(): string[] {
    return Array.from(this.symbolData.keys());
  }

  private broadcastToClients(message: WebSocketMessage): void {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  private async fetchInitialPrices(symbol: string): Promise<void> {
    try {
      // Fetch klines (candlesticks) data from Binance REST API
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${this.currentSettings.timeframe}&limit=24`);
      const data = await response.json();
      
      if (data && data.length >= 24) {
        const currentPrice = parseFloat(data[data.length - 1][4]); // Current close price
        const price1hAgo = parseFloat(data[data.length - 2][4]);   // 1h ago close price
        const price24hAgo = parseFloat(data[0][4]);                // 24h ago close price

        this.symbolData.set(symbol, {
          lastPrice: currentPrice,
          price1hAgo: price1hAgo,
          price24hAgo: price24hAgo
        });
      }
    } catch (error) {
      logger.error(`Error fetching initial prices for ${symbol}:`, error);
    }
  }

  public connect(symbols: string[]): void {
    if (this.isConnected) {
      logger.warn('WebSocket is already connected');
      return;
    }

    // Fetch initial prices for all symbols
    symbols.forEach(symbol => this.fetchInitialPrices(symbol));

    try {
      this.ws = new WebSocket(this.baseUrl);

      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        logger.info('WebSocket connected to Binance');
        
        // Subscribe to all symbols with current timeframe
        const subscribeMessage = {
          method: 'SUBSCRIBE',
          params: symbols.map(symbol => `${symbol.toLowerCase()}@kline_${this.currentSettings.timeframe}`),
          id: 1
        };
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(subscribeMessage));
        } else {
          logger.error('WebSocket is not ready for sending messages');
          this.handleDisconnect();
        }
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as KlineData;
          
          // Only process kline data
          if (message.e === 'kline') {
            const symbol = message.s.toLowerCase();
            const currentPrice = parseFloat(message.k.c);
            const symbolInfo = this.symbolData.get(symbol);

            if (symbolInfo) {
              // Update last price
              const oldPrice = symbolInfo.lastPrice;
              symbolInfo.lastPrice = currentPrice;

              const priceData: WebSocketPricePayload = {
                symbol: message.s,
                price: currentPrice,
                change: ((currentPrice - parseFloat(message.k.o)) / parseFloat(message.k.o)) * 100,
                change1h: ((currentPrice - symbolInfo.price1hAgo) / symbolInfo.price1hAgo) * 100,
                change24h: ((currentPrice - symbolInfo.price24hAgo) / symbolInfo.price24hAgo) * 100
              };
              
              this.broadcastToClients({
                type: 'PRICE',
                payload: priceData
              });

              // Update historical prices every hour
              const now = new Date();
              if (now.getMinutes() === 0 && now.getSeconds() < 10) {
                symbolInfo.price1hAgo = oldPrice;
                if (now.getHours() === 0) {
                  symbolInfo.price24hAgo = oldPrice;
                }
              }
            }
          }
        } catch (error) {
          logger.error('Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('error', (error: Error) => {
        logger.error('WebSocket error:', error);
        this.handleDisconnect();
      });

      this.ws.on('close', () => {
        logger.warn('WebSocket connection closed');
        this.handleDisconnect();
      });

    } catch (error) {
      logger.error('Error creating WebSocket connection:', error);
      this.handleDisconnect();
    }
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      logger.info(`Attempting to reconnect in ${delay/1000} seconds... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect(this.getSubscribedSymbols());
      }, delay);
    } else {
      logger.error('Max reconnection attempts reached. Please check your connection and restart the service.');
    }
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      if (this.accountUpdateInterval) {
        clearInterval(this.accountUpdateInterval);
        this.accountUpdateInterval = null;
      }
      
      if (this.wss) {
        this.wss.close();
        this.wss = null;
      }
      
      logger.info('WebSocket disconnected');
    }
  }

  public isSocketConnected(): boolean {
    return this.isConnected;
  }

  public getCurrentSettings(): TradingSettings {
    return this.currentSettings;
  }
}

export const webSocketService = new WebSocketService(); 