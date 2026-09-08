// scannerLogic.ts - PART 1: Core Engine State Structures & Focus Properties

import { STRATEGY_PROFILES, evaluateStrategy, StrategyResult } from './strategies';

interface HistoricalTradeOutcome {
  wasWin: boolean;
  timestamp: number;
}

export class ScannerLogicEngine {
  // Store a rolling memory ring-buffer of raw historical price ticks for each unique asset symbol
  private tickHistoryRegistry: Map<string, number[]> = new Map();
  
  // Track consecutive drawdown streaks locally within the background thread state isolate
  private continuousLossTrackers: Map<string, number> = new Map();
  
  // High-performance cache tracking rolling historical win/loss outcomes per strategy profile
  private strategyPerformanceLogs: Map<string, HistoricalTradeOutcome[]> = new Map();

  // ✅ FIXED FOCUS STATE FLAG: Tracks when a user is modifying form fields to freeze re-sorting frames
  private isEditingStateActive: boolean = false; 

  /**
   * ✅ FIXED INTERFACE HANDSHAKE METHOD: Exposes the focus toggles that FloatingAI triggers inside its useEffect loops
   */
  public setEditingState(isFocused: boolean): void {
    this.isEditingStateActive = isFocused;
  }
// scannerLogic.ts - PART 2: Inflow Streaming Actions & Performance Logs

  /**
   * Appends incoming price feeds to their respective asset data streams.
   * Enforces a sliding lookback performance window automatically.
   */
  public injectTick(symbol: string, price: number): void {
    if (!this.tickHistoryRegistry.has(symbol)) {
      this.tickHistoryRegistry.set(symbol, []);
    }
    
    const stream = this.tickHistoryRegistry.get(symbol)!;
    stream.push(price);

    // Enforce an upper performance horizon bound limit to manage worker memory footprints
    if (stream.length > 150) {
      stream.shift();
    }
  }

  /**
   * Updates loss streak variables dynamically based on main-thread execution signals.
   * This bridges the thread separation layer when loss events settle.
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

    // Clamp tracking array memory allocations strictly to the last 20 operations
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
    if (logs.length === 0) return 0.50; // Return a clean 50% baseline if no trade data exists yet
    
    const wins = logs.filter(trade => trade.wasWin).length;
    return wins / logs.length;
  }

  /**
   * Loops through all registry profiles and calculates fresh real-time strategy matrix sheets.
   */
  public runScannerPipeline(): StrategyResult[] {
    // Preserve current UI user focus inputs if editing states are locked active
    if (this.isEditingStateActive) return [];

    const rawAggregatedOutput: StrategyResult[] = [];

    for (const profile of STRATEGY_PROFILES) {
      const symbolKey = this.resolveProfileSymbol(profile.targetSymbol);
      const currentPriceHistory = this.tickHistoryRegistry.get(symbolKey) || [];
      const currentStreak = this.continuousLossTrackers.get(symbolKey) || 0;

      // 1. Calculate the core analytical and math technical data frame indicators
      const baseEvaluation = evaluateStrategy(profile, currentPriceHistory, currentStreak);
      
      // 2. Extract real-world rolling performance data accuracy metrics
      const currentRealWinRate = this.calculateRollingWinRate(profile.id);

      // 3. PERFORMANCE ACCURACY PENALTY GATE: If real historical win rate decays below 45%, 
      // reduce the confidence value so the strategy card drops out of the HIGH execution tier.
      if (currentRealWinRate < 0.45 && baseEvaluation.finalConfidence >= 82) {
        baseEvaluation.finalConfidence = Math.floor(baseEvaluation.finalConfidence * 0.75);
        baseEvaluation.tierOverride = 'MEDIUM';
        baseEvaluation.status = 'MEDIUM';
      }

      // 4. ✅ FIXED PAYLOAD MAP: Normalizes return objects to direct properties matching FloatingAI keys
      rawAggregatedOutput.push({
        profileId: profile.id,
        ticksLoaded: baseEvaluation.ticksLoaded,
        marketState: baseEvaluation.marketState,
        direction: baseEvaluation.direction,
        scannerScore: baseEvaluation.scannerScore,
        marketCompatibility: baseEvaluation.marketCompatibility,
        finalConfidence: baseEvaluation.finalConfidence,
        tierOverride: baseEvaluation.tierOverride,
        status: baseEvaluation.tierOverride,
        liveAccuracyPercentage: Math.floor(currentRealWinRate * 100),
        executionPayload: baseEvaluation.executionPayload
      });
    }

    // Sort snapshots uniformly from highest confidence tier down to lowest
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
} // 🏁 MASTER ENCLOSURE COMPLETE: scannerLogic.ts class fully closed and aligned.
