// scannerLogic.ts
import { STRATEGY_PROFILES, evaluateStrategy, StrategyResult, StrategyProfile } from './strategies';

export interface EvaluationFrame {
  profile: StrategyProfile;
  metrics: StrategyResult;
}

export class ScannerLogicEngine {
  private tickRegistry: Record<string, number[]> = {};
  private activeSymbol: string = 'R_100';

  // --- STABILITY & SINGLE-WINNER LOCK STATE ---
  private currentTopStrategyId: string | null = null;
  private lastLockTime: number = 0;
  private lockDurationMs: number = 2700;       // Explicit 2.7-second transition cycle
  private isEditingPaused: boolean = false;    // Pauses tick pipeline loops while typing
  private lastEvaluatedFrames: EvaluationFrame[] = [];
  private lastTickReceivedTimestamp: number = 0;

  public injectTick(symbol: string, price: number): void {
    if (!this.tickRegistry[symbol]) {
      this.tickRegistry[symbol] = [];
    }
    
    this.tickRegistry[symbol].push(price);
    this.lastTickReceivedTimestamp = Date.now();

    if (this.tickRegistry[symbol].length > 120) {
      this.tickRegistry[symbol].shift();
    }
  }

  public setMarket(symbol: string): void {
    this.activeSymbol = symbol;
  }

  public setEditingState(isEditing: boolean): void {
    this.isEditingPaused = isEditing;
  }

  public runScannerPipeline(): EvaluationFrame[] {
    // 1. Return cached frame buffers instantly if user interaction lock is engaged
    if (this.isEditingPaused && this.lastEvaluatedFrames.length > 0) {
      return this.lastEvaluatedFrames;
    }

    const currentTicks = this.tickRegistry[this.activeSymbol] || [];
    const currentTime = Date.now();

    // 2. NETWORK WATCHDOG OVERRIDE
    const timeSinceLastTick = currentTime - this.lastTickReceivedTimestamp;
    if (this.lastTickReceivedTimestamp > 0 && timeSinceLastTick > 3500) {
      return this.lastEvaluatedFrames.map(frame => ({
        ...frame,
        metrics: {
          ...frame.metrics,
          marketState: 'STALE_DATA',
          direction: 'FLAT',
          scannerScore: 0,
          marketCompatibility: 0,
          finalConfidence: 0,
          status: 'LOW'
        }
      }));
    }
    
    // 3. Compute clean raw mathematical metrics across all strategy patterns
    const freshFrames: EvaluationFrame[] = STRATEGY_PROFILES.map(profile => {
      const metrics = evaluateStrategy(profile, currentTicks);
      return { profile, metrics };
    });

    // 4. MULTI-FACTOR SORTING LAYER: Rank raw profiles by mathematical performance first
    const mathematicallySorted = [...freshFrames].sort((a, b) => {
      const weightA = a.metrics.scannerScore + a.metrics.finalConfidence;
      const weightB = b.metrics.scannerScore + b.metrics.finalConfidence;
      return weightB - weightA;
    });

    const candidateWinner = mathematicallySorted[0];

    // 5. Manage Single-Winner Stability Lock Cooldowns
    const isLockExpired = (currentTime - this.lastLockTime) > this.lockDurationMs;
    const currentWinnerStillViable = freshFrames.some(
      f => f.profile.id === this.currentTopStrategyId && f.metrics.finalConfidence >= 72
    );

    if (isLockExpired || !this.currentTopStrategyId || !currentWinnerStillViable) {
      if (candidateWinner && candidateWinner.metrics.finalConfidence >= 75) {
        this.currentTopStrategyId = candidateWinner.profile.id;
        this.lastLockTime = currentTime;
      } else {
        this.currentTopStrategyId = null; 
      }
    }

    // 6. Explicitly assign status values relative to our isolated single-winner anchor ID
    const finalizedFrames = freshFrames.map(frame => {
      const isIsolatedWinner = this.currentTopStrategyId && (frame.profile.id === this.currentTopStrategyId);

      return {
        ...frame,
        metrics: {
          ...frame.metrics,
          // Assign clean status overrides without cross-contaminating other item objects
          status: isIsolatedWinner ? 'HIGH' : (frame.metrics.finalConfidence >= 62 ? 'MEDIUM' : 'LOW')
        }
      };
    });

    // 7. FIXED STRUCTURAL HOOK: Enforce final rank sort before caching data out to React
    const rankedOutput = finalizedFrames.sort((a, b) => {
      const scoreA = a.metrics.status === 'HIGH' ? 2 : (a.metrics.status === 'MEDIUM' ? 1 : 0);
      const scoreB = b.metrics.status === 'HIGH' ? 2 : (b.metrics.status === 'MEDIUM' ? 1 : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.metrics.finalConfidence - a.metrics.finalConfidence;
    });

    this.lastEvaluatedFrames = rankedOutput;
    return rankedOutput;
  }
}
