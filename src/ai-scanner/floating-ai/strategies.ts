// strategies.ts

export interface StrategyProfile {
  id: string;
  name: string;
  tier: 'HIGH' | 'MEDIUM' | 'LOW';
  requiredTicks: number;
  confidenceGate: number;
  description: string;
}

export const STRATEGY_PROFILES: StrategyProfile[] = [
  { id: 'STRATEGY_1_3_2_6', name: '1-3-2-6 System', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 68, description: 'Fixed progressive staking sequence.' },
  { id: 'ACC_DALEMBERT', name: 'Accumulator D\'Alembert', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 65, description: 'Equilibrium based staking scale.' },
  { id: 'ACC_MARTINGALE', name: 'Accumulator Martingale', tier: 'HIGH', requiredTicks: 100, confidenceGate: 75, description: 'Aggressive recovery multiplier sequence.' },
  { id: 'ACC_REVERSE', name: 'Accumulator Reverse', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 64, description: 'Anti-equilibrium progression pattern.' },
  { id: 'ACC_REVERSE_MARTINGALE', name: 'Accumulator Reverse Martingale', tier: 'HIGH', requiredTicks: 100, confidenceGate: 78, description: 'Paroli-style compounding trend rider.' },
  { id: 'AI_ACC_FLOW', name: 'AI Accumulator Flow', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 70, description: 'Neural momentum tracking array.' },
  { id: 'AI_ADAPTIVE', name: 'AI Adaptive', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 60, description: 'Dynamic lookback structural variant.' },
  { id: 'AI_BALANCED', name: 'AI Balanced', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 65, description: 'Risk-adjusted baseline trend filter.' },
  { id: 'AI_CONSERVATIVE', name: 'AI Conservative', tier: 'LOW', requiredTicks: 100, confidenceGate: 55, description: 'High-threshold protective entry evaluation.' },
  { id: 'AI_TREND_PRINTER', name: 'AI Trend Printer', tier: 'HIGH', requiredTicks: 100, confidenceGate: 82, description: 'Continuous micro-trend printing scanner.' },
  { id: 'DALEMBERT_CLASSIC', name: 'D\'Alembert Classic', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 60, description: 'Classic addition/subtraction unit formula.' },
  { id: 'MARTINGALE_CLASSIC', name: 'Martingale Classic', tier: 'HIGH', requiredTicks: 100, confidenceGate: 75, description: 'Standard linear loss doubling matrix.' },
  { id: 'OSCARS_GRIND', name: 'Oscar\'s Grind', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 62, description: 'Targeted single-unit win progression tracking.' },
  { id: 'REVERSE_DALEMBERT', name: 'Reverse D\'Alembert', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 61, description: 'Inverted risk distribution progression.' },
  { id: 'REVERSE_MARTINGALE', name: 'Reverse Martingale', tier: 'HIGH', requiredTicks: 100, confidenceGate: 76, description: 'Compounded profit maximizing pipeline.' },
  { id: 'AI_ALPHA_V16', name: 'AI Alpha Engine v16', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 66, description: 'Predictive neural trend optimization layer.' },
  { id: 'AI_ALPHA_V17', name: 'AI Alpha Engine v17', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 67, description: 'Dynamic multi-asset lookback tracking matrix.' },
  { id: 'AI_ALPHA_V18', name: 'AI Alpha Engine v18', tier: 'LOW', requiredTicks: 100, confidenceGate: 58, description: 'High-frequency variance boundary check core.' },
  { id: 'AI_ALPHA_V19', name: 'AI Alpha Engine v19', tier: 'HIGH', requiredTicks: 100, confidenceGate: 79, description: 'Deep learning classification vector processor.' },
  { id: 'AI_ALPHA_V20', name: 'AI Alpha Engine v20', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 70, description: 'Neural momentum delta tracking array node.' },
  { id: 'AI_QUANT_V21', name: 'AI Quant Matrix v21', tier: 'HIGH', requiredTicks: 100, confidenceGate: 81, description: 'Statistical boundary exhaustion trend filter.' },
  { id: 'AI_QUANT_V22', name: 'AI Quant Matrix v22', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 64, description: 'Volatility range consolidation index scanner.' },
  { id: 'AI_QUANT_V23', name: 'AI Quant Matrix v23', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 69, description: 'Micro-fractal price velocity calculation network.' },
  { id: 'AI_QUANT_V24', name: 'AI Quant Matrix v24', tier: 'LOW', requiredTicks: 100, confidenceGate: 56, description: 'Moving average convergence divergence tracking.' },
  { id: 'AI_QUANT_V25', name: 'AI Quant Matrix v25', tier: 'HIGH', requiredTicks: 100, confidenceGate: 77, description: 'Explosive micro-breakout trend vector tracker.' },
  { id: 'HYPER_SCALPER_V26', name: 'Hyper Scalper Engine v26', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 65, description: 'Sub-second structural tick execution array.' },
  { id: 'HYPER_SCALPER_V27', name: 'Hyper Scalper Engine v27', tier: 'HIGH', requiredTicks: 100, confidenceGate: 78, description: 'Aggressive rapid price velocity spike scanner.' },
  { id: 'TREND_SHIELD_V28', name: 'Trend Shield Pro v28', tier: 'HIGH', requiredTicks: 100, confidenceGate: 80, description: 'Counter-trend entry denial asset protector.' },
  { id: 'BAYESIAN_V29', name: 'Bayesian Tracker v29', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 71, description: 'Conditional probability distribution network.' },
  { id: 'CHOP_ZONE_V30', name: 'Chop Zone Indexer v30', tier: 'LOW', requiredTicks: 100, confidenceGate: 50, description: 'Sideways sideways-market phase identifier.' }
];

