// strategies.ts - PART 1: Interfaces, Types, and Mathematical Indicators

export interface StrategyProfile {
  id: string;
  name: string;
  tier: 'HIGH' | 'MEDIUM' | 'LOW';
  requiredTicks: number;
  confidenceGate: number;
  description: string;
  // --- MULTI-VOLATILITY & DIVERSE ENGINE CONFIGURATIONS ---
  targetSymbol: 'R_10' | 'R_25' | 'R_50' | 'R_75' | 'R_100';
  contractType: 'RISE_FALL' | 'OVER_UNDER' | 'ACCUMULATOR' | 'TOUCH_NO_TOUCH';
  coreEngine: 'MARTINGALE' | 'DALEMBERT' | 'PROGRESSIVE' | 'NEURAL_FLOW';
}

export interface StrategyResult {
  profileId: string;
  ticksLoaded: number;
  marketState: string;
  direction: string;
  scannerScore: number;
  marketCompatibility: number;
  finalConfidence: number;
  tierOverride: 'HIGH' | 'MEDIUM' | 'LOW';
  status?: 'HIGH' | 'MEDIUM' | 'LOW';
}

// Helper: Calculate Exponential Moving Average (EMA)
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// Helper: Calculate Relative Strength Index (RSI)
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const difference = prices[i] - prices[i - 1];
    if (difference > 0) gains += difference;
    else losses += Math.abs(difference);
  }
  if (losses === 0) return 100;
  return Math.floor(100 - 100 / (1 + (gains / losses)));
}

// Helper: Calculate Historical Standard Deviation (Volatility Measure)
export function calculateVolatility(prices: number[]): number {
  if (prices.length === 0) return 0;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
  return Math.sqrt(variance);
}
// strategies.ts - PART 2A: Profiles Array Registry
import { StrategyProfile } from './strategies';

