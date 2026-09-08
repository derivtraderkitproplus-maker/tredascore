// strategies.ts - PART 1: Global Interfaces & Clean Mathematical Indicators

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
  liveAccuracyPercentage?: number;
  
  executionPayload?: {
    stake: number;
    takeProfit: number;
    stopLoss: number;
    growthRate: number;
  };
}

export function calculateEMA(prices: number[], period: number): number {
  if (!prices || prices.length === 0) return 0;
  const k = 2 / (period + 1);
  let emaValue = prices[0]; 
  for (let i = 1; i < prices.length; i++) {
    emaValue = (prices[i] * k) + (emaValue * (1 - k));
  }
  return emaValue;
}

export function calculateRSI(prices: number[], period: number = 14): number {
  if (!prices || prices.length <= period) return 50;
  let totalGains = 0; let totalLosses = 0;
  for (let i = prices.length - period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) totalGains += change;
    else totalLosses += Math.abs(change);
  }
  if (totalLosses === 0) return 100;
  const rs = totalGains / totalLosses;
  return Math.floor(100 - (100 / (1 + rs)));
}

export function calculateVolatility(prices: number[]): number {
  if (!prices || prices.length === 0) return 0;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
  return Math.sqrt(variance);
}
// strategies.ts - PART 2: Global Configuration Strategy Registry Array Map

export const STRATEGY_PROFILES: StrategyProfile[] = [
  // --- 📈 RISE / FALL (Trend & Momentum) ---
  { 
    id: 'AI_TREND_PRINTER', 
    name: 'AI Trend Printer', 
    tier: 'HIGH', requiredTicks: 100, confidenceGate: 85, 
    description: 'Continuous micro-trend printing scanner.', 
    targetSymbol: 'R_100', contractType: 'RISE_FALL', coreEngine: 'NEURAL_FLOW' 
  },
  { 
    id: 'MARTINGALE_CLASSIC', 
    name: 'Martingale Classic', 
    tier: 'HIGH', requiredTicks: 80, confidenceGate: 82, 
    description: 'Standard linear loss doubling mean-reversion matrix.', 
    targetSymbol: 'R_25', contractType: 'RISE_FALL', coreEngine: 'MARTINGALE' 
  },
  { 
    id: 'STRATEGY_1_3_2_6', 
    name: '1-3-2-6 System', 
    tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 72, 
    description: 'Fixed risk progressive staking cycle.', 
    targetSymbol: 'R_10', contractType: 'RISE_FALL', coreEngine: 'PROGRESSIVE' 
  },

  // --- 🧮 OVER / UNDER (Sideways & Boundaries) ---
  { 
    id: 'DALEMBERT_CLASSIC', 
    name: `D'Alembert Classic`, 
    tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 70, 
    description: 'Classic equilibrium addition/subtraction unit formula.', 
    targetSymbol: 'R_10', contractType: 'OVER_UNDER', coreEngine: 'DALEMBERT' 
  },
  { 
    id: 'AI_BALANCED', 
    name: 'AI Balanced Over/Under', 
    tier: 'MEDIUM', requiredTicks: 90, confidenceGate: 75, 
    description: 'Risk-adjusted baseline trend filter.', 
    targetSymbol: 'R_50', contractType: 'OVER_UNDER', coreEngine: 'PROGRESSIVE' 
  },

  // --- 🎯 TOUCH / NO TOUCH (Volatility Breakouts) ---
  { 
    id: 'AI_QUANT_V21', 
    name: 'AI Quant Matrix v21', 
    tier: 'HIGH', requiredTicks: 120, confidenceGate: 84, 
    description: 'Statistical boundary exhaustion breakout filter.', 
    targetSymbol: 'R_10', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'PROGRESSIVE' 
  },

  // --- 🔋 ACCUMULATOR (Compounding Ranges) ---
  { 
    id: 'AI_ACC_FLOW', 
    name: 'AI Accumulator Flow', 
    tier: 'HIGH', requiredTicks: 100, confidenceGate: 80, 
    description: 'Neural momentum tracking consolidation array.', 
    targetSymbol: 'R_100', contractType: 'ACCUMULATOR', coreEngine: 'NEURAL_FLOW' 
  },
  { 
    id: 'ACC_MARTINGALE', 
    name: 'Accumulator Martingale', 
    tier: 'HIGH', requiredTicks: 100, confidenceGate: 85, 
    description: 'Aggressive recovery multiplier sequence.', 
    targetSymbol: 'R_50', contractType: 'ACCUMULATOR', coreEngine: 'MARTINGALE' 
  }
];
// strategies.ts - PART 3: Algorithmic Strategy Evaluator Engine

