import axios from 'axios';
import { logger } from '../utils/logger';

export interface HistoricalCandle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteAssetVolume: number;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: number;
  takerBuyQuoteAssetVolume: number;
}

export interface HistoricalDataParams {
  symbol: string;
  interval: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export class HistoricalDataService {
  private baseUrl = 'https://api.binance.com/api/v3';

  /**
   * Lấy dữ liệu lịch sử từ Binance
   */
  async getHistoricalData(params: HistoricalDataParams): Promise<HistoricalCandle[]> {
    try {
      const { symbol, interval, startTime, endTime, limit = 1000 } = params;
      
      const queryParams = new URLSearchParams({
        symbol: symbol.toUpperCase(),
        interval,
        limit: limit.toString()
      });

      if (startTime) {
        queryParams.append('startTime', startTime.toString());
      }
      if (endTime) {
        queryParams.append('endTime', endTime.toString());
      }

      const response = await axios.get(`${this.baseUrl}/klines?${queryParams}`);
      
      if (response.status !== 200) {
        throw new Error(`Failed to fetch historical data: ${response.status}`);
      }

      // Transform Binance response to our format
      const candles: HistoricalCandle[] = response.data.map((candle: any[]) => ({
        openTime: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: candle[6],
        quoteAssetVolume: parseFloat(candle[7]),
        numberOfTrades: parseInt(candle[8]),
        takerBuyBaseAssetVolume: parseFloat(candle[9]),
        takerBuyQuoteAssetVolume: parseFloat(candle[10])
      }));

      logger.info(`Fetched ${candles.length} historical candles for ${symbol}`);
      return candles;

    } catch (error) {
      logger.error('Error fetching historical data:', error);
      throw error;
    }
  }

  /**
   * Lấy dữ liệu cho backtest với số lượng nến cần thiết
   */
  async getDataForBacktest(
    symbol: string, 
    interval: string, 
    requiredCandles: number,
    endTime?: number
  ): Promise<HistoricalCandle[]> {
    // Tính toán thời gian bắt đầu dựa trên số nến cần thiết
    const intervalMs = this.getIntervalMs(interval);
    const startTime = endTime ? endTime - (requiredCandles * intervalMs) : Date.now() - (requiredCandles * intervalMs);
    
    return this.getHistoricalData({
      symbol,
      interval,
      startTime,
      endTime,
      limit: requiredCandles
    });
  }

  /**
   * Chuyển đổi interval string thành milliseconds
   */
  private getIntervalMs(interval: string): number {
    const intervalMap: { [key: string]: number } = {
      '1m': 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '8h': 8 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000
    };

    return intervalMap[interval] || 60 * 1000; // Default to 1m
  }

  /**
   * Lấy danh sách các symbol có sẵn
   */
  async getAvailableSymbols(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/exchangeInfo`);
      return response.data.symbols
        .filter((symbol: any) => symbol.status === 'TRADING')
        .map((symbol: any) => symbol.symbol);
    } catch (error) {
      logger.error('Error fetching available symbols:', error);
      throw error;
    }
  }
}

export const historicalDataService = new HistoricalDataService(); 