import React, { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react';
import { Container, Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, LinearProgress, Tooltip, IconButton, Tabs, Tab } from '@mui/material';
import { wsService } from './services/websocket.service';
import { PriceData, AccountData, TradingSettings as TradingSettingsType } from './types/websocket.types';
import { TradingSettings } from './components/TradingSettings';
import InfoIcon from '@mui/icons-material/Info';
import { BacktestPanel } from './components/BacktestPanel';

function App() {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [account, setAccount] = useState<AccountData>({ balance: 0, positions: [] });
  const [candleCounts, setCandleCounts] = useState<Record<string, number>>({
    'RSI_EMA50': 0,
    'RSI_EMA200': 0,
    'BB_RSI': 0,
    'SR_VOLUME': 0,
    'ICHIMOKU': 0
  });
  const [settings, setSettings] = useState<TradingSettingsType>({
    timeframe: '1m',
    riskRewardRatio: 1.5,
    strategy: 'RSI_EMA50',
    enabledStrategies: ['RSI_EMA50', 'RSI_EMA200', 'BB_RSI', 'SR_VOLUME', 'ICHIMOKU']
  });

  const candleDataRef = useRef<Record<string, PriceData[]>>({
    'RSI_EMA50': [],
    'RSI_EMA200': [],
    'BB_RSI': [],
    'SR_VOLUME': [],
    'ICHIMOKU': []
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
  }, []);

  const getRequiredCandles = () => {
    const timeframeMultiplier = {
      '1m': 1,
      '3m': 3,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
    }[settings.timeframe] || 1;

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
      default:
        baseCandles = 100;
    }
    
    return Math.ceil(baseCandles / timeframeMultiplier);
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
      default:
        return "";
    }
  };

  const getEstimatedTime = (strategy: string) => {
    const timeMultiplier = {
      '1m': 1,
      '3m': 3,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
    }[settings.timeframe] || 1;

    const recommendedCandles = {
      'RSI_EMA50': 150,  // 2.5 giờ với khung 1m
      'RSI_EMA200': 400, // 6.5 giờ với khung 1m
      'BB_RSI': 60,      // 1 giờ với khung 1m
      'ICHIMOKU': 52,    // Theo yêu cầu cơ bản
      'SR_VOLUME': 100   // Support/Resistance cần ít nhất 100 nến
    }[strategy] || 100;

    const totalMinutes = recommendedCandles * timeMultiplier;
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
    setCandleCounts({
      'RSI_EMA50': 0,
      'RSI_EMA200': 0,
      'BB_RSI': 0,
      'SR_VOLUME': 0,
      'ICHIMOKU': 0
    });
    wsService.updateSettings(newSettings);
  };

  const handleRiskRewardRatioChange = (riskRewardRatio: number) => {
    const newSettings = { ...settings, riskRewardRatio };
    setSettings(newSettings);
    wsService.updateSettings(newSettings);
  };

  const handleStrategyChange = (strategy: 'RSI_EMA50' | 'RSI_EMA200' | 'BB_RSI' | 'SR_VOLUME' | 'ICHIMOKU') => {
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

  const renderPriceChange = (change: number) => (
    <TableCell 
      align="right"
      sx={{ 
        color: change >= 0 ? 'success.main' : 'error.main',
        fontWeight: 'medium'
      }}
    >
      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
    </TableCell>
  );

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
            {/* Price Table */}
            <Paper elevation={3} sx={{ p: 2, flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                Prices
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Symbol</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">1m Change</TableCell>
                      <TableCell align="right">1h Change</TableCell>
                      <TableCell align="right">24h Change</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {prices.map((price) => (
                      <TableRow key={price.symbol}>
                        <TableCell>{price.symbol}</TableCell>
                        <TableCell align="right">${price.price.toLocaleString()}</TableCell>
                        {renderPriceChange(price.change)}
                        {renderPriceChange(price.change1h)}
                        {renderPriceChange(price.change24h)}
                      </TableRow>
                    ))}
                    {prices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          Waiting for price data...
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* Account Info */}
            <Paper elevation={3} sx={{ p: 2, flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                Account Balance: ${account.balance.toLocaleString()}
              </Typography>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Positions
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Symbol</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Entry Price</TableCell>
                      <TableCell align="right">Current Price</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">PnL</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {account.positions.map((position) => (
                      <TableRow key={position.id}>
                        <TableCell>{position.symbol}</TableCell>
                        <TableCell sx={{ color: position.type === 'BUY' ? 'success.main' : 'error.main' }}>
                          {position.type}
                        </TableCell>
                        <TableCell align="right">${position.entryPrice.toLocaleString()}</TableCell>
                        <TableCell align="right">${position.currentPrice.toLocaleString()}</TableCell>
                        <TableCell align="right">{position.quantity}</TableCell>
                        <TableCell 
                          align="right"
                          sx={{ color: position.pnl >= 0 ? 'success.main' : 'error.main' }}
                        >
                          ${position.pnl.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {account.positions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          No open positions
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          <BacktestPanel />
        </Box>
      )}
    </Container>
  );
}

export default App;
