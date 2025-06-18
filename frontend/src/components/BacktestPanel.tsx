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
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  ListItemText
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

const STRATEGIES = [
  { value: 'RSI_EMA50', label: 'RSI + EMA50', description: 'Kết hợp RSI momentum với EMA50 trend filter' },
  { value: 'BB_RSI', label: 'Bollinger Bands + RSI', description: 'Sử dụng Bollinger Bands cho volatility và RSI cho momentum' }
];

const DEFAULT_CONFIG = {
  initialBalance: 10000,
  positionSize: 10,
  stopLoss: 2,
  takeProfit: 3,
  maxPositions: 1,
  slippage: 0.1
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
    takeProfit: 3
  });

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
                    {STRATEGIES.map(opt => (
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
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleBacktest}
                disabled={loading || (timeRange === 'custom' && (!customStartDate || !customEndDate))}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
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
                  backgroundColor: result.performance.totalReturn >= 0 ? '#2e7d32' : '#d32f2f',
                  color: '#ffffff'
                }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(result.performance.totalReturn)}
                    </Typography>
                    <Typography variant="body2">
                      Lợi nhuận tổng
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                      {formatPercentage(result.performance.totalReturnPercentage)}
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
                      {formatPercentage(result.performance.winRate)}
                    </Typography>
                    <Typography variant="body2">
                      Tỷ lệ thắng
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card sx={{ backgroundColor: '#ed6c02', color: '#ffffff' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(result.performance.maxDrawdown)}
                    </Typography>
                    <Typography variant="body2">
                      Drawdown tối đa
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                      {formatPercentage(result.performance.maxDrawdownPercentage)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card sx={{ backgroundColor: '#0288d1', color: '#ffffff' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {result.performance.profitFactor.toFixed(2)}
                    </Typography>
                    <Typography variant="body2">
                      Profit Factor
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                      {result.performance.sharpeRatio.toFixed(2)}
                    </Typography>
                    <Typography variant="body2">
                      Sharpe Ratio
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
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>PNL ($)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>PNL (%)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>Lý do đóng</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.trades.map((trade: any, idx: number) => {
                        // Determine exit reason
                        const priceChange = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
                        let exitReason = 'Tín hiệu SELL';
                        if (priceChange <= -config.stopLoss) {
                          exitReason = 'Stop Loss';
                        } else if (priceChange >= config.takeProfit) {
                          exitReason = 'Take Profit';
                        }
                        
                        return (
                          <TableRow 
                            key={idx}
                            sx={{ 
                              backgroundColor: trade.pnl >= 0 ? '#1b5e20' : '#b71c1c',
                              '&:hover': { backgroundColor: trade.pnl >= 0 ? '#2e7d32' : '#d32f2f' },
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
                              {formatCurrency(trade.pnl)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', borderColor: '#555' }}>
                              {formatPercentage(trade.pnlPercentage)}
                            </TableCell>
                            <TableCell align="right" sx={{ color: '#ffffff', borderColor: '#555' }}>
                              <Chip 
                                label={exitReason} 
                                size="small"
                                color={exitReason === 'Stop Loss' ? 'error' : exitReason === 'Take Profit' ? 'success' : 'default'}
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