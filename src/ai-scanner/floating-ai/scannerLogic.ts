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
  private lockDurationMs: number = 4000;       // Holds top selection stable for 4 seconds
  private isEditingPaused: boolean = false;    // Freezes incoming stream frames if true
  private lastEvaluatedFrames: EvaluationFrame[] = [];

  public injectTick(symbol: string, price: number): void {
    if (!this.tickRegistry[symbol]) {
      this.tickRegistry[symbol] = [];
    }
    
    this.tickRegistry[symbol].push(price);

    if (this.tickRegistry[symbol].length > 120) {
      this.tickRegistry[symbol].shift();
    }
  }

  public setMarket(symbol: string): void {
    this.activeSymbol = symbol;
  }

  /**
   * Externally pauses the data pipeline processing layout 
   * to guarantee zero text field jumping mid-keystroke.
   */
  public setEditingState(isEditing: boolean): void {
    this.isEditingPaused = isEditing;
  }

  public runScannerPipeline(): EvaluationFrame[] {
    // 1. If user interaction lock is active, immediately return cached frames
    if (this.isEditingPaused && this.lastEvaluatedFrames.length > 0) {
      return this.lastEvaluatedFrames;
    }

    const currentTicks = this.tickRegistry[this.activeSymbol] || [];
    const currentTime = Date.now();
    
    // 2. Compute raw metrics across all 30 algorithmic strategies
    const freshFrames: EvaluationFrame[] = STRATEGY_PROFILES.map(profile => {
      const metrics = evaluateStrategy(profile, currentTicks);
      return { profile, metrics };
    });

    // 3. Multi-factor global ranking optimization layer
    const mathematicallySorted = [...freshFrames].sort((a, b) => {
      const weightA = a.metrics.scannerScore + a.metrics.finalConfidence;
      const weightB = b.metrics.scannerScore + b.metrics.finalConfidence;
      return weightB - weightA;
    });

    const candidateWinner = mathematicallySorted[0];

    // 4. Cooldown Lock Lifecycle Evaluation
    const isLockExpired = (currentTime - this.lastLockTime) > this.lockDurationMs;
    
    // Verify if our locked strategy is still trade-viable (Confidence >= 72%)
    const currentWinnerStillViable = freshFrames.some(
      f => f.profile.id === this.currentTopStrategyId && f.metrics.finalConfidence >= 72
    );

    // If lock has run out, or nothing is locked, or the current choice tanked, select a new anchor
    if (isLockExpired || !this.currentTopStrategyId || !currentWinnerStillViable) {
      if (candidateWinner && candidateWinner.metrics.finalConfidence >= 75) {
        this.currentTopStrategyId = candidateWinner.profile.id;
        this.lastLockTime = currentTime;
      } else {
        this.currentTopStrategyId = null; // Clears target if no framework matches threshold criteria
      }
    }

    // 5. Explicitly isolate status values so only ONE is flagged high globally
    const finalizedFrames = freshFrames.map(frame => {
      const isIsolatedWinner = this.currentTopStrategyId && (frame.profile.id === this.currentTopStrategyId);

      return {
        ...frame,
        metrics: {
          ...frame.metrics,
          // Explicitly map out local statuses relative to our global single-winner state
          status: isIsolatedWinner ? 'HIGH' : (frame.metrics.finalConfidence >= 62 ? 'MEDIUM' : 'LOW')
        }
      };
    });

    // Store history cache reference before exiting calculation layer
    this.lastEvaluatedFrames = finalizedFrames;
    return finalizedFrames;
  }
}
