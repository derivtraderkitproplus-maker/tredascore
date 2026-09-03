// strategies.ts - PART 1: Interfaces, Schema Definitions & Safe Math Indicators

export interface StrategyProfile {
  id: string;
  name: string;
  tier: 'HIGH' | 'MEDIUM' | 'LOW';
  requiredTicks: number;
  confidenceGate: number;
  description: string;
  targetSymbol: 'R_10' | 'R_25' | 'R_50' | 'R_75' | 'R_100';
  contractType: 'RISE_FALL' | 'OVER_UNDER' | 'ACCUMULATOR' | 'TOUCH_NO_TOUCH';
  coreEngine: 'MARTINGALE' | 'DALEMBERT' | 'PROGRESSIVE' | 'NEURAL_FLOW';
  
  runtimeSettings?: {
    defaultStake: number;
    takeProfitLimit: number; 
    stopLossLimit: number;   
    growthRate?: number;     
  };
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
  
  executionPayload?: {
    stake: number;
    takeProfit: number;
    stopLoss: number;
    growthRate: number;
  };
}

/**
 * 🛠️ CORE MATH FIX: EXPONENTIAL MOVING AVERAGE (EMA)
 * Extracts the first point cleanly as a scalar float number to prevent shared array pollution
 */
export function calculateEMA(prices: number[], period: number): number {
  if (!prices || prices.length === 0) return 0;
  const k = 2 / (period + 1);
  
  // Assign initial value explicitly as a single number entry point, NOT an array reference
  let emaValue = prices[0]; 
  
  for (let i = 1; i < prices.length; i++) {
    emaValue = (prices[i] * k) + (emaValue * (1 - k));
  }
  return emaValue;
}

/**
 * CORE MATH FIX: RELATIVE STRENGTH INDEX (RSI)
 * Tracks price vector momentum boundaries cleanly within high-frequency memory arrays
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (!prices || prices.length <= period) return 50;
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

/**
 * CORE MATH FIX: HISTORICAL VOLATILITY
 * Calculates accurate standard deviations across custom index decimal structures
 */
export function calculateVolatility(prices: number[]): number {
  if (!prices || prices.length === 0) return 0;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
  return Math.sqrt(variance);
}
// strategies.ts - PART 2A: Global Registry Map & Handshake Validations

import { StrategyProfile, StrategyResult, calculateEMA, calculateRSI, calculateVolatility } from './strategies';

// Global System Strategy Profiles Registry Map
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
// strategies.ts - PART 2B: Technical Calculation Logic & Fractional Risk Staking Engine

  const isFastAsset = profile.targetSymbol === 'R_100' || profile.targetSymbol === 'R_75';
  const fastEmaPeriod = isFastAsset ? 18 : 12;
  const slowEmaPeriod = isFastAsset ? 38 : 26;

  const fastEma = calculateEMA(ticks, fastEmaPeriod);
  const slowEma = calculateEMA(ticks, slowEmaPeriod);
  const rsiValue = calculateRSI(ticks, 14);
  const volatility = calculateVolatility(ticks.slice(-30));

  // Verify core price momentum trajectory based on scalar math calculations
  let marketDirection = 'FLAT';
  if (fastEma > slowEma + 0.02) marketDirection = 'UP';
  else if (fastEma < slowEma - 0.02) marketDirection = 'DOWN';

  let scannerScore = 50;
  let marketCompatibility = 50;

  // --- MATHEMATICAL MULTI-CONTRACT MODULATION PIPELINES ---
  if (profile.contractType === 'RISE_FALL') {
    // Rewards strong directional trends while avoiding immediate overbought/oversold limits
    scannerScore = marketDirection === 'UP' && rsiValue < 70 ? 88 : (marketDirection === 'DOWN' && rsiValue > 30 ? 88 : 40);
    marketCompatibility = rsiValue > 55 || rsiValue < 45 ? 82 : 50;
    
  } else if (profile.contractType === 'OVER_UNDER') {
    // Over/Under performs best in calm, tight sideways ranges
    scannerScore = marketDirection === 'FLAT' && volatility < 0.9 ? 86 : 45;
    marketCompatibility = rsiValue >= 45 && rsiValue <= 55 ? 84 : 45;
    
  } else if (profile.contractType === 'TOUCH_NO_TOUCH') {
    // Touch contracts favor volatile breakouts from key levels
    scannerScore = volatility > 1.4 && (rsiValue > 70 || rsiValue < 30) ? 88 : 38;
    marketCompatibility = rsiValue > 65 || rsiValue < 35 ? 82 : 48;
    
  } else if (profile.contractType === 'ACCUMULATOR') {
    // Tightened up: Accumulators require calm consolidation, NOT aggressive trends
    const isSideways = marketDirection === 'FLAT';
    const isCalmRange = rsiValue >= 45 && rsiValue <= 55;
    const isLowRiskVol = volatility <= 0.8;

    if (isSideways && isCalmRange && isLowRiskVol) {
      scannerScore = 85; 
      marketCompatibility = 85;
    } else {
      scannerScore = 30; // Suppress instantly if a strong vertical trend begins
      marketCompatibility = 30;
    }
  }

  // Clamping arrays to normal project UI visualization thresholds
  scannerScore = Math.min(96, Math.max(35, scannerScore));
  marketCompatibility = Math.min(96, Math.max(35, marketCompatibility));

  const finalConfidence = Math.floor((scannerScore + marketCompatibility) / 2);

  let tierOverride: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (finalConfidence >= 82) tierOverride = 'HIGH';
  else if (finalConfidence >= 65) tierOverride = 'MEDIUM';

  // Base fallback parameters
  const baselineStake = profile.runtimeSettings?.defaultStake ?? 3.00;
  const activeTP = profile.runtimeSettings?.takeProfitLimit ?? 8.00;
  const activeSL = profile.runtimeSettings?.stopLossLimit ?? 4.00;
  const activeGrowth = profile.runtimeSettings?.growthRate ?? 0.01;

  // 🛠️ ACTIVE PRODUCTION RISK CALCULATOR LOOP
  let activeStake = baselineStake;
  
  if (typeof window !== 'undefined' && window.localStorage) {
    const activeStreakCount = parseInt(localStorage.getItem('EDASCORE_CONSECUTIVE_LOSS_COUNT') || '0', 10);
    
    // Fractional Martingale Staking Progression Logic
    if (activeStreakCount > 0 && (profile.coreEngine === 'MARTINGALE' || profile.coreEngine === 'NEURAL_FLOW')) {
      // Step up position stake exposure proportionally matching loss depth to offset payout variance asymmetry
      activeStake = baselineStake * Math.pow(2.15, activeStreakCount);
      
      // Force upper allocation safety ceilings matching proper risk management boundaries
      const safetyCeilingLimit = 25.00; 
      if (activeStake > safetyCeilingLimit) {
        console.warn(`🛡️ Risk Manager clamped stake size from $${activeStake.toFixed(2)} to safety ceiling of $${safetyCeilingLimit}.`);
        activeStake = safetyCeilingLimit;
      }
    }
  }

  return {
    profileId: profile.id,
    ticksLoaded: currentCount,
    marketState: 'READY',
    direction: marketDirection,
    scannerScore,
    marketCompatibility,
    finalConfidence,
    tierOverride,
    executionPayload: {
      stake: parseFloat(activeStake.toFixed(2)),
      takeProfit: activeTP,
      stopLoss: activeSL,
      growthRate: activeGrowth
    }
  };
}
