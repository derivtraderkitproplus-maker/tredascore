// strategies.ts - PART 1: Strict Types & Module Configuration Interfaces

export interface MarketCondition {
  indicator: 'RSI' | 'EMA_CROSS' | 'BOLLINGER' | 'MACD' | 'ATR';
  period: number;
  threshold: number;
  comparison: 'GREATER_THAN' | 'LESS_THAN' | 'CROSS_OVER' | 'CROSS_UNDER';
}

export interface QuantitativeStrategy {
  id: string;
  name: string;
  description: string;
  confidenceThreshold: number;
  macroTrendFilter: boolean;
  volatilityClamp: boolean;
  minTicksDuration: number;
  entryConditions: MarketCondition[];
}

export const STRATEGY_REGISTRY_VERSION = "2.1.0-PRO";
// strategies.ts - PART 2: High-Performance Trend-Following Strategy Modules

export const QUANT_STRATEGY_REGISTRY: QuantitativeStrategy[] = [
  {
    id: "str_trend_shield_pro",
    name: "Trend Shield Pro (Institutional)",
    description: "Multi-layered trend follower. Utilizes a long-period Exponential Moving Average filter to execute high-confidence entries aligned with institutional macro momentum.",
    confidenceThreshold: 92.5,
    macroTrendFilter: true,
    volatilityClamp: true,
    minTicksDuration: 5,
    entryConditions: [
      {
        indicator: "EMA_CROSS",
        period: 50,
        threshold: 0,
        comparison: "CROSS_OVER"
      },
      {
        indicator: "RSI",
        period: 14,
        threshold: 55,
        comparison: "GREATER_THAN"
      },
      {
        indicator: "ATR",
        period: 14,
        threshold: 0.15,
        comparison: "GREATER_THAN"
      }
    ]
  },
  {
    id: "str_alpha_momentum",
    name: "Alpha Momentum Scalper",
    description: "Designed for explosive breakouts on hyper-fast assets like Volatility 100 (1s). Identifies sharp, continuous vector velocity acceleration gates.",
    confidenceThreshold: 88.0,
    macroTrendFilter: true,
    volatilityClamp: false,
    minTicksDuration: 5,
    entryConditions: [
      {
        indicator: "MACD",
        period: 12,
        threshold: 0,
        comparison: "CROSS_OVER"
      },
      {
        indicator: "RSI",
        period: 9,
        threshold: 60,
        comparison: "GREATER_THAN"
      }
    ]
  }
// strategies.ts - PART 3: Mean Reversion & Volatility Range Strategy Modules

  {
    id: "str_mean_reversion_pro",
    name: "Mean Reversion Pro",
    description: "Monitors mathematical deviations using historical volatility envelopes. Identifies exhausted price vectors to capture smooth asset corrections.",
    confidenceThreshold: 90.0,
    macroTrendFilter: false,
    volatilityClamp: true,
    minTicksDuration: 5,
    entryConditions: [
      {
        indicator: "BOLLINGER",
        period: 20,
        threshold: 2.0, // Standard deviations
        comparison: "CROSS_UNDER"
      },
      {
        indicator: "RSI",
        period: 14,
        threshold: 30,
        comparison: "LESS_THAN"
      }
    ]
  },
  {
    id: "str_volatility_breakout",
    name: "Volatility Compression Burst",
    description: "Detects low-volatility compression boxes (Bollinger Band squeezes) and executes instant positional updates as soon as an explosive price expansion begins.",
    confidenceThreshold: 85.0,
    macroTrendFilter: false,
    volatilityClamp: true,
    minTicksDuration: 5,
    entryConditions: [
      {
        indicator: "BOLLINGER",
        period: 20,
        threshold: 0.05, // Narrow band width threshold
        comparison: "CROSS_OVER"
      },
      {
        indicator: "ATR",
        period: 10,
        threshold: 0.25,
        comparison: "GREATER_THAN"
      }
    ]
  }
];
// strategies.ts - PART 4: Real-Time Signal Processing & Confidence Scoring Engine

export interface TechnicalIndicatorData {
  rsi?: number;
  emaCrossValue?: number;
  macdHistogram?: number;
  bollingerUpper?: number;
  bollingerLower?: number;
  currentPrice?: number;
  atr?: number;
}

/**
 * MATHEMATICAL SCORING ENGINE
 * Evaluates live market arrays to calculate the analytical strategy confidence scores.
 */