export const STRATEGY_PROFILES: StrategyProfile[] = [
  { id: 'STRATEGY_1_3_2_6', name: '1-3-2-6 System', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 68, description: 'Fixed progressive staking sequence.', targetSymbol: 'R_10', contractType: 'RISE_FALL', coreEngine: 'PROGRESSIVE' },
  { id: 'ACC_DALEMBERT', name: 'Accumulator D\'Alembert', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 65, description: 'Equilibrium based staking scale.', targetSymbol: 'R_25', contractType: 'ACCUMULATOR', coreEngine: 'DALEMBERT' },
  { id: 'ACC_MARTINGALE', name: 'Accumulator Martingale', tier: 'HIGH', requiredTicks: 100, confidenceGate: 75, description: 'Aggressive recovery multiplier sequence.', targetSymbol: 'R_50', contractType: 'ACCUMULATOR', coreEngine: 'MARTINGALE' },
  { id: 'ACC_REVERSE', name: 'Accumulator Reverse', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 64, description: 'Anti-equilibrium progression pattern.', targetSymbol: 'R_75', contractType: 'ACCUMULATOR', coreEngine: 'PROGRESSIVE' },
  { id: 'ACC_REVERSE_MARTINGALE', name: 'Accumulator Reverse Martingale', tier: 'HIGH', requiredTicks: 100, confidenceGate: 78, description: 'Paroli-style compounding trend rider.', targetSymbol: 'R_100', contractType: 'ACCUMULATOR', coreEngine: 'MARTINGALE' },
  { id: 'AI_ACC_FLOW', name: 'AI Accumulator Flow', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 70, description: 'Neural momentum tracking array.', targetSymbol: 'R_10', contractType: 'ACCUMULATOR', coreEngine: 'NEURAL_FLOW' },
  { id: 'AI_ADAPTIVE', name: 'AI Adaptive', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 60, description: 'Dynamic lookback structural variant.', targetSymbol: 'R_25', contractType: 'RISE_FALL', coreEngine: 'NEURAL_FLOW' },
  { id: 'AI_BALANCED', name: 'AI Balanced', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 65, description: 'Risk-adjusted baseline trend filter.', targetSymbol: 'R_50', contractType: 'OVER_UNDER', coreEngine: 'PROGRESSIVE' },
  { id: 'AI_CONSERVATIVE', name: 'AI Conservative', tier: 'LOW', requiredTicks: 100, confidenceGate: 55, description: 'High-threshold protective entry evaluation.', targetSymbol: 'R_75', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'PROGRESSIVE' },
  { id: 'AI_TREND_PRINTER', name: 'AI Trend Printer', tier: 'HIGH', requiredTicks: 100, confidenceGate: 82, description: 'Continuous micro-trend printing scanner.', targetSymbol: 'R_100', contractType: 'RISE_FALL', coreEngine: 'NEURAL_FLOW' },
  { id: 'DALEMBERT_CLASSIC', name: 'D\'Alembert Classic', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 60, description: 'Classic addition/subtraction unit formula.', targetSymbol: 'R_10', contractType: 'OVER_UNDER', coreEngine: 'DALEMBERT' },
  { id: 'MARTINGALE_CLASSIC', name: 'Martingale Classic', tier: 'HIGH', requiredTicks: 100, confidenceGate: 75, description: 'Standard linear loss doubling matrix.', targetSymbol: 'R_25', contractType: 'RISE_FALL', coreEngine: 'MARTINGALE' },
  { id: 'OSCARS_GRIND', name: 'Oscar\'s Grind', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 62, description: 'Targeted single-unit win progression tracking.', targetSymbol: 'R_50', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'PROGRESSIVE' },
  { id: 'REVERSE_DALEMBERT', name: 'Reverse D\'Alembert', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 61, description: 'Inverted risk distribution progression.', targetSymbol: 'R_75', contractType: 'OVER_UNDER', coreEngine: 'DALEMBERT' },
  { id: 'REVERSE_MARTINGALE', name: 'Reverse Martingale', tier: 'HIGH', requiredTicks: 100, confidenceGate: 76, description: 'Compounded profit maximizing pipeline.', targetSymbol: 'R_100', contractType: 'RISE_FALL', coreEngine: 'MARTINGALE' },
  { id: 'AI_ALPHA_V16', name: 'AI Alpha Engine v16', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 66, description: 'Predictive neural trend optimization layer.', targetSymbol: 'R_10', contractType: 'OVER_UNDER', coreEngine: 'NEURAL_FLOW' },
  { id: 'AI_ALPHA_V17', name: 'AI Alpha Engine v17', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 67, description: 'Dynamic multi-asset lookback tracking matrix.', targetSymbol: 'R_25', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'NEURAL_FLOW' },
  { id: 'AI_ALPHA_V18', name: 'AI Alpha Engine v18', tier: 'LOW', requiredTicks: 100, confidenceGate: 58, description: 'High-frequency variance boundary check core.', targetSymbol: 'R_50', contractType: 'ACCUMULATOR', coreEngine: 'NEURAL_FLOW' },
  { id: 'AI_ALPHA_V19', name: 'AI Alpha Engine v19', tier: 'HIGH', requiredTicks: 100, confidenceGate: 79, description: 'Deep learning classification vector processor.', targetSymbol: 'R_75', contractType: 'RISE_FALL', coreEngine: 'NEURAL_FLOW' },
  { id: 'AI_ALPHA_V20', name: 'AI Alpha Engine v20', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 70, description: 'Neural momentum delta tracking array node.', targetSymbol: 'R_100', contractType: 'OVER_UNDER', coreEngine: 'NEURAL_FLOW' },
  { id: 'AI_QUANT_V21', name: 'AI Quant Matrix v21', tier: 'HIGH', requiredTicks: 100, confidenceGate: 81, description: 'Statistical boundary exhaustion trend filter.', targetSymbol: 'R_10', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'PROGRESSIVE' },
  { id: 'AI_QUANT_V22', name: 'AI Quant Matrix v22', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 64, description: 'Volatility range consolidation index scanner.', targetSymbol: 'R_25', contractType: 'ACCUMULATOR', coreEngine: 'PROGRESSIVE' },
  { id: 'AI_QUANT_V23', name: 'AI Quant Matrix v23', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 69, description: 'Micro-fractal price velocity calculation network.', targetSymbol: 'R_50', contractType: 'RISE_FALL', coreEngine: 'PROGRESSIVE' },
  { id: 'AI_QUANT_V24', name: 'AI Quant Matrix v24', tier: 'LOW', requiredTicks: 100, confidenceGate: 56, description: 'Moving average convergence divergence tracking.', targetSymbol: 'R_75', contractType: 'OVER_UNDER', coreEngine: 'PROGRESSIVE' },
  { id: 'AI_QUANT_V25', name: 'AI Quant Matrix v25', tier: 'HIGH', requiredTicks: 100, confidenceGate: 77, description: 'Explosive micro-breakout trend vector tracker.', targetSymbol: 'R_100', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'PROGRESSIVE' },
  { id: 'HYPER_SCALPER_V26', name: 'Hyper Scalper Engine v26', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 65, description: 'Sub-second structural tick execution array.', targetSymbol: 'R_10', contractType: 'RISE_FALL', coreEngine: 'MARTINGALE' },
  { id: 'HYPER_SCALPER_V27', name: 'Hyper Scalper Engine v27', tier: 'HIGH', requiredTicks: 100, confidenceGate: 78, description: 'Aggressive rapid price velocity spike scanner.', targetSymbol: 'R_25', contractType: 'OVER_UNDER', coreEngine: 'MARTINGALE' },
  { id: 'TREND_SHIELD_V28', name: 'Trend Shield Pro v28', tier: 'HIGH', requiredTicks: 100, confidenceGate: 80, description: 'Counter-trend entry denial asset protector.', targetSymbol: 'R_50', contractType: 'RISE_FALL', coreEngine: 'PROGRESSIVE' },
  { id: 'BAYESIAN_V29', name: 'Bayesian Tracker v29', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 71, description: 'Conditional probability distribution network.', targetSymbol: 'R_75', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'NEURAL_FLOW' },
  { id: 'CHOP_ZONE_V30', name: 'Chop Zone Indexer v30', tier: 'LOW', requiredTicks: 100, confidenceGate: 50, description: 'Sideways market phase identifier.', targetSymbol: 'R_100', contractType: 'OVER_UNDER', coreEngine: 'DALEMBERT' }
];
// strategies.ts - PART 2B: Live Evaluation Engine Logic
import { StrategyProfile, StrategyResult, calculateEMA, calculateRSI, calculateVolatility } from './strategies';

