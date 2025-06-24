import React, { useState } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Grid,
  Card,
  CardContent,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';

const INTERVALS = [
  { value: '1m', label: '1 phút' },
  { value: '5m', label: '5 phút' },
  { value: '15m', label: '15 phút' },
  { value: '1h', label: '1 giờ' },
  { value: '4h', label: '4 giờ' }
];

const TIME_RANGES = [
  { value: '1d', label: '1 ngày', days: 1 },
  { value: '1w', label: '1 tuần', days: 7 },
  { value: '1m', label: '1 tháng', days: 30 },
  { value: '3m', label: '3 tháng', days: 90 },
  { value: '6m', label: '6 tháng', days: 180 },
  { value: '1y', label: '1 năm', days: 365 },
  { value: 'custom', label: 'Tùy chỉnh', days: 0 }
];

const strategyOptions = [
  { value: 'RSI_EMA50', label: 'RSI + EMA50 Strategy', description: 'Kết hợp RSI momentum với EMA50 trend filter' },
  { value: 'RSI_EMA200', label: 'RSI + EMA200 Strategy', description: 'Kết hợp RSI momentum với EMA200 trend filter' },
  { value: 'BB_RSI', label: 'Bollinger Bands + RSI Strategy', description: 'Sử dụng Bollinger Bands cho volatility và RSI cho momentum' },
  { value: 'SR_VOLUME', label: 'Support/Resistance + Volume Strategy', description: 'Kết hợp support/resistance levels với volume analysis' },
  { value: 'ICHIMOKU', label: 'Ichimoku Strategy', description: 'Sử dụng Ichimoku Cloud cho trend analysis' },
  { value: 'MACD_VOLUME', label: 'MACD + Volume Strategy', description: 'Kết hợp MACD trend detection với volume confirmation' },
  { value: 'ATR_DYNAMIC', label: 'ATR Dynamic Strategy', description: 'Sử dụng ATR cho dynamic stop loss và volatility analysis' },
  { value: 'MTF_TREND', label: 'Multi-Timeframe Trend Strategy', description: 'Phân tích trend trên nhiều khung thời gian' },
  { value: 'STOCHASTIC_RSI', label: 'Stochastic + RSI Mean Reversion', description: 'Mean reversion strategy kết hợp Stochastic và RSI divergence' },
  { value: 'BB_SQUEEZE', label: 'Bollinger Bands Squeeze Strategy', description: 'Phát hiện market compression và breakout opportunities' },
  { value: 'SUPPORT_RESISTANCE', label: 'Support/Resistance Breakout Strategy', description: 'Xác định key levels và breakout/retest signals' }
];

