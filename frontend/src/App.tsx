import React, { useEffect, useState } from 'react';
import { Container, Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { wsService } from './services/websocket.service';
import { PriceData, AccountData, TradingSettings as TradingSettingsType } from './types/websocket.types';
import { TradingSettings } from './components/TradingSettings';

function App() {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [account, setAccount] = useState<AccountData>({ balance: 0, positions: [] });
  const [settings, setSettings] = useState<TradingSettingsType>({
    timeframe: '1m',
    riskRewardRatio: 1.5,
    strategy: 'BB_RSI',
    enabledStrategies: ['BB_RSI', 'SR_VOLUME', 'ICHIMOKU']
  });

  useEffect(() => {
    const handlePrice = (data: PriceData) => {
      setPrices(prev => {
        const index = prev.findIndex(p => p.symbol === data.symbol);
        if (index === -1) {
          return [...prev, data];
        }
        const newPrices = [...prev];
        newPrices[index] = data;
        return newPrices;
      });
    };

    const handleAccount = (data: AccountData) => {
      setAccount(data);
    };

    wsService.connect(handlePrice, handleAccount);

    return () => wsService.disconnect();
  }, []);

  const handleTimeframeChange = (timeframe: string) => {
    const newSettings = { ...settings, timeframe };
    setSettings(newSettings);
    wsService.updateSettings(newSettings);
  };

  const handleRiskRewardRatioChange = (riskRewardRatio: number) => {
    const newSettings = { ...settings, riskRewardRatio };
    setSettings(newSettings);
    wsService.updateSettings(newSettings);
  };

  const handleStrategyChange = (strategy: 'RSI_EMA' | 'BB_RSI' | 'SR_VOLUME' | 'ICHIMOKU') => {
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

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 3 }}>
      <Container>
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
      </Container>
    </Box>
  );
}

export default App;