export function evaluateStrategy(profile: StrategyProfile, ticks: number[]): StrategyResult {
  const currentCount = ticks.length;
  
  if (currentCount < profile.requiredTicks) {
    return {
      profileId: profile.id,
      ticksLoaded: currentCount,
      marketState: 'INSUFFICIENT_DATA',
      direction: 'FLAT',
      scannerScore: 0,
      marketCompatibility: 0,
      finalConfidence: 0,
      tierOverride: profile.tier
    };
  }

  const strategySeed = profile.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const fastEma = calculateEMA(ticks, 12);
  const slowEma = calculateEMA(ticks, 26);
  const rsiValue = calculateRSI(ticks, 14);
  const volatility = calculateVolatility(ticks.slice(-30));

  let marketDirection = 'FLAT';
  if (fastEma > slowEma + 0.05) marketDirection = 'UP';
  else if (fastEma < slowEma - 0.05) marketDirection = 'DOWN';

  let scannerScore = 50;
  let marketCompatibility = 50;

  // --- DIVERSIFIED CONTRACT MATHEMATICAL SCORING MODIFIERS ---
  if (profile.contractType === 'RISE_FALL') {
    scannerScore = marketDirection !== 'FLAT' ? 78 : 45;
    marketCompatibility = rsiValue > 55 || rsiValue < 45 ? 74 : 50;
  } else if (profile.contractType === 'OVER_UNDER') {
    scannerScore = marketDirection === 'FLAT' ? 82 : 52;
    marketCompatibility = rsiValue >= 42 && rsiValue <= 58 ? 80 : 46;
  } else if (profile.contractType === 'TOUCH_NO_TOUCH') {
    scannerScore = volatility > 1.2 ? 84 : 48;
    marketCompatibility = rsiValue > 65 || rsiValue < 35 ? 76 : 52;
  } else if (profile.contractType === 'ACCUMULATOR') {
    scannerScore = marketDirection !== 'FLAT' && volatility <= 1.4 ? 85 : 40;
    marketCompatibility = rsiValue >= 48 && rsiValue <= 62 ? 82 : 48;
  }

  const microOffset = (strategySeed % 7) - 3;
  scannerScore += microOffset;
  marketCompatibility += (strategySeed % 5) - 2;

  scannerScore = Math.min(96, Math.max(35, scannerScore));
  marketCompatibility = Math.min(96, Math.max(35, marketCompatibility));

  const finalConfidence = Math.floor((scannerScore + marketCompatibility) / 2);

  let tierOverride: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (finalConfidence >= 75) tierOverride = 'HIGH';
  else if (finalConfidence >= 62) tierOverride = 'MEDIUM';

  return {
    profileId: profile.id,
    ticksLoaded: currentCount,
    marketState: 'READY',
    direction: marketDirection,
    scannerScore,
    marketCompatibility,
    finalConfidence,
    tierOverride
  };
}