// Strategy recommendation logic
const getStrategyRecommendations = (interval: string, timeRange: string) => {
  const recommendations: Array<{
    strategy: string;
    label: string;
    reason: string;
    suitability: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    tradingStyle: string;
    riskLevel: 'Low' | 'Medium' | 'High';
  }> = [];

  const intervalMinutes = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '4h': 240
  }[interval] || 5;

  const timeRangeDays = {
    '1d': 1,
    '1w': 7,
    '1m': 30,
    '3m': 90,
    '6m': 180,
    '1y': 365
  }[timeRange] || 30;

  // Scalping strategies (1m-5m)
  if (intervalMinutes <= 5) {
    recommendations.push({
      strategy: 'RSI_EMA50',
      label: 'RSI + EMA50 Strategy',
      reason: 'Tối ưu cho scalping với phản ứng nhanh, EMA50 filter trend ngắn hạn',
      suitability: 'Excellent',
      tradingStyle: 'Scalping',
      riskLevel: 'High'
    });

    recommendations.push({
      strategy: 'BB_RSI',
      label: 'Bollinger Bands + RSI Strategy',
      reason: 'Phát hiện volatility và momentum tốt cho timeframe nhỏ',
      suitability: 'Good',
      tradingStyle: 'Scalping',
      riskLevel: 'High'
    });

    recommendations.push({
      strategy: 'SR_VOLUME',
      label: 'Support/Resistance + Volume Strategy',
      reason: 'Xác định key levels nhanh chóng với volume confirmation',
      suitability: 'Good',
      tradingStyle: 'Scalping',
      riskLevel: 'Medium'
    });
  }

  // Day Trading strategies (5m-1h)
  if (intervalMinutes >= 5 && intervalMinutes <= 60) {
    recommendations.push({
      strategy: 'MACD_VOLUME',
      label: 'MACD + Volume Strategy',
      reason: 'Trend detection mạnh mẽ với volume confirmation cho day trading',
      suitability: 'Excellent',
      tradingStyle: 'Day Trading',
      riskLevel: 'Medium'
    });

    recommendations.push({
      strategy: 'ATR_DYNAMIC',
      label: 'ATR Dynamic Strategy',
      reason: 'Dynamic stop loss thích ứng với volatility thị trường',
      suitability: 'Good',
      tradingStyle: 'Day Trading',
      riskLevel: 'Medium'
    });

    recommendations.push({
      strategy: 'STOCHASTIC_RSI',
      label: 'Stochastic + RSI Mean Reversion',
      reason: 'Mean reversion hiệu quả trong thị trường sideway',
      suitability: 'Good',
      tradingStyle: 'Day Trading',
      riskLevel: 'Medium'
    });
  }

  // Swing Trading strategies (1h-4h)
  if (intervalMinutes >= 60) {
    recommendations.push({
      strategy: 'MTF_TREND',
      label: 'Multi-Timeframe Trend Strategy',
      reason: 'Phân tích trend đa khung thời gian cho swing trading',
      suitability: 'Excellent',
      tradingStyle: 'Swing Trading',
      riskLevel: 'Low'
    });

    recommendations.push({
      strategy: 'RSI_EMA200',
      label: 'RSI + EMA200 Strategy',
      reason: 'Trend filter dài hạn với momentum confirmation',
      suitability: 'Good',
      tradingStyle: 'Swing Trading',
      riskLevel: 'Low'
    });

    recommendations.push({
      strategy: 'ICHIMOKU',
      label: 'Ichimoku Strategy',
      reason: 'Cloud analysis mạnh mẽ cho trend identification',
      suitability: 'Good',
      tradingStyle: 'Swing Trading',
      riskLevel: 'Low'
    });
  }

  // Long-term strategies (3m+ time range)
  if (timeRangeDays >= 90) {
    recommendations.push({
      strategy: 'SUPPORT_RESISTANCE',
      label: 'Support/Resistance Breakout Strategy',
      reason: 'Key levels analysis hiệu quả cho long-term trading',
      suitability: 'Excellent',
      tradingStyle: 'Position Trading',
      riskLevel: 'Low'
    });

    recommendations.push({
      strategy: 'BB_SQUEEZE',
      label: 'Bollinger Bands Squeeze Strategy',
      reason: 'Breakout detection từ market compression',
      suitability: 'Good',
      tradingStyle: 'Position Trading',
      riskLevel: 'Medium'
    });
  }

  // Volatile market strategies (short time ranges)
  if (timeRangeDays <= 7) {
    recommendations.push({
      strategy: 'ATR_DYNAMIC',
      label: 'ATR Dynamic Strategy',
      reason: 'Dynamic risk management cho thị trường biến động',
      suitability: 'Excellent',
      tradingStyle: 'Volatile Market',
      riskLevel: 'High'
    });
  }

  // Remove duplicates and sort by suitability
  const uniqueRecommendations = recommendations.filter((rec, index, self) => 
    index === self.findIndex(r => r.strategy === rec.strategy)
  );

  return uniqueRecommendations.sort((a, b) => {
    const suitabilityOrder = { 'Excellent': 4, 'Good': 3, 'Fair': 2, 'Poor': 1 };
    return suitabilityOrder[b.suitability] - suitabilityOrder[a.suitability];
  });
};