export function calculateStrategyConfidence(
  strategy: QuantitativeStrategy,
  marketData: TechnicalIndicatorData
): number {
  if (!strategy.entryConditions || strategy.entryConditions.length === 0) return 0;

  let verifiedConditionsCount = 0;
  const totalConditionsCount = strategy.entryConditions.length;

  strategy.entryConditions.forEach((condition) => {
    switch (condition.indicator) {
      case "RSI":
        if (marketData.rsi !== undefined) {
          if (condition.comparison === "GREATER_THAN" && marketData.rsi > condition.threshold) verifiedConditionsCount++;
          if (condition.comparison === "LESS_THAN" && marketData.rsi < condition.threshold) verifiedConditionsCount++;
        }
        break;

      case "EMA_CROSS":
        if (marketData.emaCrossValue !== undefined) {
          if (condition.comparison === "CROSS_OVER" && marketData.emaCrossValue > condition.threshold) verifiedConditionsCount++;
          if (condition.comparison === "CROSS_UNDER" && marketData.emaCrossValue < condition.threshold) verifiedConditionsCount++;
        }
        break;

      case "MACD":
        if (marketData.macdHistogram !== undefined) {
          if (condition.comparison === "CROSS_OVER" && marketData.macdHistogram > condition.threshold) verifiedConditionsCount++;
          if (condition.comparison === "CROSS_UNDER" && marketData.macdHistogram < condition.threshold) verifiedConditionsCount++;
        }
        break;

      case "BOLLINGER":
        if (marketData.currentPrice !== undefined && marketData.bollingerUpper !== undefined && marketData.bollingerLower !== undefined) {
          if (condition.comparison === "CROSS_OVER" && marketData.currentPrice >= marketData.bollingerUpper) verifiedConditionsCount++;
          if (condition.comparison === "CROSS_UNDER" && marketData.currentPrice <= marketData.bollingerLower) verifiedConditionsCount++;
        }
        break;

      case "ATR":
        if (marketData.atr !== undefined) {
          if (condition.comparison === "GREATER_THAN" && marketData.atr > condition.threshold) verifiedConditionsCount++;
          if (condition.comparison === "LESS_THAN" && marketData.atr < condition.threshold) verifiedConditionsCount++;
        }
        break;

      default:
        break;
    }
  });

  // Calculate final percentage score
  return (verifiedConditionsCount / totalConditionsCount) * 100;
}
// strategies.ts - PART 5: Automated Market Regime & Volatility Validators

export interface RegimeFilterResult {
  isPermitted: boolean;
  reason: string;
}

/**
 * STRUCTURAL REGIME VALIDATOR
 * Verifies if macro market states allow safe trade execution profiles.
 */
export function validateMarketRegime(
  strategy: QuantitativeStrategy,
  macroEmaTrend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS',
  currentAtr: number,
  historicalMinAtr: number
): RegimeFilterResult {
  
  // 1. MACRO TREND CROSS-MATCH FILTER
  if (strategy.macroTrendFilter) {
    if (macroEmaTrend === 'SIDEWAYS') {
      return {
        isPermitted: false,
        reason: "Macro market regime is sideways/choppy. Disabling trend allocation entries."
      };
    }
  }

  // 2. VOLATILITY COMPRESSION GATE
  if (strategy.volatilityClamp) {
    if (currentAtr < historicalMinAtr) {
      return {
        isPermitted: false,
        reason: "Market volatility levels fell below minimum noise thresholds. Execution locked."
      };
    }
  }

  return {
    isPermitted: true,
    reason: "Market structure passes all institutional safety validations."
  };
}
// strategies.ts - PART 6: Strategy Resolution Helpers & Registry Utilities

/**
 * STRATEGY CONFIGURATION RESOLVER
 * Safely locates an active strategy profile from the unified registry map.
 */
export function getStrategyProfileById(strategyId: string): QuantitativeStrategy | undefined {
  return QUANT_STRATEGY_REGISTRY.find(strategy => strategy.id === strategyId);
}

/**
 * SIGNAL COMPILATION HELPER
 * Evaluates strategy parameters to verify if a confidence score meets the execution threshold.
 */
export function verifyStrategySignal(
  strategyId: string, 
  marketData: TechnicalIndicatorData,
  macroEmaTrend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS',
  currentAtr: number,
  historicalMinAtr: number
): { shouldTrade: boolean; confidenceScore: number; validationMessage: string } {
  
  const strategy = getStrategyProfileById(strategyId);
  if (!strategy) {
    return { shouldTrade: false, confidenceScore: 0, validationMessage: "Strategy profile not registered." };
  }

  // 1. Calculate Confidence Scoring Metrics
  const confidenceScore = calculateStrategyConfidence(strategy, marketData);
  
  // 2. Cross-Verify Market Regime Safety Envelopes
  const regimeCheck = validateMarketRegime(strategy, macroEmaTrend, currentAtr, historicalMinAtr);
  if (!regimeCheck.isPermitted) {
    return { shouldTrade: false, confidenceScore, validationMessage: regimeCheck.reason };
  }

  // 3. Evaluate Threshold Bounds
  const hasMetThreshold = confidenceScore >= strategy.confidenceThreshold;
  const statusMessage = hasMetThreshold 
    ? `🎯 Signal confirmed! Strategy meets threshold with ${confidenceScore.toFixed(1)}% confidence.` 
    : `⏳ Signal scanning... Current confidence at ${confidenceScore.toFixed(1)}% (Threshold: ${strategy.confidenceThreshold}%).`;

  return {
    shouldTrade: hasMetThreshold,
    confidenceScore,
    validationMessage: statusMessage
  };
}

// Global configuration constants used by the front-end menu panel cards
export const SYSTEM_TUNING_PROFILES = {
  TREND_MODE: "TREND_FOLLOWER",
  NOISE_GATE_TICKS: 5,
  WHITE_LABEL_REF: "tredascore.pro"
};
