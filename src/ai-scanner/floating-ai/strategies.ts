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
  { id: 'AI_ACC_FLOW', name: 'AI Accumulator Flow', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 70, description: 'Neural momentum tracking array.' },
  { id: 'AI_ADAPTIVE', name: 'AI Adaptive', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 60, description: 'Dynamic lookback structural variant.' }
  // Expand up to 30 strategy objects matching your layout...
];

export interface StrategyResult {
  profileId: string;
  ticksLoaded: number;
  marketState: 'INSUFFICIENT_DATA' | 'READY';
  direction: 'UP' | 'DOWN' | 'FLAT';
  scannerScore: number;
  marketCompatibility: number;
  finalConfidence: number;
}

// Computes technical or AI indicators against the lookback tick buffer
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
    };
  }

  // Pure Client-side Math Inference Engine
  // Take last 10 ticks to evaluate short term direction vector
  const recent = ticks.slice(-10);
  const diffs = recent.map((t, i) => (i === 0 ? 0 : t - recent[i - 1])).slice(1);
  const upTicks = diffs.filter(d => d > 0).length;
  
  let direction: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
  if (upTicks > 6) direction = 'UP';
  else if (upTicks < 3) direction = 'DOWN';

  // Generate deterministic score parameters from tick matrices
  const scannerScore = Math.floor(Math.sin(ticks[ticks.length - 1]) * 20) + 60; // Mock calculation logic
  const marketCompatibility = Math.floor((upTicks / 9) * 100);
  const finalConfidence = Math.floor((scannerScore + marketCompatibility) / 2);

  return {
    profileId: profile.id,
    ticksLoaded: currentCount,
    marketState: 'READY',
    direction,
    scannerScore,
    marketCompatibility,
    finalConfidence,
  };
}
