import React from 'react';
import {
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  SelectChangeEvent,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';

interface TradingSettingsProps {
  timeframe: string;
  riskRewardRatio: number;
  strategy: 'RSI_EMA' | 'BB_RSI' | 'SR_VOLUME' | 'ICHIMOKU';
  enabledStrategies: string[];
  onTimeframeChange: (timeframe: string) => void;
  onRiskRewardRatioChange: (ratio: number) => void;
  onStrategyChange: (strategy: 'RSI_EMA' | 'BB_RSI' | 'SR_VOLUME' | 'ICHIMOKU') => void;
  onEnabledStrategiesChange: (strategies: string[]) => void;
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

const strategies = [
  { value: 'RSI_EMA', label: 'RSI + EMA Strategy' },
  { value: 'BB_RSI', label: 'Bollinger Bands + RSI' },
  { value: 'SR_VOLUME', label: 'Support/Resistance + Volume' },
  { value: 'ICHIMOKU', label: 'Ichimoku Cloud' },
];

export const TradingSettings: React.FC<TradingSettingsProps> = ({
  timeframe,
  riskRewardRatio,
  strategy,
  enabledStrategies,
  onTimeframeChange,
  onRiskRewardRatioChange,
  onStrategyChange,
  onEnabledStrategiesChange,
}) => {
  const handleTimeframeChange = (event: SelectChangeEvent) => {
    onTimeframeChange(event.target.value);
  };

  const handleRRChange = (event: SelectChangeEvent) => {
    onRiskRewardRatioChange(Number(event.target.value));
  };

  const handleStrategyChange = (event: SelectChangeEvent) => {
    onStrategyChange(event.target.value as 'RSI_EMA' | 'BB_RSI' | 'SR_VOLUME' | 'ICHIMOKU');
  };

  const handleStrategyToggle = (strategyValue: string) => {
    const newEnabledStrategies = enabledStrategies.includes(strategyValue)
      ? enabledStrategies.filter(s => s !== strategyValue)
      : [...enabledStrategies, strategyValue];
    onEnabledStrategiesChange(newEnabledStrategies);
  };

  return (
    <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Trading Settings
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

          <FormControl fullWidth>
            <InputLabel>Primary Strategy</InputLabel>
            <Select
              value={strategy}
              label="Primary Strategy"
              onChange={handleStrategyChange}
            >
              {strategies.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Enabled Strategies
          </Typography>
          <FormGroup row>
            {strategies.map((s) => (
              <FormControlLabel
                key={s.value}
                control={
                  <Checkbox
                    checked={enabledStrategies.includes(s.value)}
                    onChange={() => handleStrategyToggle(s.value)}
                  />
                }
                label={s.label}
              />
            ))}
          </FormGroup>
        </Box>
      </Box>
    </Paper>
  );
}; 