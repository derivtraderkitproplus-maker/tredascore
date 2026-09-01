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
  private lockDurationMs: number = 2700;       
  private isEditingPaused: boolean = false;    
  private lastEvaluatedFrames: EvaluationFrame[] = [];

  // 🛡️ WATCHDOG COMPONENT: Tracks network tick arrival times
  private lastTickReceivedTimestamp: number = 0;

  public injectTick(symbol: string, price: number): void {
    if (!this.tickRegistry[symbol]) {
      this.tickRegistry[symbol] = [];
    }
    
    this.tickRegistry[symbol].push(price);
    
    // Update our network arrival tracking clock on every incoming tick packet
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
    // 1. If user interaction lock is active, immediately return cached frames
    if (this.isEditingPaused && this.lastEvaluatedFrames.length > 0) {
      return this.lastEvaluatedFrames;
    }

    const currentTicks = this.tickRegistry[this.activeSymbol] || [];
    const currentTime = Date.now();

    // 2. NETWORK SAFETY AUDIT CHECK (WATCHDOG DETECTOR)
    // If it has been more than 3.5 seconds since the last tick dropped, force a data freeze protection state
    const timeSinceLastTick = currentTime - this.lastTickReceivedTimestamp;
    
    if (this.lastTickReceivedTimestamp > 0 && timeSinceLastTick > 3500) {
      return this.lastEvaluatedFrames.map(frame => ({
        ...frame,
        metrics: {
          ...frame.metrics,
          marketState: 'STALE_DATA', // Flags clear visual error on header
          direction: 'FLAT',
          scannerScore: 0,
          marketCompatibility: 0,
          finalConfidence: 0,        // Drops confidence to 0% to deny bot loading actions
          status: 'LOW'
        }
      }));
    }
    
    // 3. Compute raw metrics across all 30 algorithmic strategies using updated real TA functions
    const freshFrames: EvaluationFrame[] = STRATEGY_PROFILES.map(profile => {
      const metrics = evaluateStrategy(profile, currentTicks);
      return { profile, metrics };
    });

    // 4. Multi-factor global ranking optimization layer
    const mathematicallySorted = [...freshFrames].sort((a, b) => {
      const weightA = a.metrics.scannerScore + a.metrics.finalConfidence;
      const weightB = b.metrics.scannerScore + b.metrics.finalConfidence;
      return weightB - weightA;
    });

    const candidateWinner = mathematicallySorted[0];

    // 5. Cooldown Lock Lifecycle Evaluation
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

    // 6. Enforce explicit status value isolation logic
    const finalizedFrames = freshFrames.map(frame => {
      const isIsolatedWinner = this.currentTopStrategyId && (frame.profile.id === this.currentTopStrategyId);

      return {
        ...frame,
        metrics: {
          ...frame.metrics,
          status: isIsolatedWinner ? 'HIGH' : (frame.metrics.finalConfidence >= 62 ? 'MEDIUM' : 'LOW')
        }
      };
    });

    this.lastEvaluatedFrames = finalizedFrames;
    return finalizedFrames;
  }
}