export const BacktestPanel: React.FC = () => {
  const [strategy, setStrategy] = useState('RSI_EMA50');
  const [interval, setInterval] = useState('5m');
  const [timeRange, setTimeRange] = useState('7d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [symbol, setSymbol] = useState('ADAUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [config, setConfig] = useState({
    initialBalance: 10000,
    positionSize: 10,
    stopLoss: 2,
    takeProfit: 3,
    maxPositions: 1,
    slippage: 0.1,
    tradingFees: 0.1,
    makerFees: 0.075,
    takerFees: 0.1,
    useMakerFees: false
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [strategySuggestions, setStrategySuggestions] = useState<any[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, [e.target.name]: Number(e.target.value) });
  };

  const getTimeRangeDates = () => {
    const now = new Date();
    const endTime = now.getTime();
    
    if (timeRange === 'custom') {
      if (!customStartDate || !customEndDate) {
        return { startTime: undefined, endTime: undefined };
      }
      return {
        startTime: new Date(customStartDate).getTime(),
        endTime: new Date(customEndDate).getTime()
      };
    }

    const selectedRange = TIME_RANGES.find(range => range.value === timeRange);
    if (!selectedRange) {
      return { startTime: undefined, endTime: undefined };
    }

    const startTime = new Date(now.getTime() - (selectedRange.days * 24 * 60 * 60 * 1000)).getTime();
    return { startTime, endTime };
  };

  const handleBacktest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const { startTime, endTime } = getTimeRangeDates();
      
      const res = await axios.post('/api/backtest/run', {
        symbol,
        interval,
        strategy,
        startTime,
        endTime,
        config
      });
      setResult(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getTimeRangeDescription = () => {
    if (timeRange === 'custom') {
      if (!customStartDate || !customEndDate) {
        return 'Vui lòng chọn ngày bắt đầu và kết thúc';
      }
      const start = new Date(customStartDate).toLocaleDateString('vi-VN');
      const end = new Date(customEndDate).toLocaleDateString('vi-VN');
      return `Từ ${start} đến ${end}`;
    }
    
    const selectedRange = TIME_RANGES.find(range => range.value === timeRange);
    if (selectedRange) {
      const endDate = new Date().toLocaleDateString('vi-VN');
      const startDate = new Date(Date.now() - (selectedRange.days * 24 * 60 * 60 * 1000)).toLocaleDateString('vi-VN');
      return `Từ ${startDate} đến ${endDate}`;
    }
    
    return '';
  };

  const handleStrategySuggestion = () => {
    const recommendations = getStrategyRecommendations(interval, timeRange);
    setStrategySuggestions(recommendations);
    setShowSuggestions(true);
  };

  const getSuitabilityColor = (suitability: string) => {
    switch (suitability) {
      case 'Excellent': return '#4caf50';
      case 'Good': return '#90caf9';
      case 'Fair': return '#ff9800';
      case 'Poor': return '#f44336';
      default: return '#ffffff';
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Low': return '#4caf50';
      case 'Medium': return '#ff9800';
      case 'High': return '#f44336';
      default: return '#ffffff';
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, backgroundColor: '#1e1e1e', color: '#ffffff' }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3, color: '#90caf9' }}>
          📊 Backtest {symbol.replace('USDT', '/USDT')}
        </Typography>

        {/* Configuration Section */}
        <Card sx={{ mb: 4, backgroundColor: '#2d2d2d', color: '#ffffff' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3, color: '#ffffff' }}>
              ⚙️ Cấu hình Backtest
            </Typography>
            
            <Grid container spacing={3}>
              {/* Strategy and Interval */}
              <Grid item xs={12} md={3}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel sx={{ color: '#ffffff' }}>Cặp tiền</InputLabel>
                  <Select
                    value={symbol}
                    label="Cặp tiền"
                    onChange={(e) => setSymbol(e.target.value)}
                    sx={{ 
                      color: '#ffffff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#90caf9' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#90caf9' }
                    }}
                  >
                    <MenuItem value="ADAUSDT">ADA/USDT (Cardano)</MenuItem>
                    <MenuItem value="BTCUSDT">BTC/USDT (Bitcoin)</MenuItem>
                    <MenuItem value="ETHUSDT">ETH/USDT (Ethereum)</MenuItem>
                    <MenuItem value="WLDUSDT">WLD/USDT (Worldcoin)</MenuItem>
                    <MenuItem value="XRPUSDT">XRP/USDT (Ripple)</MenuItem>
                    <MenuItem value="SOLUSDT">SOL/USDT (Solana)</MenuItem>
                    <MenuItem value="NEARUSDT">NEAR/USDT (NEAR Protocol)</MenuItem>
                    <MenuItem value="LINKUSDT">LINK/USDT (Chainlink)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel sx={{ color: '#ffffff' }}>Chiến lược</InputLabel>
                  <Select
                    value={strategy}
                    label="Chiến lược"
                    onChange={(e) => setStrategy(e.target.value)}
                    sx={{ 
                      color: '#ffffff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#90caf9' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#90caf9' }
                    }}
                  >
                    {strategyOptions.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>
                        <span>
                          <span style={{ fontWeight: 500, color: '#ffffff' }}>{opt.label}</span>
                          <br />
                          <span style={{ fontSize: 12, color: '#aaa' }}>{opt.description}</span>
                        </span>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel sx={{ color: '#ffffff' }}>Khung thời gian</InputLabel>
                  <Select
                    value={interval}
                    label="Khung thời gian"
                    onChange={(e) => setInterval(e.target.value)}
                    sx={{ 
                      color: '#ffffff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#90caf9' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#90caf9' }
                    }}
                  >
                    {INTERVALS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel sx={{ color: '#ffffff' }}>Khoảng thời gian</InputLabel>
                  <Select
                    value={timeRange}
                    label="Khoảng thời gian"
                    onChange={(e) => setTimeRange(e.target.value)}
                    sx={{ 
                      color: '#ffffff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#90caf9' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#90caf9' }
                    }}
                  >
                    {TIME_RANGES.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Strategy Suggestion Button */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={handleStrategySuggestion}
                    startIcon={<span>🎯</span>}
                    sx={{
                      color: '#90caf9',
                      borderColor: '#90caf9',
                      '&:hover': {
                        borderColor: '#64b5f6',
                        backgroundColor: 'rgba(144, 202, 249, 0.1)'
                      }
                    }}
                  >
                    🎯 Gợi ý Chiến lược Phù hợp
                  </Button>
                </Box>
              </Grid>

              {/* Strategy Suggestions Display */}
              {showSuggestions && strategySuggestions.length > 0 && (
                <Grid item xs={12}>
                  <Card sx={{ mt: 3, backgroundColor: '#1e1e1e', border: '1px solid #90caf9' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ color: '#90caf9', fontWeight: 'bold' }}>
                        🎯 Gợi ý Chiến lược cho {interval} - {timeRange}
                      </Typography>
                      
                      <Grid container spacing={2}>
                        {strategySuggestions.slice(0, 6).map((rec, index) => (
                          <Grid item xs={12} md={6} key={rec.strategy}>
                            <Card sx={{ 
                              backgroundColor: '#2d2d2d', 
                              border: '1px solid #555',
                              cursor: 'pointer',
                              '&:hover': {
                                borderColor: '#90caf9',
                                backgroundColor: '#3d3d3d'
                              }
                            }}
                            onClick={() => {
                              setStrategy(rec.strategy);
                              setShowSuggestions(false);
                            }}
                            >
                              <CardContent sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                                    {rec.label}
                                  </Typography>
                                  <Chip 
                                    label={rec.suitability} 
                                    size="small"
                                    sx={{ 
                                      backgroundColor: getSuitabilityColor(rec.suitability),
                                      color: '#ffffff',
                                      fontWeight: 'bold'
                                    }}
                                  />
                                </Box>
                                
                                <Typography variant="body2" sx={{ color: '#aaa', mb: 1, fontSize: '0.875rem' }}>
                                  {rec.reason}
                                </Typography>
                                
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Chip 
                                    label={rec.tradingStyle} 
                                    size="small"
                                    variant="outlined"
                                    sx={{ 
                                      borderColor: '#90caf9',
                                      color: '#90caf9',
                                      fontSize: '0.75rem'
                                    }}
                                  />
                                  <Chip 
                                    label={`Risk: ${rec.riskLevel}`} 
                                    size="small"
                                    variant="outlined"
                                    sx={{ 
                                      borderColor: getRiskLevelColor(rec.riskLevel),
                                      color: getRiskLevelColor(rec.riskLevel),
                                      fontSize: '0.75rem'
                                    }}
                                  />
                                </Box>
                                
                                <Typography variant="caption" sx={{ color: '#90caf9', display: 'block', mt: 1 }}>
                                  💡 Click để chọn chiến lược này
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                      
                      <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Button
                          variant="text"
                          onClick={() => setShowSuggestions(false)}
                          sx={{ color: '#aaa' }}
                        >
                          Đóng gợi ý
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Custom Date Range */}
              {timeRange === 'custom' && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Ngày bắt đầu"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: '#ffffff',
                          '& fieldset': { borderColor: '#555' },
                          '&:hover fieldset': { borderColor: '#90caf9' },
                          '&.Mui-focused fieldset': { borderColor: '#90caf9' }
                        },
                        '& .MuiInputLabel-root': { color: '#ffffff' }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Ngày kết thúc"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: '#ffffff',
                          '& fieldset': { borderColor: '#555' },
                          '&:hover fieldset': { borderColor: '#90caf9' },
                          '&.Mui-focused fieldset': { borderColor: '#90caf9' }
                        },
                        '& .MuiInputLabel-root': { color: '#ffffff' }
                      }}
                    />
                  </Grid>
                </>
              )}

              {/* Time Range Description */}
              {getTimeRangeDescription() && (
                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ color: '#90caf9', fontStyle: 'italic' }}>
                    📅 {getTimeRangeDescription()}
                  </Typography>
                </Grid>
              )}

              {/* Trading Parameters */}
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Vốn khởi đầu ($)"
                  name="initialBalance"
                  type="number"
                  value={config.initialBalance}
                  onChange={handleChange}
                  inputProps={{ min: 100 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#ffffff',
                      '& fieldset': { borderColor: '#555' },
                      '&:hover fieldset': { borderColor: '#90caf9' },
                      '&.Mui-focused fieldset': { borderColor: '#90caf9' }
                    },
                    '& .MuiInputLabel-root': { color: '#ffffff' }
                  }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Kích thước lệnh (%)"
                  name="positionSize"
                  type="number"
                  value={config.positionSize}
                  onChange={handleChange}
                  inputProps={{ min: 1, max: 100 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#ffffff',
                      '& fieldset': { borderColor: '#555' },
                      '&:hover fieldset': { borderColor: '#90caf9' },
                      '&.Mui-focused fieldset': { borderColor: '#90caf9' }
                    },
                    '& .MuiInputLabel-root': { color: '#ffffff' }
                  }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Stop Loss (%)"
                  name="stopLoss"
                  type="number"
                  value={config.stopLoss}
                  onChange={handleChange}
                  inputProps={{ min: 0.1, step: 0.1 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#ffffff',
                      '& fieldset': { borderColor: '#555' },
                      '&:hover fieldset': { borderColor: '#90caf9' },
                      '&.Mui-focused fieldset': { borderColor: '#90caf9' }
                    },
                    '& .MuiInputLabel-root': { color: '#ffffff' }
                  }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Take Profit (%)"
                  name="takeProfit"
                  type="number"
                  value={config.takeProfit}
                  onChange={handleChange}
                  inputProps={{ min: 0.1, step: 0.1 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#ffffff',
                      '& fieldset': { borderColor: '#555' },
                      '&:hover fieldset': { borderColor: '#90caf9' },
                      '&.Mui-focused fieldset': { borderColor: '#90caf9' }
                    },
                    '& .MuiInputLabel-root': { color: '#ffffff' }
                  }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Slippage (%)"
                  name="slippage"
                  type="number"
                  value={config.slippage}
                  onChange={handleChange}
                  inputProps={{ min: 0.01, step: 0.01 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#ffffff',
                      '& fieldset': { borderColor: '#555' },
                      '&:hover fieldset': { borderColor: '#90caf9' },
                      '&.Mui-focused fieldset': { borderColor: '#90caf9' }
                    },
                    '& .MuiInputLabel-root': { color: '#ffffff' }
                  }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Taker Fees (%)"
                  name="takerFees"
                  type="number"
                  value={config.takerFees}
                  onChange={handleChange}
                  inputProps={{ min: 0.01, step: 0.01 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#ffffff',
                      '& fieldset': { borderColor: '#555' },
                      '&:hover fieldset': { borderColor: '#90caf9' },
                      '&.Mui-focused fieldset': { borderColor: '#90caf9' }
                    },
                    '& .MuiInputLabel-root': { color: '#ffffff' }
                  }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Maker Fees (%)"
                  name="makerFees"
                  type="number"
                  value={config.makerFees}
                  onChange={handleChange}
                  inputProps={{ min: 0.01, step: 0.01 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#ffffff',
                      '& fieldset': { borderColor: '#555' },
                      '&:hover fieldset': { borderColor: '#90caf9' },
                      '&.Mui-focused fieldset': { borderColor: '#90caf9' }
                    },
                    '& .MuiInputLabel-root': { color: '#ffffff' }
                  }}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleBacktest}
                disabled={loading || (timeRange === 'custom' && (!customStartDate || !customEndDate))}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  borderRadius: 2,
                  boxShadow: 3,
                  backgroundColor: '#1976d2',
                  '&:hover': { backgroundColor: '#1565c0' }
                }}
              >
                {loading ? '🔄 Đang chạy backtest...' : '🚀 Chạy Backtest'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 3, backgroundColor: '#d32f2f', color: '#ffffff' }}>
            ❌ {error}
          </Alert>
        )}

        {/* Results Section */}
        {result && (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3, color: '#4caf50' }}>
              📈 Kết quả Backtest
            </Typography>

            {/* Performance Metrics */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={3}>
                <Card sx={{ 
                  backgroundColor: result.performance.netTotalReturn >= 0 ? '#2e7d32' : '#d32f2f',
                  color: '#ffffff'
                }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(result.performance.netTotalReturn)}
                    </Typography>
                    <Typography variant="body2">
                      Lợi nhuận ròng (sau phí)
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                      {formatPercentage(result.performance.netTotalReturnPercentage)}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
                      Gross: {formatCurrency(result.performance.totalReturn)} ({formatPercentage(result.performance.totalReturnPercentage)})
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card sx={{ backgroundColor: '#1976d2', color: '#ffffff' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {result.performance.totalTrades}
                    </Typography>
                    <Typography variant="body2">
                      Tổng số lệnh
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                      {formatPercentage(result.performance.netWinRate)}
                    </Typography>
                    <Typography variant="body2">
                      Tỷ lệ thắng (ròng)
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
                      Gross: {formatPercentage(result.performance.winRate)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card sx={{ backgroundColor: '#ed6c02', color: '#ffffff' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(result.performance.netMaxDrawdown)}
                    </Typography>
                    <Typography variant="body2">
                      Drawdown tối đa (ròng)
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                      {formatPercentage(result.performance.netMaxDrawdownPercentage)}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
                      Gross: {formatCurrency(result.performance.maxDrawdown)} ({formatPercentage(result.performance.maxDrawdownPercentage)})
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card sx={{ backgroundColor: '#0288d1', color: '#ffffff' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {result.performance.netProfitFactor.toFixed(2)}
                    </Typography>
                    <Typography variant="body2">
                      Profit Factor (ròng)
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                      {result.performance.netSharpeRatio.toFixed(2)}
                    </Typography>
                    <Typography variant="body2">
                      Sharpe Ratio (ròng)
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
                      Gross: PF {result.performance.profitFactor.toFixed(2)} | SR {result.performance.sharpeRatio.toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Advanced Metrics */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={3}>
                <Card sx={{ backgroundColor: '#7b1fa2', color: '#ffffff' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {result.performance.calmarRatio.toFixed(2)}
                    </Typography>
                    <Typography variant="body2">
                      Calmar Ratio
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
                      Return/Drawdown ratio
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card sx={{ backgroundColor: '#388e3c', color: '#ffffff' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {result.performance.sortinoRatio.toFixed(2)}
                    </Typography>
                    <Typography variant="body2">
                      Sortino Ratio
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
                      Downside risk adjusted
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card sx={{ backgroundColor: '#f57c00', color: '#ffffff' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(result.performance.totalFees)}
                    </Typography>
                    <Typography variant="body2">
                      Tổng phí giao dịch
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                      {formatCurrency(result.performance.totalSlippage)}
                    </Typography>
                    <Typography variant="body2">
                      Tổng slippage
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card sx={{ backgroundColor: '#d84315', color: '#ffffff' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {result.performance.maxConsecutiveWins}
                    </Typography>
                    <Typography variant="body2">
                      Thắng liên tiếp tối đa
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                      {result.performance.maxConsecutiveLosses}
                    </Typography>
                    <Typography variant="body2">
                      Thua liên tiếp tối đa
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Trade History */}
            <Card sx={{ backgroundColor: '#2d2d2d', color: '#ffffff', mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2, color: '#ffffff' }}>
                  📋 Lịch sử Giao dịch
                </Typography>
                
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#1e1e1e' }}>
                        <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>Thời gian vào</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>Thời gian ra</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>Loại</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>Giá vào</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>Giá ra</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>PNL ròng ($)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>PNL ròng (%)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>Phí + Slippage</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>Lý do đóng</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.trades.map((trade: any, idx: number) => {
                        const totalCosts = trade.entryFees + trade.exitFees + trade.entrySlippage + trade.exitSlippage;
                        
                        // Map exit reason to Vietnamese
                        const exitReasonMap: { [key: string]: string } = {
                          'SIGNAL': 'Tín hiệu SELL',
                          'STOP_LOSS': 'Stop Loss',
                          'TAKE_PROFIT': 'Take Profit',
                          'END_OF_DATA': 'Kết thúc dữ liệu'
                        };
                        
                        return (
                          <TableRow 
                            key={idx}
                            sx={{ 
                              backgroundColor: trade.netPnl >= 0 ? '#1b5e20' : '#b71c1c',
                              '&:hover': { backgroundColor: trade.netPnl >= 0 ? '#2e7d32' : '#d32f2f' },
                              borderColor: '#555'
                            }}
                          >
                            <TableCell sx={{ color: '#ffffff', borderColor: '#555' }}>{new Date(trade.entryTime).toLocaleString()}</TableCell>
                            <TableCell sx={{ color: '#ffffff', borderColor: '#555' }}>{new Date(trade.exitTime).toLocaleString()}</TableCell>
                            <TableCell sx={{ borderColor: '#555' }}>
                              <Chip 
                                label={trade.type} 
                                size="small"
                                color={trade.type === 'BUY' ? 'success' : 'error'}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ color: '#ffffff', borderColor: '#555' }}>{formatCurrency(trade.entryPrice)}</TableCell>
                            <TableCell align="right" sx={{ color: '#ffffff', borderColor: '#555' }}>{formatCurrency(trade.exitPrice)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>
                              {formatCurrency(trade.netPnl)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>
                              {formatPercentage(trade.netPnlPercentage)}
                            </TableCell>
                            <TableCell align="right" sx={{ color: '#ffffff', borderColor: '#555' }}>
                              {formatCurrency(totalCosts)}
                            </TableCell>
                            <TableCell align="right" sx={{ color: '#ffffff', borderColor: '#555' }}>
                              <Chip 
                                label={exitReasonMap[trade.exitReason] || trade.exitReason} 
                                size="small"
                                color={exitReasonMap[trade.exitReason] === 'Stop Loss' ? 'error' : exitReasonMap[trade.exitReason] === 'Take Profit' ? 'success' : 'default'}
                                variant="outlined"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* Debug Information */}
            <Card sx={{ backgroundColor: '#2d2d2d', color: '#ffffff' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2, color: '#ffffff' }}>
                  🔍 Thông tin Debug
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#90caf9', mb: 1 }}>
                      Tham số được sử dụng:
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', mb: 0.5 }}>
                      • Vốn khởi đầu: {formatCurrency(config.initialBalance)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', mb: 0.5 }}>
                      • Kích thước lệnh: {config.positionSize}% ({formatCurrency(config.initialBalance * config.positionSize / 100)})
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', mb: 0.5 }}>
                      • Stop Loss: {config.stopLoss}%
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', mb: 0.5 }}>
                      • Take Profit: {config.takeProfit}%
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#90caf9', mb: 1 }}>
                      Thống kê đóng lệnh:
                    </Typography>
                    {(() => {
                      const totalTrades = result.trades.length;
                      const slTrades = result.trades.filter((trade: any) => {
                        const priceChange = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
                        return priceChange <= -config.stopLoss;
                      }).length;
                      const tpTrades = result.trades.filter((trade: any) => {
                        const priceChange = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
                        return priceChange >= config.takeProfit;
                      }).length;
                      const signalTrades = totalTrades - slTrades - tpTrades;
                      
                      return (
                        <>
                          <Typography variant="body2" sx={{ color: '#ffffff', mb: 0.5 }}>
                            • Tổng lệnh: {totalTrades}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#ff6b6b', mb: 0.5 }}>
                            • Stop Loss: {slTrades} ({totalTrades > 0 ? ((slTrades / totalTrades) * 100).toFixed(1) : 0}%)
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#4caf50', mb: 0.5 }}>
                            • Take Profit: {tpTrades} ({totalTrades > 0 ? ((tpTrades / totalTrades) * 100).toFixed(1) : 0}%)
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#90caf9', mb: 0.5 }}>
                            • Tín hiệu SELL: {signalTrades} ({totalTrades > 0 ? ((signalTrades / totalTrades) * 100).toFixed(1) : 0}%)
                          </Typography>
                        </>
                      );
                    })()}
                  </Grid>
                </Grid>

                {/* Tips for testing SL/TP */}
                <Box sx={{ mt: 3, p: 2, backgroundColor: '#1e1e1e', borderRadius: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#ff9800', mb: 1 }}>
                    💡 Gợi ý để test hiệu quả SL/TP:
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', mb: 0.5 }}>
                    • Chọn khoảng thời gian dài hơn (1 tháng trở lên) để có nhiều biến động
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', mb: 0.5 }}>
                    • Sử dụng khung thời gian nhỏ hơn (1m, 5m) để có nhiều tín hiệu
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', mb: 0.5 }}>
                    • Đặt SL/TP nhỏ hơn (1-2%) để dễ kích hoạt
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', mb: 0.5 }}>
                    • Tăng kích thước lệnh để thấy rõ sự khác biệt về lợi nhuận
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff' }}>
                    • So sánh kết quả với các tham số khác nhau để tìm tối ưu
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}
      </Paper>
    </Box>
  );
}; 