export function evaluateStrategy(profile: StrategyProfile, ticks: number[], lossStreak: number = 0): StrategyResult {
  const currentCount = ticks.length;
  
  if (currentCount < profile.requiredTicks) {
    return {
      profileId: profile.id, ticksLoaded: currentCount, marketState: 'INSUFFICIENT_DATA',
      direction: 'FLAT', scannerScore: 0, marketCompatibility: 0, finalConfidence: 0, tierOverride: profile.tier
    };
  }

  const isFastAsset = profile.targetSymbol === 'R_100' || profile.targetSymbol === 'R_75';
  const fastEmaPeriod = isFastAsset ? 18 : 12;
  const slowEmaPeriod = isFastAsset ? 38 : 26;

  const fastEma = calculateEMA(ticks, fastEmaPeriod);
  const slowEma = calculateEMA(ticks, slowEmaPeriod);
  const rsiValue = calculateRSI(ticks, 14);
  const volatility = calculateVolatility(ticks.slice(-30));

  // ADAPTIVE VOLATILITY GATEWAY: Replaces hardcoded 0.02 to scale dynamically across Vol 25 to 100
  const baseMultiplier = isFastAsset ? 0.35 : 0.18;
  const adaptiveThreshold = Math.max(0.01, volatility * baseMultiplier);

  let marketDirection = 'FLAT';
  const priceSpread = fastEma - slowEma;

  if (priceSpread > adaptiveThreshold) marketDirection = 'UP';
  else if (priceSpread < -adaptiveThreshold) marketDirection = 'DOWN';

  // 🎯 HIGH-WIN OPTIMIZATION GATEWAY: Evaluates real-time price cascades across a 5-tick array window
  const lastFiveTicks = ticks.slice(-5);
  let isActivelyCrashing = false;
  if (lastFiveTicks.length >= 5) {
    if (lastFiveTicks[4] < lastFiveTicks[3] && 
        lastFiveTicks[3] < lastFiveTicks[2] && 
        lastFiveTicks[2] < lastFiveTicks[1]) {
      isActivelyCrashing = true; // Identifies a dangerous downward flush sequence
    }
  }

  let scannerScore = 50;
  let marketCompatibility = 50;

  if (profile.contractType === 'RISE_FALL') {
    if (profile.id === 'AI_TREND_PRINTER') {
      const strongTrendMomentum = Math.abs(priceSpread) > (volatility * 0.4);
      const stableRsiRange = rsiValue >= 45 && rsiValue <= 65;
      
      // CRITICAL BLOCK FILTER: If strategy tries to buy UP during a crash, drop score immediately
      if (marketDirection === 'UP' && isActivelyCrashing) {
        scannerScore = 35; marketCompatibility = 35;
      } else {
        scannerScore = strongTrendMomentum && stableRsiRange ? 92 : 40;
        marketCompatibility = stableRsiRange ? 88 : 42;
      }
    } else if (profile.id === 'MARTINGALE_CLASSIC') {
      const isMicroOverbought = rsiValue >= 65 && marketDirection === 'UP';
      const isMicroOversold = rsiValue <= 35 && marketDirection === 'DOWN';
      const isMomentumExhausted = Math.abs(priceSpread) < (volatility * 0.25);
      const highMeanReversionProbability = (isMicroOverbought || isMicroOversold) && isMomentumExhausted;

      scannerScore = highMeanReversionProbability ? 95 : 35;
      marketCompatibility = volatility > 0.4 ? 92 : 45;
    } else if (profile.id === 'STRATEGY_1_3_2_6') {
      const isConfidentTrend = marketDirection !== 'FLAT' && rsiValue >= 40 && rsiValue <= 60;
      scannerScore = isConfidentTrend ? 86 : 45;
      marketCompatibility = volatility > 0.3 ? 84 : 50;
    }
  } else if (profile.contractType === 'OVER_UNDER') {
    if (profile.id === 'DALEMBERT_CLASSIC') {
      scannerScore = marketDirection === 'FLAT' && volatility < 0.6 ? 88 : 35;
      marketCompatibility = rsiValue >= 48 && rsiValue <= 52 ? 90 : 40;
    } else if (profile.id === 'AI_BALANCED') {
      scannerScore = marketDirection === 'FLAT' && volatility < 0.8 ? 84 : 40;
      marketCompatibility = rsiValue >= 45 && rsiValue <= 55 ? 82 : 45;
    }
  } else if (profile.contractType === 'TOUCH_NO_TOUCH') {
    if (profile.id === 'AI_QUANT_V21') {
      const isExtremeVolatilitySpike = volatility > 1.45 && (rsiValue > 72 || rsiValue < 28);
      scannerScore = isExtremeVolatilitySpike ? 92 : 35;
      marketCompatibility = rsiValue > 65 || rsiValue < 35 ? 86 : 45;
    }
  } else if (profile.contractType === 'ACCUMULATOR') {
    const isSideways = marketDirection === 'FLAT';
    const withinTightRange = rsiValue >= 48 && rsiValue <= 52; 
    const lowCrashingRisk = volatility < 0.50; 

    if (isSideways && withinTightRange && lowCrashingRisk) {
      scannerScore = profile.id === 'ACC_MARTINGALE' ? 95 : 90; 
      marketCompatibility = 90;
    } else {
      scannerScore = 35; marketCompatibility = 35;
    }
  }
  // ... (Pasted directly beneath Part 3)

  scannerScore = Math.min(96, Math.max(35, scannerScore));
  marketCompatibility = Math.min(96, Math.max(35, marketCompatibility));

  const finalConfidence = Math.floor((scannerScore + marketCompatibility) / 2);

  let tierOverride: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (finalConfidence >= 82) tierOverride = 'HIGH';
  else if (finalConfidence >= 65) tierOverride = 'MEDIUM';

  // MICRO-ACCOUNT FENCE: Defend the user bankroll using strict $0.35 base staking constraints
  const baselineStake = profile.runtimeSettings?.defaultStake && profile.runtimeSettings.defaultStake > 0 
    ? profile.runtimeSettings.defaultStake : 0.35; 
    
  const activeTP = profile.runtimeSettings?.takeProfitLimit && profile.runtimeSettings.takeProfitLimit > 0
    ? profile.runtimeSettings.takeProfitLimit : 8.00;
    
  const activeSL = profile.runtimeSettings?.stopLossLimit && profile.runtimeSettings.stopLossLimit > 0
    ? profile.runtimeSettings.stopLossLimit : 4.00;
    
  const activeGrowth = profile.runtimeSettings?.growthRate ?? 0.01;
  let activeStake = baselineStake;
  
  // Safe calculation loop using the direct lossStreak variable passed from background thread context
  if (lossStreak > 0 && (profile.coreEngine === 'MARTINGALE' || profile.coreEngine === 'NEURAL_FLOW')) {
    activeStake = baselineStake * Math.pow(2.15, lossStreak);
    const safetyCeilingLimit = 25.00; 
    if (activeStake > safetyCeilingLimit) activeStake = safetyCeilingLimit;
  }

  return {
    profileId: profile.id, 
    ticksLoaded: currentCount, 
    marketState: volatility > 1.2 ? 'HIGH_VOLATILITY_RUN' : 'READY', 
    direction: marketDirection,
    scannerScore, 
    marketCompatibility, 
    finalConfidence, 
    tierOverride,
    status: tierOverride,
    
    executionPayload: { 
      stake: parseFloat(activeStake.toFixed(2)), 
      takeProfit: activeTP, 
      stopLoss: activeSL, 
      growthRate: activeGrowth 
    }
  };
} 

/**
 * Utility helper to perform bulk snapshot array runs across the elite strategy matrix
 */
export function evaluateRegistrySnapshot(ticks: number[], lossStreak: number = 0): StrategyResult[] {
  if (!ticks || ticks.length === 0) return [];
  return STRATEGY_PROFILES.map((profile) => evaluateStrategy(profile, ticks, lossStreak))
    .sort((a, b) => b.finalConfidence - a.finalConfidence);
}