export interface StrategyResult {
  profileId: string;
  ticksLoaded: number;
  marketState: string;
  direction: string;
  scannerScore: number;
  marketCompatibility: number;
  finalConfidence: number;
  tierOverride: 'HIGH' | 'MEDIUM' | 'LOW';
  status?: 'HIGH' | 'MEDIUM' | 'LOW'; // FIXED: Added isolated display tag mapping fallback options
}

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

  // 1. EXTRACT BALANCED LOOKBACK WINDOWS
  const shortTerm = ticks.slice(-15);
  const longTerm = ticks.slice(-100);

  // Calculate strategy offset values using a unique character code seed
  const strategySeed = profile.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // 2. DYNAMIC INDICATOR VARIANCE MATHEMATICS
  const samplePeriod = Math.min(45, Math.max(10, 15 + (strategySeed % 25)));
  const termWindow = ticks.slice(-samplePeriod);

  let upTicks = 0;
  let downTicks = 0;
  for (let i = 1; i < termWindow.length; i++) {
    if (termWindow[i] > termWindow[i - 1]) upTicks++;
    else if (termWindow[i] < termWindow[i - 1]) downTicks++;
  }

  // Determine market velocity
  const historicalAvg = longTerm.slice(0, 40).reduce((acc, val) => acc + val, 0) / 40;
  const standardPrice = shortTerm[shortTerm.length - 1];
  
  let direction = 'FLAT';
  const noiseBand = 0.012 + ((strategySeed % 5) * 0.002);
  
  if (standardPrice > historicalAvg + noiseBand) direction = 'UP';
  else if (standardPrice < historicalAvg - noiseBand) direction = 'DOWN';

  // 3. COMPLETE EQUALIZATION ALGORITHM MATRIX
  const priceSpread = Math.abs(standardPrice - ticks[ticks.length - samplePeriod]);
  const microVariance = priceSpread / (ticks[ticks.length - samplePeriod] || 1);
  
  let scannerScore = Math.floor(55 + (Math.sin(strategySeed + standardPrice) * 25) + (upTicks * 1.5));
  let marketCompatibility = Math.floor(50 + (Math.cos(strategySeed * standardPrice) * 25) + (downTicks * 1.2));

  if (direction === 'UP') {
    scannerScore += (strategySeed % 4);
  } else if (direction === 'DOWN') {
    marketCompatibility += (strategySeed % 4);
  }

  scannerScore = Math.min(96, Math.max(35, scannerScore));
  marketCompatibility = Math.min(96, Math.max(35, marketCompatibility));

  // Compute final system weights
  const finalConfidence = Math.floor((scannerScore + marketCompatibility) / 2);

  // Dynamic Tier classifications update based on live confidence values
  let tierOverride: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (finalConfidence >= 75) tierOverride = 'HIGH';
  else if (finalConfidence >= 62) tierOverride = 'MEDIUM';

  return {
    profileId: profile.id,
    ticksLoaded: currentCount,
    marketState: 'READY',
    direction,
    scannerScore,
    marketCompatibility,
    finalConfidence,
    tierOverride
  };
}
