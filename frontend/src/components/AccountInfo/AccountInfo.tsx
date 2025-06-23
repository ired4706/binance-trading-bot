import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography } from '@mui/material';
import { AccountData } from '../../types/websocket.types';

interface AccountInfoProps {
  account: AccountData;
}

export const AccountInfo: React.FC<AccountInfoProps> = ({ account }) => {
  return (
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
  );
}; 