// scannerLogic.ts - PART 1: Core Engine State Structures & Logs

import { STRATEGY_PROFILES, evaluateStrategy, StrategyResult } from './strategies';

interface HistoricalTradeOutcome {
  wasWin: boolean;
  timestamp: number;
}

export class ScannerLogicEngine {
  // Store rolling price buffers for distinct continuous assets
  private tickHistoryRegistry: Map<string, number[]> = new Map();
  
  // Track consecutive drawdown streaks locally inside the background worker thread state isolate
  private continuousLossTrackers: Map<string, number> = new Map();
  
  // Performance cache tracking rolling historical win/loss outcomes per strategy profile
  private strategyPerformanceLogs: Map<string, HistoricalTradeOutcome[]> = new Map();
// scannerLogic.ts - PART 2: Inflow Streaming Actions & Performance Logs

  /**
   * Appends incoming price feeds to their respective asset data streams.
   */
  public injectTick(symbol: string, price: number): void {
    if (!this.tickHistoryRegistry.has(symbol)) {
      this.tickHistoryRegistry.set(symbol, []);
    }
    
    const stream = this.tickHistoryRegistry.get(symbol)!;
    stream.push(price);

    // Enforce sliding performance boundary window limits
    if (stream.length > 150) {
      stream.shift();
    }
  }

  /**
   * Updates loss streak variables dynamically based on main-thread execution signals.
   */
  public updateLossStreak(symbol: string, runningStreakCount: number): void {
    this.continuousLossTrackers.set(symbol, runningStreakCount);
  }

  /**
   * Logs a trade outcome into the data stream to compute current execution accuracy.
   */
  public logTradeOutcome(strategyId: string, isWin: boolean): void {
    if (!this.strategyPerformanceLogs.has(strategyId)) {
      this.strategyPerformanceLogs.set(strategyId, []);
    }
    
    const logs = this.strategyPerformanceLogs.get(strategyId)!;
    logs.push({ wasWin: isWin, timestamp: Date.now() });

    if (logs.length > 20) {
      logs.shift();
    }
  }
// scannerLogic.ts - PART 3: The Performance Filtering Pipeline

  /**
   * Calculates the true rolling statistical win percentage over the cached history window.
   */
  private calculateRollingWinRate(strategyId: string): number {
    const logs = this.strategyPerformanceLogs.get(strategyId) || [];
    if (logs.length === 0) return 0.50; 
    
    const wins = logs.filter(trade => trade.wasWin).length;
    return wins / logs.length;
  }

  /**
   * Loops through all registry profiles and calculates fresh real-time strategy matrix sheets.
   */
  public runScannerPipeline(): StrategyResult[] {
    const rawAggregatedOutput: StrategyResult[] = [];

    for (const profile of STRATEGY_PROFILES) {
      const symbolKey = this.resolveProfileSymbol(profile.targetSymbol);
      const currentPriceHistory = this.tickHistoryRegistry.get(symbolKey) || [];
      const currentStreak = this.continuousLossTrackers.get(symbolKey) || 0;

      // Calculate indicators safely across thread lines
      const baseEvaluation = evaluateStrategy(profile, currentPriceHistory, currentStreak);
      const currentRealWinRate = this.calculateRollingWinRate(profile.id);

      // PERFORMANCE DECAY PROTECTION: Demote strategy if real win rate hits dangerous lows
      if (currentRealWinRate < 0.45 && baseEvaluation.finalConfidence >= 82) {
        baseEvaluation.finalConfidence = Math.floor(baseEvaluation.finalConfidence * 0.75);
        baseEvaluation.tierOverride = 'MEDIUM';
        baseEvaluation.status = 'MEDIUM';
      }

      rawAggregatedOutput.push({
        ...baseEvaluation,
        liveAccuracyPercentage: Math.floor(currentRealWinRate * 100)
      });
    }

    return rawAggregatedOutput.sort((a, b) => b.finalConfidence - a.finalConfidence);
  }
// scannerLogic.ts - PART 4: Asset Lookup Resolution Map

  /**
   * Helper utility mapping code registry target string identifiers 
   * directly onto the raw WebSocket incoming string label blocks.
   */
  private resolveProfileSymbol(target: string): string {
    const assetMap: Record<string, string> = {
      'R_10': 'Volatility 10',
      'R_25': 'Volatility 25',
      'R_50': 'Volatility 50',
      'R_75': 'Volatility 75',
      'R_100': 'Volatility 100'
    };
    return assetMap[target] || target;
  }
} // 🏁 MASTER ENCLOSURE COMPLETE: scannerLogic.ts class fully synced.
