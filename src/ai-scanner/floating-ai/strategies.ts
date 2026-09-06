// strategies.ts - Complete Logic Engine Layer
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
  let totalGains = 0;
  let totalLosses = 0;
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

export const STRATEGY_PROFILES: StrategyProfile[] = [
  { id: 'STRATEGY_1_3_2_6', name: '1-3-2-6 System', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 68, description: 'Fixed progressive staking sequence.', targetSymbol: 'R_10', contractType: 'RISE_FALL', coreEngine: 'PROGRESSIVE' },
  { id: 'ACC_DALEMBERT', name: 'Accumulator D'Alembert', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 65, description: 'Equilibrium based staking scale.', targetSymbol: 'R_25', contractType: 'ACCUMULATOR', coreEngine: 'DALEMBERT' }, { id: 'ACC_MARTINGALE', name: 'Accumulator Martingale', tier: 'HIGH', requiredTicks: 100, confidenceGate: 75, description: 'Aggressive recovery multiplier sequence.', targetSymbol: 'R_50', contractType: 'ACCUMULATOR', coreEngine: 'MARTINGALE' }, { id: 'ACC_REVERSE', name: 'Accumulator Reverse', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 64, description: 'Anti-equilibrium progression pattern.', targetSymbol: 'R_75', contractType: 'ACCUMULATOR', coreEngine: 'PROGRESSIVE' }, { id: 'ACC_REVERSE_MARTINGALE', name: 'Accumulator Reverse Martingale', tier: 'HIGH', requiredTicks: 100, confidenceGate: 78, description: 'Paroli-style compounding trend rider.', targetSymbol: 'R_100', contractType: 'ACCUMULATOR', coreEngine: 'MARTINGALE' }, { id: 'AI_ACC_FLOW', name: 'AI Accumulator Flow', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 70, description: 'Neural momentum tracking array.', targetSymbol: 'R_10', contractType: 'ACCUMULATOR', coreEngine: 'NEURAL_FLOW' }, { id: 'AI_ADAPTIVE', name: 'AI Adaptive', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 60, description: 'Dynamic lookback structural variant.', targetSymbol: 'R_25', contractType: 'RISE_FALL', coreEngine: 'NEURAL_FLOW' }, { id: 'AI_BALANCED', name: 'AI Balanced', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 65, description: 'Risk-adjusted baseline trend filter.', targetSymbol: 'R_50', contractType: 'OVER_UNDER', coreEngine: 'PROGRESSIVE' }, { id: 'AI_CONSERVATIVE', name: 'AI Conservative', tier: 'LOW', requiredTicks: 100, confidenceGate: 55, description: 'High-threshold protective entry evaluation.', targetSymbol: 'R_75', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'PROGRESSIVE' }, { id: 'AI_TREND_PRINTER', name: 'AI Trend Printer', tier: 'HIGH', requiredTicks: 100, confidenceGate: 82, description: 'Continuous micro-trend printing scanner.', targetSymbol: 'R_100', contractType: 'RISE_FALL', coreEngine: 'NEURAL_FLOW' }, { id: 'DALEMBERT_CLASSIC', name: 'D'Alembert Classic', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 60, description: 'Classic addition/subtraction unit formula.', targetSymbol: 'R_10', contractType: 'OVER_UNDER', coreEngine: 'DALEMBERT' },
  { id: 'MARTINGALE_CLASSIC', name: 'Martingale Classic', tier: 'HIGH', requiredTicks: 100, confidenceGate: 75, description: 'Standard linear loss doubling matrix.', targetSymbol: 'R_25', contractType: 'RISE_FALL', coreEngine: 'MARTINGALE' },
  { id: 'OSCARS_GRIND', name: 'Oscar's Grind', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 62, description: 'Targeted single-unit win progression tracking.', targetSymbol: 'R_50', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'PROGRESSIVE' }, { id: 'REVERSE_DALEMBERT', name: 'Reverse D'Alembert', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 61, description: 'Inverted risk distribution progression.', targetSymbol: 'R_75', contractType: 'OVER_UNDER', coreEngine: 'DALEMBERT' },
  { id: 'REVERSE_MARTINGALE', name: 'Reverse Martingale', tier: 'HIGH', requiredTicks: 100, confidenceGate: 76, description: 'Compounded profit maximizing pipeline.', targetSymbol: 'R_100', contractType: 'RISE_FALL', coreEngine: 'MARTINGALE' }
];

