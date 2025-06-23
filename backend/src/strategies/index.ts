import { BaseStrategy } from './baseStrategy';
import { RSI_EMA50Strategy } from './rsiEma50Strategy';
import { BB_RSIStrategy } from './bbRsiStrategy';
import { MACDVolumeStrategy } from './macdVolumeStrategy';
import { ATRDynamicStrategy } from './atrDynamicStrategy';
import { MTFTrendStrategy } from './mtfTrendStrategy';
import { StochasticRsiStrategy } from './stochasticRsiStrategy';
import { BBSqueezeStrategy } from './bbSqueezeStrategy';
import { SupportResistanceStrategy } from './supportResistanceStrategy';

export const strategies: { [key: string]: new (config: any) => BaseStrategy } = {
  'RSI_EMA50': RSI_EMA50Strategy,
  'RSI_EMA200': RSI_EMA50Strategy, // Using same strategy with different parameters
  'BB_RSI': BB_RSIStrategy,
  'SR_VOLUME': MACDVolumeStrategy, // Using MACD Volume as Support/Resistance Volume
  'ICHIMOKU': MTFTrendStrategy, // Using MTF Trend as Ichimoku alternative
  'MACD_VOLUME': MACDVolumeStrategy,
  'ATR_DYNAMIC': ATRDynamicStrategy,
  'MTF_TREND': MTFTrendStrategy,
  'STOCHASTIC_RSI': StochasticRsiStrategy,
  'BB_SQUEEZE': BBSqueezeStrategy,
  'SUPPORT_RESISTANCE': SupportResistanceStrategy
};

export { BaseStrategy } from './baseStrategy';
export { RSI_EMA50Strategy } from './rsiEma50Strategy';
export { BB_RSIStrategy } from './bbRsiStrategy';
export { MACDVolumeStrategy } from './macdVolumeStrategy';
export { ATRDynamicStrategy } from './atrDynamicStrategy';
export { MTFTrendStrategy } from './mtfTrendStrategy';
export { StochasticRsiStrategy } from './stochasticRsiStrategy';
export { BBSqueezeStrategy } from './bbSqueezeStrategy';
export { SupportResistanceStrategy } from './supportResistanceStrategy'; 