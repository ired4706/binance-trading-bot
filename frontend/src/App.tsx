import React, { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react';
import { Container, Box, Alert, LinearProgress, Tooltip, IconButton, Tabs, Tab, Typography } from '@mui/material';
import { wsService } from './services/websocket.service';
import { PriceData, AccountData, TradingSettings as TradingSettingsType } from './types/websocket.types';
import { TradingSettings } from './components/TradingSettings';
import { BacktestPanel } from './components/BacktestPanel';
import { AdvancedBacktestPanel } from './components/AdvancedBacktestPanel';
import { PriceTable } from './components/PriceTable/PriceTable';
import { AccountInfo } from './components/AccountInfo/AccountInfo';

const initialCandleCounts = {
  'RSI_EMA50': 0,
  'RSI_EMA200': 0,
  'BB_RSI': 0,
  'SR_VOLUME': 0,
  'ICHIMOKU': 0,
  'MACD_VOLUME': 0,
  'ATR_DYNAMIC': 0,
  'MTF_TREND': 0,
  'STOCHASTIC_RSI': 0,
  'BB_SQUEEZE': 0,
  'SUPPORT_RESISTANCE': 0
};

const timeframeMultiplier = {
  '1m': 1,
  '3m': 3,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '4h': 240,
};

function App() {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [account, setAccount] = useState<AccountData>({ balance: 0, positions: [] });
  const [candleCounts, setCandleCounts] = useState<Record<string, number>>(initialCandleCounts);
  const [settings, setSettings] = useState<TradingSettingsType>({
    timeframe: '1m',
    riskRewardRatio: 1.5,
    strategy: 'RSI_EMA50',
    enabledStrategies: ['RSI_EMA50', 'RSI_EMA200', 'BB_RSI', 'SR_VOLUME', 'ICHIMOKU', 'MACD_VOLUME', 'ATR_DYNAMIC', 'MTF_TREND', 'STOCHASTIC_RSI', 'BB_SQUEEZE', 'SUPPORT_RESISTANCE']
  });

  const candleDataRef = useRef<Record<string, PriceData[]>>({
    'RSI_EMA50': [],
    'RSI_EMA200': [],
    'BB_RSI': [],
    'SR_VOLUME': [],
    'ICHIMOKU': [],
    'MACD_VOLUME': [],
    'ATR_DYNAMIC': [],
    'MTF_TREND': [],
    'STOCHASTIC_RSI': [],
    'BB_SQUEEZE': [],
    'SUPPORT_RESISTANCE': []
  });

  const timeframeInMs = useMemo(() => ({
    '1m': 60 * 1000,
    '3m': 3 * 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
  } as const), []);

  const isValidTimeframe = (timeframe: string): timeframe is keyof typeof timeframeInMs => {
    return timeframe in timeframeInMs;
  };

  const updateCandleData = useCallback((data: PriceData, strategy: string) => {
    const candleData = candleDataRef.current[strategy];
    const maxCandles = getRequiredCandles();
    
    candleData.push(data);

    if (candleData.length > maxCandles) {
      candleData.shift();
    }
    
    setCandleCounts(prev => ({
      ...prev,
      [strategy]: prev[strategy] + 1
    }));
  }, [settings.timeframe, settings.strategy]);

  const getRequiredCandles = () => {
    const multiplier = timeframeMultiplier[settings.timeframe as keyof typeof timeframeMultiplier] || 1;

    let baseCandles = 0;
    switch(settings.strategy) {
      case 'RSI_EMA50':
        baseCandles = 50; // Cho EMA50 (phù hợp cho xu hướng ngắn hạn)
        break;
      case 'RSI_EMA200':
        baseCandles = 200; // Cho EMA200 (phù hợp cho xu hướng dài hạn)
        break;
      case 'BB_RSI':
        baseCandles = 20; // For Bollinger Bands
        break;
      case 'ICHIMOKU':
        baseCandles = 52; // For Ichimoku (26 * 2)
        break;
      case 'MACD_VOLUME':
        baseCandles = 26; // For MACD
        break;
      case 'ATR_DYNAMIC':
        baseCandles = 14; // For ATR
        break;
      case 'MTF_TREND':
        baseCandles = 50; // For multi-timeframe analysis
        break;
      case 'STOCHASTIC_RSI':
        baseCandles = 40; // For Stochastic + RSI
        break;
      case 'BB_SQUEEZE':
        baseCandles = 50; // For Bollinger Bands Squeeze
        break;
      case 'SUPPORT_RESISTANCE':
        baseCandles = 60; // For Support/Resistance analysis
        break;
      default:
        baseCandles = 100;
    }
    
    return Math.ceil(baseCandles / multiplier);
  };

  const getTotalCollectedCandles = (strategy: string) => {
    return candleCounts[strategy];
  };

  const getActiveCandles = (strategy: string) => {
    return candleDataRef.current[strategy].length;
  };

  const getStrategyDescription = () => {
    switch(settings.strategy) {
      case 'RSI_EMA50':
        return " (Tối ưu cho Scalping: RSI xác định điểm vào/ra nhanh, EMA50 xác định xu hướng ngắn hạn. Khuyến nghị timeframe 1m-5m)";
      case 'RSI_EMA200':
        return " (Không phù hợp cho Scalping: EMA200 phản ứng chậm, thích hợp cho swing trading trên khung H1, H4)";
      case 'BB_RSI':
        return " (Có thể dùng cho Scalping khi thị trường sideway, nhưng dễ bị nhiễu trên timeframe 1m)";
      case 'ICHIMOKU':
        return " (Không phù hợp cho Scalping: Ichimoku cần nhiều thời gian để tạo tín hiệu)";
      case 'SR_VOLUME':
        return " (Hỗ trợ tốt cho Scalping: Xác định vùng hỗ trợ/kháng cự quan trọng kết hợp volume)";
      case 'MACD_VOLUME':
        return " (Phù hợp cho Day Trading: MACD xác định xu hướng, Volume xác nhận momentum. Khuyến nghị timeframe 15m-1h)";
      case 'ATR_DYNAMIC':
        return " (Linh hoạt cho nhiều timeframe: ATR thích ứng với volatility, phù hợp cho cả scalping và swing trading)";
      case 'MTF_TREND':
        return " (Tối ưu cho Swing Trading: Phân tích đa khung thời gian, xác định xu hướng chính. Khuyến nghị timeframe H4-D1)";
      case 'STOCHASTIC_RSI':
        return " (Mean Reversion Strategy: Tối ưu cho thị trường sideway, tìm điểm reversal. Khuyến nghị timeframe 5m-15m)";
      case 'BB_SQUEEZE':
        return " (Breakout Strategy: Phát hiện market compression và breakout. Phù hợp cho volatile markets, timeframe 5m-1h)";
      case 'SUPPORT_RESISTANCE':
        return " (Market Structure Strategy: Xác định key levels và breakout/retest. Phù hợp cho swing trading, timeframe 1h-4h)";
      default:
        return "";
    }
  };

  const getEstimatedTime = (strategy: string) => {
    // Forcing a re-evaluation of this function block
    const multiplier = timeframeMultiplier[settings.timeframe as keyof typeof timeframeMultiplier] || 1;

    const recommendedCandles = {
      'RSI_EMA50': 150,  // 2.5 giờ với khung 1m
      'RSI_EMA200': 400, // 6.5 giờ với khung 1m
      'BB_RSI': 60,      // 1 giờ với khung 1m
      'ICHIMOKU': 52,    // Theo yêu cầu cơ bản
      'SR_VOLUME': 100,  // Support/Resistance cần ít nhất 100 nến
      'MACD_VOLUME': 80, // MACD cần ít nhất 80 nến
      'ATR_DYNAMIC': 50, // ATR cần ít nhất 50 nến
      'MTF_TREND': 120,  // Multi-timeframe cần nhiều dữ liệu hơn
      'STOCHASTIC_RSI': 80, // Stochastic + RSI cần ít nhất 80 nến
      'BB_SQUEEZE': 100, // BB Squeeze cần ít nhất 100 nến
      'SUPPORT_RESISTANCE': 120 // Support/Resistance cần ít nhất 120 nến
    }[strategy] || 100;

    const totalMinutes = recommendedCandles * multiplier;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours > 0 ? `${hours} giờ ` : ''}${minutes > 0 ? `${minutes} phút` : ''}`;
  };

  const getLoadingProgress = (strategy: string) => {
    const required = getRequiredCandles();
    const active = getActiveCandles(strategy);
    return (active >= required) ? 100 : (active / required) * 100;
  };

  const getStrategyInfo = (strategy: string) => {
    const info = {
      'RSI_EMA50': {
        scalping: {
          suitability: 'Rất phù hợp',
          timeframes: '1m, 3m, 5m',
          pros: [
            'Phản ứng nhanh với biến động giá',
            'RSI giúp xác định điểm vào/ra chính xác',
            'EMA50 cho xu hướng ngắn hạn rõ ràng'
          ],
          tips: 'Kết hợp với volume để xác nhận tín hiệu'
        },
        dayTrading: {
          suitability: 'Phù hợp',
          timeframes: '15m, 30m',
          pros: ['Cân bằng giữa tốc độ và độ chính xác'],
          tips: 'Theo dõi EMA200 trên khung H1 để xác định xu hướng chính'
        },
        swingTrading: {
          suitability: 'Không phù hợp',
          timeframes: 'H4, D1',
          pros: [],
          tips: 'Nên dùng EMA200 cho swing trading'
        }
      },
      'RSI_EMA200': {
        scalping: {
          suitability: 'Không phù hợp',
          timeframes: 'H1, H4',
          pros: [],
          tips: 'Quá chậm cho scalping'
        },
        dayTrading: {
          suitability: 'Phù hợp có điều kiện',
          timeframes: 'H1, H4',
          pros: ['Xác định xu hướng chính chính xác'],
          tips: 'Kết hợp với EMA50 để tìm điểm vào'
        },
        swingTrading: {
          suitability: 'Rất phù hợp',
          timeframes: 'H4, D1',
          pros: ['Lọc nhiễu tốt', 'Xác định xu hướng dài hạn'],
          tips: 'Tối ưu cho giao dịch theo xu hướng'
        }
      },
      'BB_RSI': {
        scalping: {
          suitability: 'Phù hợp trong sideway',
          timeframes: '5m, 15m',
          pros: ['Tốt cho thị trường đi ngang'],
          tips: 'Tránh dùng khi trending mạnh'
        },
        dayTrading: {
          suitability: 'Phù hợp',
          timeframes: '15m, 30m',
          pros: ['Xác định vùng quá mua/bán', 'Tìm điểm reversal'],
          tips: 'Kết hợp với volume để xác nhận breakout'
        },
        swingTrading: {
          suitability: 'Phù hợp có điều kiện',
          timeframes: 'H4, D1',
          pros: ['Xác định vùng giá rộng'],
          tips: 'Thích hợp cho thị trường sideway dài hạn'
        }
      },
      'STOCHASTIC_RSI': {
        scalping: {
          suitability: 'Phù hợp cho mean reversion',
          timeframes: '5m, 15m',
          pros: ['Tốt cho thị trường sideway', 'Phát hiện divergence'],
          tips: 'Kết hợp với volume để xác nhận reversal'
        },
        dayTrading: {
          suitability: 'Rất phù hợp',
          timeframes: '15m, 30m',
          pros: ['Mean reversion hiệu quả', 'Divergence signals'],
          tips: 'Tối ưu cho range-bound markets'
        },
        swingTrading: {
          suitability: 'Phù hợp có điều kiện',
          timeframes: '1h, 4h',
          pros: ['Xác định reversal points'],
          tips: 'Cần thị trường có range rõ ràng'
        }
      },
      'BB_SQUEEZE': {
        scalping: {
          suitability: 'Phù hợp cho breakout',
          timeframes: '5m, 15m',
          pros: ['Phát hiện market compression', 'Breakout signals'],
          tips: 'Chờ squeeze completion trước khi vào lệnh'
        },
        dayTrading: {
          suitability: 'Rất phù hợp',
          timeframes: '15m, 1h',
          pros: ['Breakout detection', 'Volume confirmation'],
          tips: 'Tối ưu cho volatile markets'
        },
        swingTrading: {
          suitability: 'Phù hợp',
          timeframes: '1h, 4h',
          pros: ['Major breakout signals'],
          tips: 'Cần patience để chờ squeeze'
        }
      },
      'SUPPORT_RESISTANCE': {
        scalping: {
          suitability: 'Không phù hợp',
          timeframes: '1h, 4h',
          pros: [],
          tips: 'Cần thời gian để xác định levels'
        },
        dayTrading: {
          suitability: 'Phù hợp',
          timeframes: '1h, 4h',
          pros: ['Key level identification', 'Breakout/retest signals'],
          tips: 'Tối ưu cho swing trading'
        },
        swingTrading: {
          suitability: 'Rất phù hợp',
          timeframes: '4h, D1',
          pros: ['Major support/resistance', 'Trend continuation'],
          tips: 'Cần historical data để xác định levels'
        }
      }
    };
    return info[strategy as keyof typeof info];
  };

  const getTooltipContent = (strategy: string, tradingStyle: 'scalping' | 'dayTrading' | 'swingTrading') => {
    const info = getStrategyInfo(strategy);
    if (!info) return '';

    const styleInfo = info[tradingStyle];
    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
          {tradingStyle === 'scalping' ? 'Scalping' : 
           tradingStyle === 'dayTrading' ? 'Day Trading' : 'Swing Trading'}
        </Typography>
        <Typography variant="body2">Độ phù hợp: {styleInfo.suitability}</Typography>
        <Typography variant="body2">Khung thời gian: {styleInfo.timeframes}</Typography>
        {styleInfo.pros.length > 0 && (
          <Typography variant="body2">
            Ưu điểm: {styleInfo.pros.join(', ')}
          </Typography>
        )}
        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
          Lưu ý: {styleInfo.tips}
        </Typography>
      </Box>
    );
  };

  const LoadingBar = memo(({ strategy }: { strategy: string }) => {
    const requiredCandles = getRequiredCandles();
    const totalCollected = getTotalCollectedCandles(strategy);
    const activeCandles = getActiveCandles(strategy);
    const estimatedTime = getEstimatedTime(strategy);
    const strategyInfo = getStrategyInfo(strategy);

    return (
      <Alert severity="info" sx={{ mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2">
            {strategy}: {activeCandles}/{requiredCandles} nến đang được sử dụng
            {totalCollected > requiredCandles && 
              ` (Đã thu thập ${totalCollected} nến, đang sử dụng ${requiredCandles} nến gần nhất)`
            }
          </Typography>
          <Box>
            {strategyInfo && (
              <>
                <Tooltip title={getTooltipContent(strategy, 'scalping')} arrow placement="top">
                  <IconButton size="small" sx={{ ml: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>S</Typography>
                  </IconButton>
                </Tooltip>
                <Tooltip title={getTooltipContent(strategy, 'dayTrading')} arrow placement="top">
                  <IconButton size="small" sx={{ ml: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>D</Typography>
                  </IconButton>
                </Tooltip>
                <Tooltip title={getTooltipContent(strategy, 'swingTrading')} arrow placement="top">
                  <IconButton size="small" sx={{ ml: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>SW</Typography>
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </Box>
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
          Thời gian đề xuất để có phân tích đáng tin cậy: {estimatedTime}
        </Typography>
        <LinearProgress 
          variant="determinate" 
          value={getLoadingProgress(strategy)} 
          sx={{ mt: 0.5 }}
        />
      </Alert>
    );
  });

  useEffect(() => {
    const handlePrice = (data: PriceData) => {
      setPrices(prev => {
        const index = prev.findIndex(p => p.symbol === data.symbol);
        const now = Date.now();

        if (index === -1) {
          settings.enabledStrategies.forEach(strategy => {
            updateCandleData(data, strategy);
          });
          return [...prev, { ...data, lastUpdate: now }];
        }

        const lastUpdate = prev[index].lastUpdate || 0;
        const timeDiff = now - lastUpdate;
        
        if (isValidTimeframe(settings.timeframe) && timeDiff >= timeframeInMs[settings.timeframe]) {
          settings.enabledStrategies.forEach(strategy => {
            updateCandleData(data, strategy);
          });
          const newPrices = [...prev];
          newPrices[index] = { ...data, lastUpdate: now };
          return newPrices;
        }

        const newPrices = [...prev];
        newPrices[index] = { ...data, lastUpdate: prev[index].lastUpdate };
        return newPrices;
      });
    };

    const handleAccount = (data: AccountData) => {
      setAccount(data);
    };

    console.log('Connecting to WebSocket...');
    wsService.connect(handlePrice, handleAccount);

    return () => {
      console.log('Disconnecting from WebSocket...');
      wsService.disconnect();
    };
  }, [settings.timeframe, settings.enabledStrategies, updateCandleData, timeframeInMs]);

  const handleTimeframeChange = (timeframe: string) => {
    console.log('Timeframe changing to:', timeframe);
    const newSettings = { ...settings, timeframe };
    setSettings(newSettings);
    setCandleCounts(initialCandleCounts);
    wsService.updateSettings(newSettings);
  };

  const handleRiskRewardRatioChange = (riskRewardRatio: number) => {
    const newSettings = { ...settings, riskRewardRatio };
    setSettings(newSettings);
    wsService.updateSettings(newSettings);
  };

  const handleStrategyChange = (strategy: 'RSI_EMA50' | 'RSI_EMA200' | 'BB_RSI' | 'SR_VOLUME' | 'ICHIMOKU' | 'MACD_VOLUME' | 'ATR_DYNAMIC' | 'MTF_TREND' | 'STOCHASTIC_RSI' | 'BB_SQUEEZE' | 'SUPPORT_RESISTANCE') => {
    console.log('Strategy changing to:', strategy);
    const newSettings = { ...settings, strategy };
    setSettings(newSettings);
    wsService.updateSettings(newSettings);
  };

  const handleEnabledStrategiesChange = (enabledStrategies: string[]) => {
    const newSettings = { ...settings, enabledStrategies };
    setSettings(newSettings);
    wsService.updateSettings(newSettings);
  };

  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Live Trading" />
          <Tab label="Backtest" />
          <Tab label="Advanced Backtest" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Box>
          <TradingSettings
            timeframe={settings.timeframe}
            riskRewardRatio={settings.riskRewardRatio}
            strategy={settings.strategy}
            enabledStrategies={settings.enabledStrategies}
            onTimeframeChange={handleTimeframeChange}
            onRiskRewardRatioChange={handleRiskRewardRatioChange}
            onStrategyChange={handleStrategyChange}
            onEnabledStrategiesChange={handleEnabledStrategiesChange}
          />
          {candleCounts[settings.strategy] < getRequiredCandles() && (
            <LoadingBar strategy={settings.strategy} />
          )}

          <Box sx={{ mb: 2 }}>
            {settings.enabledStrategies
              .filter(s => s !== settings.strategy)
              .map(strategy => (
                <LoadingBar key={strategy} strategy={strategy} />
              ))}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <PriceTable prices={prices} />
            <AccountInfo account={account} />
          </Box>
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          <BacktestPanel />
        </Box>
      )}

      {activeTab === 2 && (
        <Box>
          <AdvancedBacktestPanel />
        </Box>
      )}
    </Container>
  );
}

export default App;