export function evaluateStrategy(profile: StrategyProfile, ticks: number[]): StrategyResult {
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

  let marketDirection = 'FLAT';
  const priceSpread = fastEma - slowEma;
  const threshold = 0.02;

  if (priceSpread > threshold) marketDirection = 'UP';
  else if (priceSpread < -threshold) marketDirection = 'DOWN';

  let scannerScore = 50;
  let marketCompatibility = 50;

  if (profile.contractType === 'RISE_FALL') {
    if (profile.id === 'AI_TREND_PRINTER') {
      const strongTrendMomentum = Math.abs(priceSpread) > (volatility * 0.4);
      const stableRsiRange = rsiValue >= 45 && rsiValue <= 65;
      scannerScore = strongTrendMomentum && stableRsiRange ? 92 : 40;
      marketCompatibility = stableRsiRange ? 88 : 42;
    } else if (profile.id === 'MARTINGALE_CLASSIC' || profile.id === 'REVERSE_MARTINGALE') {
      // REFACTORED ADAPTIVE TUNING FOR VOL 25 (1S) MEAN REVERSION
      const isMicroOverbought = rsiValue >= 65 && marketDirection === 'UP';
      const isMicroOversold = rsiValue <= 35 && marketDirection === 'DOWN';
      const isMomentumExhausted = Math.abs(priceSpread) < (volatility * 0.25);
      const highMeanReversionProbability = (isMicroOverbought || isMicroOversold) && isMomentumExhausted;

      scannerScore = highMeanReversionProbability ? 95 : 35;
      marketCompatibility = volatility > 0.4 ? 92 : 45;
    } else {
      const rsiDistanceFactor = Math.abs(rsiValue - 50);
      const structuralTrendStrength = Math.min(15, Math.floor((Math.abs(priceSpread) / (volatility || 1)) * 100));
      if (marketDirection !== 'FLAT') {
        scannerScore = Math.floor(75 - rsiDistanceFactor + structuralTrendStrength);
        marketCompatibility = rsiValue >= 40 && rsiValue <= 60 ? 85 : 60;
      } else {
        scannerScore = 40;
        marketCompatibility = 40;
      }
    }
  } else if (profile.contractType === 'OVER_UNDER') {
    if (profile.id === 'DALEMBERT_CLASSIC') {
      scannerScore = marketDirection === 'FLAT' && volatility < 0.6 ? 88 : 35;
      marketCompatibility = rsiValue >= 48 && rsiValue <= 52 ? 90 : 40;
    } else {
      scannerScore = marketDirection === 'FLAT' && volatility < 0.8 ? 84 : 40;
      marketCompatibility = rsiValue >= 45 && rsiValue <= 55 ? 82 : 45;
    }
  } else if (profile.contractType === 'TOUCH_NO_TOUCH') {
    const isExtremeVolatilitySpike = volatility > 1.45 && (rsiValue > 72 || rsiValue < 28);
    scannerScore = isExtremeVolatilitySpike ? 92 : 35;
    marketCompatibility = rsiValue > 65 || rsiValue < 35 ? 86 : 45;
  } else if (profile.contractType === 'ACCUMULATOR') {
    const isSideways = marketDirection === 'FLAT';
    const withinTightRange = rsiValue >= 48 && rsiValue <= 52; 
    const lowCrashingRisk = volatility < 0.50; 
    if (isSideways && withinTightRange && lowCrashingRisk) {
      scannerScore = 95; marketCompatibility = 90;
    } else {
      scannerScore = 35; marketCompatibility = 35;
    }
  }

  scannerScore = Math.min(96, Math.max(35, scannerScore));
  marketCompatibility = Math.min(96, Math.max(35, marketCompatibility));

  const finalConfidence = Math.floor((scannerScore + marketCompatibility) / 2);

  let tierOverride: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (finalConfidence >= 82) tierOverride = 'HIGH';
  else if (finalConfidence >= 65) tierOverride = 'MEDIUM';

  const baselineStake = profile.runtimeSettings?.defaultStake && profile.runtimeSettings.defaultStake > 0 
    ? profile.runtimeSettings.defaultStake 
    : 0.35; // DEFENSIVE baseline stake default for testing
    
  const activeTP = profile.runtimeSettings?.takeProfitLimit && profile.runtimeSettings.takeProfitLimit > 0
    ? profile.runtimeSettings.takeProfitLimit 
    : 8.00;
    
  const activeSL = profile.runtimeSettings?.stopLossLimit && profile.runtimeSettings.stopLossLimit > 0
    ? profile.runtimeSettings.stopLossLimit 
    : 4.00;
    
  const activeGrowth = profile.runtimeSettings?.growthRate ?? 0.01;

  let activeStake = baselineStake;
  
  if (typeof window !== 'undefined' && window.localStorage) {
    const activeStreakCount = parseInt(localStorage.getItem('EDASCORE_CONSECUTIVE_LOSS_COUNT') || '0', 10);
    if (activeStreakCount > 0 && (profile.coreEngine === 'MARTINGALE' || profile.coreEngine === 'NEURAL_FLOW')) {
      activeStake = baselineStake * Math.pow(2.15, activeStreakCount);
      const safetyCeilingLimit = 25.00; 
      if (activeStake > safetyCeilingLimit) activeStake = safetyCeilingLimit;
    }
  }

  return {
    profileId: profile.id, ticksLoaded: currentCount, marketState: 'READY', direction: marketDirection,
    scannerScore, marketCompatibility, finalConfidence, tierOverride,
    executionPayload: { stake: parseFloat(activeStake.toFixed(2)), takeProfit: activeTP, stopLoss: activeSL, growthRate: activeGrowth }
  };
                                 }
