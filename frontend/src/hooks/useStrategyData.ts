import { useState, useEffect, useCallback } from 'react';
import { PriceData } from '../types/websocket.types';

interface StrategyData {
  candles: PriceData[];
  isLoading: boolean;
  error: string | null;
}

interface UseStrategyDataProps {
  strategy: string;
  timeframe: string;
  requiredCandles: number;
}

export const useStrategyData = ({ strategy, timeframe, requiredCandles }: UseStrategyDataProps) => {
  const [data, setData] = useState<StrategyData>({
    candles: [],
    isLoading: true,
    error: null
  });

  const updateCandles = useCallback((newCandle: PriceData) => {
    setData(prev => {
      const updatedCandles = [...prev.candles, newCandle];
      if (updatedCandles.length > requiredCandles) {
        updatedCandles.shift();
      }
      return {
        ...prev,
        candles: updatedCandles,
        isLoading: updatedCandles.length < requiredCandles
      };
    });
  }, [requiredCandles]);

  const resetData = useCallback(() => {
    setData({
      candles: [],
      isLoading: true,
      error: null
    });
  }, []);

  useEffect(() => {
    resetData();
  }, [strategy, timeframe, resetData]);

  return {
    ...data,
    updateCandles,
    resetData
  };
}; 