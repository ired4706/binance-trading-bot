import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography } from '@mui/material';
import { PriceData } from '../../types/websocket.types';

interface PriceTableProps {
  prices: PriceData[];
}

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

export const PriceTable: React.FC<PriceTableProps> = ({ prices }) => {
  return (
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
  );
}; 