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
  Chip,
  Tabs,
  Tab
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
  { value: 'RSI_EMA50', label: 'RSI + EMA50 Strategy' },
  { value: 'BB_RSI', label: 'Bollinger Bands + RSI Strategy' },
  { value: 'MACD_VOLUME', label: 'MACD + Volume Strategy' },
  { value: 'ATR_DYNAMIC', label: 'ATR Dynamic Strategy' },
  { value: 'MTF_TREND', label: 'Multi-Timeframe Trend Strategy' }
];

const DEFAULT_CONFIG = {
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
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`advanced-tabpanel-${index}`}
      aria-labelledby={`advanced-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Strategy recommendation logic (same as BacktestPanel)
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

export const AdvancedBacktestPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [strategy, setStrategy] = useState('RSI_EMA50');
  const [interval, setInterval] = useState('5m');
  const [timeRange, setTimeRange] = useState('1m');
  const [symbol, setSymbol] = useState('ADAUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  
  // Results states
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [monteCarloResult, setMonteCarloResult] = useState<any>(null);
  const [comparisonResult, setComparisonResult] = useState<any>(null);

  // Optimization specific states
  const [paramRanges, setParamRanges] = useState({
    stopLoss: [1, 2, 3, 4, 5],
    takeProfit: [2, 3, 4, 5, 6],
    positionSize: [5, 10, 15, 20]
  });

  // Monte Carlo specific states
  const [simulations, setSimulations] = useState(1000);

  // Comparison specific states
  const [selectedStrategies, setSelectedStrategies] = useState(['RSI_EMA50', 'BB_RSI', 'MACD_VOLUME']);

  // Strategy suggestion states
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [strategySuggestions, setStrategySuggestions] = useState<any[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, [e.target.name]: Number(e.target.value) });
  };

  const getTimeRangeDates = () => {
    const now = new Date();
    const endTime = now.getTime();
    
    const selectedRange = TIME_RANGES.find(range => range.value === timeRange);
    if (!selectedRange) {
      return { startTime: undefined, endTime: undefined };
    }

    const startTime = new Date(now.getTime() - (selectedRange.days * 24 * 60 * 60 * 1000)).getTime();
    return { startTime, endTime };
  };

  const handleOptimization = async () => {
    setLoading(true);
    setError(null);
    setOptimizationResult(null);
    
    try {
      const { startTime, endTime } = getTimeRangeDates();
      
      const res = await axios.post('/api/backtest/optimize', {
        symbol,
        interval,
        strategy,
        startTime,
        endTime,
        config,
        paramRanges
      });
      setOptimizationResult(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  const handleMonteCarlo = async () => {
    setLoading(true);
    setError(null);
    setMonteCarloResult(null);
    
    try {
      const { startTime, endTime } = getTimeRangeDates();
      
      const res = await axios.post('/api/backtest/monte-carlo', {
        symbol,
        interval,
        strategy,
        startTime,
        endTime,
        config,
        simulations
      });
      setMonteCarloResult(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  const handleComparison = async () => {
    setLoading(true);
    setError(null);
    setComparisonResult(null);
    
    try {
      const { startTime, endTime } = getTimeRangeDates();
      
      const res = await axios.post('/api/backtest/compare', {
        symbol,
        interval,
        startTime,
        endTime,
        config,
        strategies: selectedStrategies
      });
      setComparisonResult(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
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

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const renderOptimizationTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: '#90caf9', mb: 2 }}>
        🔧 Parameter Optimization
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Stop Loss Range"
            value={paramRanges.stopLoss.join(', ')}
            onChange={(e) => setParamRanges({
              ...paramRanges,
              stopLoss: e.target.value.split(',').map(v => Number(v.trim())).filter(v => !isNaN(v))
            })}
            helperText="Nhập các giá trị cách nhau bởi dấu phẩy"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#ffffff',
                '& fieldset': { borderColor: '#555' },
                '&:hover fieldset': { borderColor: '#90caf9' },
                '&.Mui-focused fieldset': { borderColor: '#90caf9' }
              },
              '& .MuiInputLabel-root': { color: '#ffffff' },
              '& .MuiFormHelperText-root': { color: '#aaa' }
            }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Take Profit Range"
            value={paramRanges.takeProfit.join(', ')}
            onChange={(e) => setParamRanges({
              ...paramRanges,
              takeProfit: e.target.value.split(',').map(v => Number(v.trim())).filter(v => !isNaN(v))
            })}
            helperText="Nhập các giá trị cách nhau bởi dấu phẩy"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#ffffff',
                '& fieldset': { borderColor: '#555' },
                '&:hover fieldset': { borderColor: '#90caf9' },
                '&.Mui-focused fieldset': { borderColor: '#90caf9' }
              },
              '& .MuiInputLabel-root': { color: '#ffffff' },
              '& .MuiFormHelperText-root': { color: '#aaa' }
            }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Position Size Range"
            value={paramRanges.positionSize.join(', ')}
            onChange={(e) => setParamRanges({
              ...paramRanges,
              positionSize: e.target.value.split(',').map(v => Number(v.trim())).filter(v => !isNaN(v))
            })}
            helperText="Nhập các giá trị cách nhau bởi dấu phẩy"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#ffffff',
                '& fieldset': { borderColor: '#555' },
                '&:hover fieldset': { borderColor: '#90caf9' },
                '&.Mui-focused fieldset': { borderColor: '#90caf9' }
              },
              '& .MuiInputLabel-root': { color: '#ffffff' },
              '& .MuiFormHelperText-root': { color: '#aaa' }
            }}
          />
        </Grid>
      </Grid>

      <Button
        variant="contained"
        onClick={handleOptimization}
        disabled={loading}
        sx={{ mb: 3 }}
      >
        {loading ? 'Đang tối ưu hóa...' : 'Tối ưu hóa Parameters'}
      </Button>

      {optimizationResult && (
        <Card sx={{ backgroundColor: '#2d2d2d', color: '#ffffff' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: '#4caf50' }}>
              🏆 Kết quả tối ưu hóa
            </Typography>
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ color: '#90caf9', mb: 1 }}>
                  Best Parameters:
                </Typography>
                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                  Stop Loss: {optimizationResult.bestParams.stopLoss}%
                </Typography>
                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                  Take Profit: {optimizationResult.bestParams.takeProfit}%
                </Typography>
                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                  Position Size: {optimizationResult.bestParams.positionSize}%
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ color: '#90caf9', mb: 1 }}>
                  Best Performance:
                </Typography>
                <Typography variant="body2" sx={{ color: '#4caf50' }}>
                  Return: {formatPercentage(optimizationResult.bestPerformance.netTotalReturnPercentage)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#90caf9' }}>
                  Sharpe: {optimizationResult.bestPerformance.netSharpeRatio.toFixed(2)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ff9800' }}>
                  Win Rate: {formatPercentage(optimizationResult.bestPerformance.netWinRate)}
                </Typography>
              </Grid>
            </Grid>

            <Typography variant="subtitle1" sx={{ color: '#90caf9', mb: 1 }}>
              Tổng số combinations đã test: {optimizationResult.allResults.length}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );

  const renderMonteCarloTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: '#90caf9', mb: 2 }}>
        🎲 Monte Carlo Simulation
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Số lượng simulations"
            type="number"
            value={simulations}
            onChange={(e) => setSimulations(Number(e.target.value))}
            inputProps={{ min: 100, max: 10000 }}
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

      <Button
        variant="contained"
        onClick={handleMonteCarlo}
        disabled={loading}
        sx={{ mb: 3 }}
      >
        {loading ? 'Đang chạy simulation...' : 'Chạy Monte Carlo'}
      </Button>

      {monteCarloResult && (
        <Card sx={{ backgroundColor: '#2d2d2d', color: '#ffffff' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: '#4caf50' }}>
              📊 Kết quả Monte Carlo ({monteCarloResult.simulations} simulations)
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ color: '#90caf9', mb: 1 }}>
                  Confidence Intervals:
                </Typography>
                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                  95%: {formatPercentage(monteCarloResult.confidenceIntervals.p95)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                  90%: {formatPercentage(monteCarloResult.confidenceIntervals.p90)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                  75%: {formatPercentage(monteCarloResult.confidenceIntervals.p75)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                  50%: {formatPercentage(monteCarloResult.confidenceIntervals.p50)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ color: '#90caf9', mb: 1 }}>
                  Risk Analysis:
                </Typography>
                <Typography variant="body2" sx={{ color: '#ff6b6b' }}>
                  Worst Case: {formatPercentage(monteCarloResult.worstCase)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#4caf50' }}>
                  Best Case: {formatPercentage(monteCarloResult.bestCase)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#90caf9' }}>
                  Expected: {formatPercentage(monteCarloResult.expectedValue)}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );

  const renderComparisonTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: '#90caf9', mb: 2 }}>
        🔄 Strategy Comparison
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <Typography variant="subtitle1" sx={{ color: '#ffffff', mb: 1 }}>
            Chọn strategies để so sánh:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {strategyOptions.map(opt => (
              <Chip
                key={opt.value}
                label={opt.label}
                onClick={() => {
                  if (selectedStrategies.includes(opt.value)) {
                    setSelectedStrategies(selectedStrategies.filter(s => s !== opt.value));
                  } else {
                    setSelectedStrategies([...selectedStrategies, opt.value]);
                  }
                }}
                color={selectedStrategies.includes(opt.value) ? 'primary' : 'default'}
                variant={selectedStrategies.includes(opt.value) ? 'filled' : 'outlined'}
                sx={{ color: selectedStrategies.includes(opt.value) ? '#ffffff' : '#ffffff' }}
              />
            ))}
          </Box>
        </Grid>
      </Grid>

      <Button
        variant="contained"
        onClick={handleComparison}
        disabled={loading || selectedStrategies.length < 2}
        sx={{ mb: 3 }}
      >
        {loading ? 'Đang so sánh...' : 'So sánh Strategies'}
      </Button>

      {comparisonResult && (
        <Card sx={{ backgroundColor: '#2d2d2d', color: '#ffffff' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: '#4caf50' }}>
              🏆 Strategy Ranking
            </Typography>
            
            <Typography variant="subtitle1" sx={{ color: '#90caf9', mb: 2 }}>
              Best Strategy: {comparisonResult.bestStrategy}
            </Typography>
            
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#1e1e1e' }}>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 'bold' }}>Strategy</TableCell>
                    <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 'bold' }}>Return (%)</TableCell>
                    <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 'bold' }}>Sharpe</TableCell>
                    <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 'bold' }}>Win Rate (%)</TableCell>
                    <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 'bold' }}>Max DD (%)</TableCell>
                    <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 'bold' }}>Trades</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {comparisonResult.results.filter((r: any) => r.success).map((result: any, idx: number) => (
                    <TableRow 
                      key={result.strategy}
                      sx={{ 
                        backgroundColor: idx === 0 ? '#2e7d32' : '#2d2d2d',
                        '&:hover': { backgroundColor: idx === 0 ? '#388e3c' : '#3d3d3d' }
                      }}
                    >
                      <TableCell sx={{ color: '#ffffff' }}>
                        {result.strategy}
                        {idx === 0 && <Chip label="🏆" size="small" sx={{ ml: 1 }} />}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#4caf50' }}>
                        {formatPercentage(result.performance.netTotalReturnPercentage)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#90caf9' }}>
                        {result.performance.netSharpeRatio.toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#ff9800' }}>
                        {formatPercentage(result.performance.netWinRate)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#ff6b6b' }}>
                        {formatPercentage(result.performance.netMaxDrawdownPercentage)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#ffffff' }}>
                        {result.totalTrades}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: 3 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, backgroundColor: '#1e1e1e', color: '#ffffff' }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3, color: '#90caf9' }}>
          🚀 Advanced Backtest System
        </Typography>

        {/* Configuration Section */}
        <Card sx={{ mb: 4, backgroundColor: '#2d2d2d', color: '#ffffff' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3, color: '#ffffff' }}>
              ⚙️ Cấu hình chung
            </Typography>
            
            <Grid container spacing={3}>
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
                        {opt.label}
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
                        {strategySuggestions.slice(0, 4).map((rec, index) => (
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
            </Grid>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 3, backgroundColor: '#d32f2f', color: '#ffffff' }}>
            ❌ {error}
          </Alert>
        )}

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: '#555', mb: 3 }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{
              '& .MuiTab-root': { color: '#ffffff' },
              '& .Mui-selected': { color: '#90caf9' },
              '& .MuiTabs-indicator': { backgroundColor: '#90caf9' }
            }}
          >
            <Tab label="Optimization" />
            <Tab label="Monte Carlo" />
            <Tab label="Comparison" />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          {renderOptimizationTab()}
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          {renderMonteCarloTab()}
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          {renderComparisonTab()}
        </TabPanel>
      </Paper>
    </Box>
  );
}; 