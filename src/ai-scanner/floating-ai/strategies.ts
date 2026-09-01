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
  { id: 'STRATEGY_1_3_2_6', name: '1-3-2-6', tier: 'MEDIUM', requiredTicks: 100, confidenceGate: 68, description: 'Fixed progressive staking sequence.' },
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
  { id: 'REVERSE_MARTINGALE', name: 'Reverse Martingale', tier: 'HIGH', requiredTicks: 100, confidenceGate: 76, description: 'Compounded profit maximizing pipeline.' }
];

// Generate automated placeholder entries up to exactly 30 profiles cleanly
for (let i = STRATEGY_PROFILES.length + 1; i <= 30; i++) {
  STRATEGY_PROFILES.push({
    id: `AUTO_GEN_STRATEGY_${i}`,
    name: `AI Alpha Engine v${i}`,
    tier: i % 3 === 0 ? 'HIGH' : i % 2 === 0 ? 'MEDIUM' : 'LOW',
    requiredTicks: 100,
    confidenceGate: 50 + (i % 25),
    description: `Automated dynamic asset monitoring protocol cluster ${i}.`
  });
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

  // 1. EXTRACT EXPLICIT DATA COORDINATE WINDOWS
  const shortTerm = ticks.slice(-10);
  const mediumTerm = ticks.slice(-30);
  const longTerm = ticks.slice(-100);

  // 2. RUN DIRECTIONAL COUNTER ANALYSIS LOOPS
  let shortUps = 0;
  for (let i = 1; i < shortTerm.length; i++) {
    if (shortTerm[i] > shortTerm[i - 1]) shortUps++;
  }

  let medUps = 0;
  for (let i = 1; i < mediumTerm.length; i++) {
    if (mediumTerm[i] > mediumTerm[i - 1]) medUps++;
  }

  // Calculate dynamic momentum vectors via lookback average spreads
  const pastAvg = longTerm.slice(0, 30).reduce((a, b) => a + b, 0) / 30;
  const recentAvg = longTerm.slice(-30).reduce((a, b) => a + b, 0) / 30;
  
  let direction = 'FLAT';
  const baselineThreshold = 0.015;
  if (recentAvg > pastAvg + baselineThreshold) direction = 'UP';
  else if (recentAvg < pastAvg - baselineThreshold) direction = 'DOWN';

  // 3. CATEGORY SPECIFIC INTERFERENCE ALGORITHMS
  let scannerScore = 50;
  let marketCompatibility = 50;

  const currentPrice = ticks[ticks.length - 1];
  const initialPrice = ticks[0]; // FIXED: Accesses explicit primitive index position
  const totalVariance = Math.abs(currentPrice - initialPrice) / (initialPrice || 1);

  if (profile.id.startsWith('AI_')) {
    // CATEGORY A: Neural Engine Indicators (Filters momentum waves and micro-trends)
    const shortVelocity = shortUps / 9;
    const mediumVelocity = medUps / 29;
    
    if (profile.id === 'AI_TREND_PRINTER') {
      scannerScore = Math.floor(mediumVelocity * 100);
      marketCompatibility = direction !== 'FLAT' ? 88 : 40;
    } else if (profile.id === 'AI_ACC_FLOW') {
      scannerScore = Math.floor((shortVelocity * 0.4 + mediumVelocity * 0.6) * 100);
      marketCompatibility = Math.min(95, Math.floor(60 + (totalVariance * 4000)));
    } else {
      // Conservative/Balanced configurations
      scannerScore = Math.floor(55 + (shortUps * 3));
      marketCompatibility = Math.min(95, Math.max(20, Math.floor(65 - (totalVariance * 1000))));
    }
  } else if (profile.id.startsWith('ACC_')) {
    // CATEGORY B: Accumulator Profiles (Evaluates boundary ranges and standard deviation channels)
    const devList = mediumTerm.map(t => Math.pow(t - recentAvg, 2));
    const standardDeviation = Math.sqrt(devList.reduce((a, b) => a + b, 0) / devList.length);
    const channelWidth = standardDeviation / (recentAvg || 1);

    if (profile.id === 'ACC_MARTINGALE' || profile.id === 'ACC_REVERSE_MARTINGALE') {
      scannerScore = Math.min(98, Math.floor(40 + (channelWidth * 6000) + (shortUps * 2)));
      marketCompatibility = direction === 'UP' ? 85 : 55;
    } else {
      // D'Alembert style systems
      scannerScore = Math.min(95, Math.max(20, Math.floor(70 - (channelWidth * 3000))));
      marketCompatibility = Math.floor(50 + (medUps * 1.2));
    }
  } else {
    // CATEGORY C: Progressive Staking Systems (1-3-2-6 and Classic Martingale formulas)
    // FIXED: Formulates trend tracking streaks using single array item indices safely
    const consecutiveStreak = shortTerm[shortTerm.length - 1] > shortTerm[shortTerm.length - 2] && shortTerm[shortTerm.length - 2] > shortTerm[shortTerm.length - 3];
    
    if (profile.id === 'STRATEGY_1_3_2_6') {
      scannerScore = consecutiveStreak ? 85 : 45;
      marketCompatibility = Math.floor(50 + (shortUps * 4));
    } else {
      scannerScore = Math.floor(50 + (shortUps * 3) + (profile.name.length % 10));
      marketCompatibility = Math.floor(40 + (medUps * 1.5));
    }
  }

  // Ensure calculations fit safely within clean percentage bounds
  scannerScore = Math.min(99, Math.max(15, scannerScore));
  marketCompatibility = Math.min(99, Math.max(15, marketCompatibility));

  // Compute final system validation weights
  const finalConfidence = Math.floor((scannerScore + marketCompatibility) / 2);

  // Dynamic Tier classifications based on real-time live performance scores
  let tierOverride: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (finalConfidence >= 75) tierOverride = 'HIGH';
  else if (finalConfidence >= 60) tierOverride = 'MEDIUM';

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
