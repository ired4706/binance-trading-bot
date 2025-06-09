import React from 'react';
import {
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  SelectChangeEvent,
} from '@mui/material';

interface TradingSettingsProps {
  timeframe: string;
  riskRewardRatio: number;
  onTimeframeChange: (timeframe: string) => void;
  onRiskRewardRatioChange: (ratio: number) => void;
}

const timeframes = [
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
];

const riskRewardRatios = [
  { value: 1.5, label: '1.5:1' },
  { value: 2, label: '2:1' },
  { value: 2.5, label: '2.5:1' },
  { value: 3, label: '3:1' },
];

export const TradingSettings: React.FC<TradingSettingsProps> = ({
  timeframe,
  riskRewardRatio,
  onTimeframeChange,
  onRiskRewardRatioChange,
}) => {
  const handleTimeframeChange = (event: SelectChangeEvent) => {
    onTimeframeChange(event.target.value);
  };

  const handleRRChange = (event: SelectChangeEvent) => {
    onRiskRewardRatioChange(Number(event.target.value));
  };

  return (
    <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Trading Settings
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <FormControl fullWidth>
          <InputLabel>Timeframe</InputLabel>
          <Select
            value={timeframe}
            label="Timeframe"
            onChange={handleTimeframeChange}
          >
            {timeframes.map((tf) => (
              <MenuItem key={tf.value} value={tf.value}>
                {tf.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Risk/Reward Ratio</InputLabel>
          <Select
            value={riskRewardRatio.toString()}
            label="Risk/Reward Ratio"
            onChange={handleRRChange}
          >
            {riskRewardRatios.map((rr) => (
              <MenuItem key={rr.value} value={rr.value}>
                {rr.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Paper>
  );
}; 