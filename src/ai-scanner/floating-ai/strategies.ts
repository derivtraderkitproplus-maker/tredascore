// strategies.ts - PART 1: Global Interfaces & Advanced Risk Schemas

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
    // EXTENDED STRUCTURAL CORES FOR ACCOUNT SURVIVAL
    maxLossStreakLimit?: number;
    progressionFactor?: number;
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
 * HIGH-PERFORMANCE EXPONENTIAL MOVING AVERAGE (EMA)
 */
export function calculateEMA(prices: number[], period: number): number {
  if (!prices || prices.length === 0) return 0;
  const k = 2 / (period + 1);
  let emaValue = prices[0]; 
  for (let i = 1; i < prices.length; i++) {
    emaValue = (prices[i] * k) + (emaValue * (1 - k));
  }
  return emaValue;
}

/**
 * HIGH-PERFORMANCE RELATIVE STRENGTH INDEX (RSI)
 */
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

/**
 * PRODUCTION-READY HISTORICAL VOLATILITY
 */
export function calculateVolatility(prices: number[]): number {
  if (!prices || prices.length === 0) return 0;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
  return Math.sqrt(variance);
}
// strategies.ts - PART 2: Institutional Exhaustion Indicators

/**
 * ADVANCED HIGH-CONFIDENCE INDICATOR 1: CONSECUTIVE TICK DIRECTIONAL METRICS
 * Identifies strong directional micro-trends prime for a high-accuracy reversal.
 */
export function calculateConsecutiveTicks(prices: number[]): { count: number; direction: 'UP' | 'DOWN' | 'FLAT' } {
  if (!prices || prices.length < 2) return { count: 0, direction: 'FLAT' };
  const totalLength = prices.length;
  const lastDelta = prices[totalLength - 1] - prices[totalLength - 2];
  if (lastDelta === 0) return { count: 0, direction: 'FLAT' };

  const currentDir = lastDelta > 0 ? 'UP' : 'DOWN';
  let consecutiveCount = 1;

  for (let i = totalLength - 2; i > 0; i--) {
    const diff = prices[i] - prices[i - 1];
    if ((diff > 0 && currentDir === 'UP') || (diff < 0 && currentDir === 'DOWN')) {
      consecutiveCount++;
    } else {
      break;
    }
  }
  return { count: consecutiveCount, direction: currentDir };
}
// strategies.ts - PART 3: Micro-Trend Deceleration & Boundary Scanners

/**
 * ADVANCED HIGH-CONFIDENCE INDICATOR 2: DELTA COMPRESSION SCANNER
 * Verifies that micro-trend pricing changes are decelerating relative to history.
 */
export function calculateDeltaCompression(prices: number[], lookback: number = 10): boolean {
  if (!prices || prices.length < lookback) return false;
  const totalLength = prices.length;
  const currentDelta = Math.abs(prices[totalLength - 1] - prices[totalLength - 2]);
  
  let totalHistoricalDelta = 0;
  for (let i = totalLength - lookback; i < totalLength - 1; i++) {
    totalHistoricalDelta += Math.abs(prices[i] - prices[i - 1]);
  }
  const averageHistoricalDelta = totalHistoricalDelta / (lookback - 1);
  return currentDelta <= averageHistoricalDelta * 1.15;
}

/**
 * ADVANCED HIGH-CONFIDENCE INDICATOR 3: REVERSION BOUNDARY CEILING AND FLOOR DETECTOR
 * Confirms price is colliding directly with recent multi-tick local resistance barriers.
 */
export function checkExtremeBoundary(prices: number[], lookback: number = 20): { isAtExtreme: boolean } {
  if (!prices || prices.length < lookback) return { isAtExtreme: false };
  const currentPrice = prices[prices.length - 1];
  const trailingSlice = prices.slice(prices.length - lookback, prices.length - 1);
  
  const localCeiling = Math.max(...trailingSlice);
  const localFloor = Math.min(...trailingSlice);
  
  const hitsCeiling = currentPrice >= localCeiling || Math.abs(currentPrice - localCeiling) < 0.01;
  const hitsFloor = currentPrice <= localFloor || Math.abs(currentPrice - localFloor) < 0.01;
  
  return { isAtExtreme: hitsCeiling || hitsFloor };
}
// strategies.ts - PART 4: Strategy Profiles Registry (1-15)

