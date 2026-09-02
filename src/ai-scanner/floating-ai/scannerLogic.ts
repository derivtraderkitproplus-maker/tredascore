// scannerLogic.ts - PART 1: Core Engine Structure & Categorized Filtering Array Loop
import { STRATEGY_PROFILES, evaluateStrategy, StrategyResult, StrategyProfile } from './strategies';

export interface EvaluationFrame {
  profile: StrategyProfile;
  metrics: StrategyResult;
}

export class ScannerLogicEngine {
  private tickRegistry: Record<string, number[]> = {};

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

  public setEditingState(isEditing: boolean): void {
    this.isEditingPaused = isEditing;
  }

  public runScannerPipeline(): EvaluationFrame[] {
    // 1. Return cached frame buffers instantly if user interaction lock is engaged
    if (this.isEditingPaused && this.lastEvaluatedFrames.length > 0) {
      return this.lastEvaluatedFrames;
    }

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
    
    // 3. Compute clean raw mathematical metrics across all strategy patterns dynamically based on their specific target asset volatility
    const freshFrames: EvaluationFrame[] = STRATEGY_PROFILES.map(profile => {
      // FIX HERE: Pull data using each strategy's independent asset index token
      const currentTicks = this.tickRegistry[profile.targetSymbol] || [];
      const metrics = evaluateStrategy(profile, currentTicks);
      return { profile, metrics };
    });

    // 4. BALANCED ENGINE ISOLATION FILTERING: Separate strategies into pools by Contract Type
    const pools = {
      RISE_FALL: freshFrames.filter(f => f.profile.contractType === 'RISE_FALL'),
      OVER_UNDER: freshFrames.filter(f => f.profile.contractType === 'OVER_UNDER'),
      TOUCH_NO_TOUCH: freshFrames.filter(f => f.profile.contractType === 'TOUCH_NO_TOUCH'),
      ACCUMULATOR: freshFrames.filter(f => f.profile.contractType === 'ACCUMULATOR')
    };

    // Helper sorting routine to discover champions inside isolated categories
    const getSortedPool = (arr: EvaluationFrame[]) => {
      return [...arr].sort((a, b) => {
        const weightA = a.metrics.scannerScore + a.metrics.finalConfidence;
        const weightB = b.metrics.scannerScore + b.metrics.finalConfidence;
        return weightB - weightA;
      });
    };

    const sortedRiseFall = getSortedPool(pools.RISE_FALL);
    const sortedOverUnder = getSortedPool(pools.OVER_UNDER);
    const sortedTouch = getSortedPool(pools.TOUCH_NO_TOUCH);
    const sortedAccum = getSortedPool(pools.ACCUMULATOR);
    // scannerLogic.ts - PART 2: Winner Isolation Logic, Cooldowns, and Output Sorting
    
    // Merge the top sorted category assets evenly to produce an authentic diversified configuration matrix output
    const balancedPoolWinnerList: EvaluationFrame[] = [];
    
    // Push top 2 performers of each class type to prevent single-asset dashboard monopoly
    if (sortedRiseFall.length > 0) balancedPoolWinnerList.push(...sortedRiseFall.slice(0, 2));
    if (sortedOverUnder.length > 0) balancedPoolWinnerList.push(...sortedOverUnder.slice(0, 2));
    if (sortedTouch.length > 0) balancedPoolWinnerList.push(...sortedTouch.slice(0, 2));
    if (sortedAccum.length > 0) balancedPoolWinnerList.push(...sortedAccum.slice(0, 2));

    // Gather items not pushed yet to fill up the remaining layout rows cleanly
    const existingIds = new Set(balancedPoolWinnerList.map(f => f.profile.id));
    const remainderStrats = freshFrames.filter(f => !existingIds.has(f.profile.id));
    
    // Final composite output set consisting of champion variants first followed by baseline elements
    const combinedBalancedOutput = [
      ...balancedPoolWinnerList,
      ...remainderStrats.sort((a, b) => b.metrics.finalConfidence - a.metrics.finalConfidence)
    ];

    // Find the current candidate winner from the top globally performing profile
    const globalSortedChallengers = [...freshFrames].sort((a, b) => {
      return (b.metrics.scannerScore + b.metrics.finalConfidence) - (a.metrics.scannerScore + a.metrics.finalConfidence);
    });
    const candidateWinner = globalSortedChallengers[0];

    // Find the currently active leader frame to extract its live performance metrics
    const currentLeaderFrame = freshFrames.find(f => f.profile.id === this.currentTopStrategyId);
    
    // 5. Manage Single-Winner Stability Lock Cooldowns & Relative Dethroning
    const isLockExpired = (currentTime - this.lastLockTime) > this.lockDurationMs;
    
    // Condition A: Verify if current top strategy is still baseline viable
    const currentWinnerStillViable = currentLeaderFrame && currentLeaderFrame.metrics.finalConfidence >= 55;
    
    // Condition B: Hysteresis check. Dethrone if candidate beats the current leader by an obvious margin
    let isCurrentWinnerDethronedByPerformance = false;
    if (candidateWinner && currentLeaderFrame && candidateWinner.profile.id !== this.currentTopStrategyId) {
      const leaderWeight = currentLeaderFrame.metrics.scannerScore + currentLeaderFrame.metrics.finalConfidence;
      const candidateWeight = candidateWinner.metrics.scannerScore + candidateWinner.metrics.finalConfidence;
      
      // If a challenger beats the leader by a weight gap of 8 points, allow an early override swap
      if (candidateWeight > (leaderWeight + 8)) {
        isCurrentWinnerDethronedByPerformance = true;
      }
    }

    // Process updates if structural timer expired, baseline failed, or a new candidate drastically crushed it
    if (isLockExpired || !this.currentTopStrategyId || !currentWinnerStillViable || isCurrentWinnerDethronedByPerformance) {
      if (candidateWinner && candidateWinner.metrics.finalConfidence >= 55) {
        this.currentTopStrategyId = candidateWinner.profile.id;
        this.lastLockTime = currentTime;
      } else {
        this.currentTopStrategyId = null; 
      }
    }

    // 6. Explicitly assign status values relative to our isolated top position across the array structure
    const finalizedFrames = combinedBalancedOutput.map(frame => {
      const isIsolatedWinner = this.currentTopStrategyId && (frame.profile.id === this.currentTopStrategyId);

      return {
        ...frame,
        metrics: {
          ...frame.metrics,
          // Force the true isolated winner to remain "HIGH", others map secondary bounds cleanly
          status: isIsolatedWinner ? 'HIGH' : (frame.metrics.finalConfidence >= 62 ? 'MEDIUM' : 'LOW')
        }
      };
    });

    // 7. ENFORCE FINAL RANK SORT: Put the isolated high status strategy exactly at index 0, sorting the rest by confidence
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
