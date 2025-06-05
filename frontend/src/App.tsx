import React, { useEffect, useState } from 'react';
import { Container, Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { wsService } from './services/websocket.service';
import { PriceData, AccountData } from './types/websocket.types';

function App() {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [account, setAccount] = useState<AccountData>({ balance: 0, positions: [] });

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

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 3 }}>
      <Container>
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
                    <TableCell align="right">Change</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {prices.map((price) => (
                    <TableRow key={price.symbol}>
                      <TableCell>{price.symbol}</TableCell>
                      <TableCell align="right">${price.price.toLocaleString()}</TableCell>
                      <TableCell 
                        align="right"
                        sx={{ color: price.change >= 0 ? 'success.main' : 'error.main' }}
                      >
                        {price.change}%
                      </TableCell>
                    </TableRow>
                  ))}
                  {prices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
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