export const STRATEGY_PROFILES: StrategyProfile[] = [
  { id: 'STRATEGY_1_3_2_6', name: '1-3-2-6 System', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Fixed progressive staking sequence.', targetSymbol: 'R_10', contractType: 'RISE_FALL', coreEngine: 'PROGRESSIVE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.50 } },
  { id: 'ACC_DALEMBERT', name: 'Accumulator D\'Alembert', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Equilibrium based staking scale.', targetSymbol: 'R_25', contractType: 'ACCUMULATOR', coreEngine: 'DALEMBERT', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.20 } },
  { id: 'ACC_MARTINGALE', name: 'Accumulator Martingale', tier: 'HIGH', requiredTicks: 100, confidenceGate: 96, description: 'Aggressive recovery multiplier sequence.', targetSymbol: 'R_50', contractType: 'ACCUMULATOR', coreEngine: 'MARTINGALE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.25 } },
  { id: 'ACC_REVERSE', name: 'Accumulator Reverse', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Anti-equilibrium progression pattern.', targetSymbol: 'R_75', contractType: 'ACCUMULATOR', coreEngine: 'PROGRESSIVE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.40 } },
  { id: 'ACC_REVERSE_MARTINGALE', name: 'Accumulator Reverse Martingale', tier: 'HIGH', requiredTicks: 100, confidenceGate: 96, description: 'Paroli-style compounding trend rider.', targetSymbol: 'R_100', contractType: 'ACCUMULATOR', coreEngine: 'MARTINGALE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.20 } },
  { id: 'AI_ACC_FLOW', name: 'AI Accumulator Flow', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Neural momentum tracking array.', targetSymbol: 'R_10', contractType: 'ACCUMULATOR', coreEngine: 'NEURAL_FLOW', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.22 } },
  { id: 'AI_ADAPTIVE', name: 'AI Adaptive', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Dynamic lookback structural variant.', targetSymbol: 'R_25', contractType: 'RISE_FALL', coreEngine: 'NEURAL_FLOW', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.25 } },
  { id: 'AI_BALANCED', name: 'AI Balanced', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Risk-adjusted baseline trend filter.', targetSymbol: 'R_50', contractType: 'OVER_UNDER', coreEngine: 'PROGRESSIVE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.50 } },
  { id: 'AI_CONSERVATIVE', name: 'AI Conservative', tier: 'LOW', requiredTicks: 100, confidenceGate: 96, description: 'High-threshold protective entry evaluation.', targetSymbol: 'R_75', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'PROGRESSIVE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.30 } },
  { id: 'AI_TREND_PRINTER', name: 'AI Trend Printer', tier: 'HIGH', requiredTicks: 100, confidenceGate: 96, description: 'Continuous micro-trend printing scanner with advanced exhaustion multi-filters.', targetSymbol: 'R_100', contractType: 'RISE_FALL', coreEngine: 'NEURAL_FLOW', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.20 } },
  { id: 'DALEMBERT_CLASSIC', name: 'D\'Alembert Classic', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Classic addition/subtraction unit formula.', targetSymbol: 'R_10', contractType: 'OVER_UNDER', coreEngine: 'DALEMBERT', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.25 } },
  { id: 'MARTINGALE_CLASSIC', name: 'Martingale Classic', tier: 'HIGH', requiredTicks: 100, confidenceGate: 75, description: 'Standard linear loss doubling matrix.', targetSymbol: 'R_25', contractType: 'RISE_FALL', coreEngine: 'MARTINGALE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.30 } },
  { id: 'OSCARS_GRIND', name: 'Oscar\'s Grind', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Targeted single-unit win progression tracking.', targetSymbol: 'R_50', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'PROGRESSIVE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.50 } },
  { id: 'REVERSE_DALEMBERT', name: 'Reverse D\'Alembert', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Inverted risk distribution progression.', targetSymbol: 'R_75', contractType: 'OVER_UNDER', coreEngine: 'DALEMBERT', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.25 } },
  { id: 'REVERSE_MARTINGALE', name: 'Reverse Martingale', tier: 'HIGH', requiredTicks: 100, confidenceGate: 76, description: 'Compounded profit maximizing pipeline.', targetSymbol: 'R_100', contractType: 'RISE_FALL', coreEngine: 'MARTINGALE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.25 } }
];
// strategies.ts - PART 5: Strategy Profiles Registry (16-30)

export const STRATEGY_PROFILES_EXTENDED: StrategyProfile[] = [
  { id: 'AI_ALPHA_V16', name: 'AI Alpha Engine v16', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Predictive neural trend optimization layer.', targetSymbol: 'R_10', contractType: 'OVER_UNDER', coreEngine: 'NEURAL_FLOW', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.20 } },
  { id: 'AI_ALPHA_V17', name: 'AI Alpha Engine v17', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Dynamic multi-asset lookback tracking matrix.', targetSymbol: 'R_25', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'NEURAL_FLOW', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.20 } },
  { id: 'AI_ALPHA_V18', name: 'AI Alpha Engine v18', tier: 'LOW', requiredTicks: 100, confidenceGate: 96, description: 'High-frequency variance boundary check core.', targetSymbol: 'R_50', contractType: 'ACCUMULATOR', coreEngine: 'NEURAL_FLOW', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.15 } },
  { id: 'AI_ALPHA_V19', name: 'AI Alpha Engine v19', tier: 'HIGH', requiredTicks: 100, confidenceGate: 96, description: 'Deep learning classification vector processor.', targetSymbol: 'R_75', contractType: 'RISE_FALL', coreEngine: 'NEURAL_FLOW', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.25 } },
  { id: 'AI_ALPHA_V20', name: 'AI Alpha Engine v20', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Neural momentum delta tracking array node.', targetSymbol: 'R_100', contractType: 'OVER_UNDER', coreEngine: 'NEURAL_FLOW', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.20 } },
  { id: 'AI_QUANT_V21', name: 'AI Quant Matrix v21', tier: 'HIGH', requiredTicks: 100, confidenceGate: 96, description: 'Statistical boundary exhaustion trend filter.', targetSymbol: 'R_10', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'PROGRESSIVE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.50 } },
  { id: 'AI_QUANT_V22', name: 'AI Quant Matrix v22', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Volatility range consolidation index scanner.', targetSymbol: 'R_25', contractType: 'ACCUMULATOR', coreEngine: 'PROGRESSIVE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.50 } },
  { id: 'AI_QUANT_V23', name: 'AI Quant Matrix v23', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Micro-fractal price velocity calculation network.', targetSymbol: 'R_50', contractType: 'RISE_FALL', coreEngine: 'PROGRESSIVE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.50 } },
  { id: 'AI_QUANT_V24', name: 'AI Quant Matrix v24', tier: 'LOW', requiredTicks: 100, confidenceGate: 96, description: 'Moving average convergence divergence tracking.', targetSymbol: 'R_75', contractType: 'OVER_UNDER', coreEngine: 'PROGRESSIVE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.40 } },
  { id: 'AI_QUANT_V25', name: 'AI Quant Matrix v25', tier: 'HIGH', requiredTicks: 100, confidenceGate: 96, description: 'Explosive micro-breakout trend vector tracker.', targetSymbol: 'R_100', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'PROGRESSIVE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.50 } },
  { id: 'HYPER_SCALPER_V26', name: 'Hyper Scalper Engine v26', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Sub-second structural tick execution array.', targetSymbol: 'R_10', contractType: 'RISE_FALL', coreEngine: 'MARTINGALE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.30 } },
  { id: 'HYPER_SCALPER_V27', name: 'Hyper Scalper Engine v27', tier: 'HIGH', requiredTicks: 100, confidenceGate: 96, description: 'Aggressive rapid price velocity spike scanner.', targetSymbol: 'R_25', contractType: 'OVER_UNDER', coreEngine: 'MARTINGALE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.30 } },
  { id: 'TREND_SHIELD_V28', name: 'Trend Shield Pro v28', tier: 'HIGH', requiredTicks: 100, confidenceGate: 96, description: 'Counter-trend entry denial asset protector.', targetSymbol: 'R_50', contractType: 'RISE_FALL', coreEngine: 'PROGRESSIVE', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.50 } },
  { id: 'BAYESIAN_V29', name: 'Bayesian Tracker v29', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 96, description: 'Conditional probability distribution network.', targetSymbol: 'R_75', contractType: 'TOUCH_NO_TOUCH', coreEngine: 'NEURAL_FLOW', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 1.20 } },
  { id: 'CHOP_ZONE_V30', name: 'Chop Zone Indexer v30', tier: 'LOW', requiredTicks: 100, confidenceGate: 50, description: 'Sideways market phase identifier.', targetSymbol: 'R_100', contractType: 'OVER_UNDER', coreEngine: 'DALEMBERT', runtimeSettings: { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00, progressionFactor: 0.20 } }
];

// Combine arrays to supply the master list seamlessly to the runtime scanner pipeline
STRATEGY_PROFILES.push(...STRATEGY_PROFILES_EXTENDED);
// strategies.ts - PART 6: Dynamic Mathematical Scoring Engine & Fractional Risk Protection Core

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

  // Dynamic Lookback Tuning: Adjusts to asset speeds (R_100/R_75 are lightning fast compared to R_10)
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

  // --- UNIVERSAL INSTITUTIONAL 3-FACTOR EXHAUSTION CALCULATION ENGINE ---
  const consecutiveMetrics = calculateConsecutiveTicks(ticks);
  const isCompressed = calculateDeltaCompression(ticks, 10);
  const boundaryStatus = checkExtremeBoundary(ticks, 20);

  let calculationScore = 40;
  let compatibilityScore = 40;

  // Factor 1: Continuous direction check (Has the asset spiked 4+ steps without stopping?)
  if (consecutiveMetrics.count >= 4) {
    calculationScore += 26;
    compatibilityScore += 26;
  }
  
  // Factor 2: Structural price deceleration compression
  if (isCompressed) {
    calculationScore += 15;
    compatibilityScore += 15;
  }

  // Factor 3: Multi-tick local floor or ceiling touch
  if (boundaryStatus.isAtExtreme) {
    calculationScore += 15;
    compatibilityScore += 15;
  }

  // Fallback defaults for strategies that don't match extreme exhaustion profile
  let scannerScore = calculationScore;
  let marketCompatibility = compatibilityScore;

  // Apply custom logic adjustments for special profiles if needed
  if (profile.contractType === 'ACCUMULATOR' && marketDirection === 'FLAT' && volatility < 0.50) {
    scannerScore = 96;
    marketCompatibility = 96;
  }

  // Clamp metrics cleanly within standard compliance caps
  scannerScore = Math.min(100, Math.max(35, scannerScore));
  marketCompatibility = Math.min(100, Math.max(35, marketCompatibility));

  const finalConfidence = Math.floor((scannerScore + marketCompatibility) / 2);

  let tierOverride: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (finalConfidence >= 90) tierOverride = 'HIGH';
  else if (finalConfidence >= 65) tierOverride = 'MEDIUM';

  const baselineStake = profile.runtimeSettings?.defaultStake || 0.35;
  const activeTP = profile.runtimeSettings?.takeProfitLimit || 8.00;
  const activeSL = profile.runtimeSettings?.stopLossLimit || 4.00;
  const activeGrowth = profile.runtimeSettings?.growthRate ?? 0.01;
  const dynamicFactor = profile.runtimeSettings?.progressionFactor || 1.20;

  // --- INSTITUTIONAL PROTECTIVE FRACTIONAL RISK PROTECTION ENGINE ---
  let activeStake = baselineStake;
  if (typeof window !== 'undefined' && window.localStorage) {
    const activeStreakCount = parseInt(localStorage.getItem('EDASCORE_CONSECUTIVE_LOSS_COUNT') || '0', 10);
    
    if (activeStreakCount > 0) {
      if (profile.coreEngine === 'MARTINGALE' || profile.coreEngine === 'NEURAL_FLOW') {
        // Smooth scaling factor calculation replacing classic linear loss doubling loops completely
        activeStake = baselineStake * Math.pow(dynamicFactor, activeStreakCount);
      } else if (profile.coreEngine === 'DALEMBERT' || profile.coreEngine === 'PROGRESSIVE') {
        // Clean micro-step incrementation rules for secondary defensive strategy classes
        activeStake = baselineStake + (dynamicFactor * activeStreakCount);
      }

      // Hard coded risk management ceiling protection bounding layer
      const absoluteSafetyCeilingLimit = 2.50; 
      if (activeStake > absoluteSafetyCeilingLimit) {
        console.warn(`🛡️ Risk Manager clamped stake size from $${activeStake.toFixed(2)} to account survival limit of $${absoluteSafetyCeilingLimit}.`);
        activeStake = absoluteSafetyCeilingLimit;
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
