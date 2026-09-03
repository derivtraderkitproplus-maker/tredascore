// scannerLogic.ts - PART 1: Imports, Configurations, and Broadcast Engine
import { STRATEGY_PROFILES, evaluateStrategy, StrategyResult, StrategyProfile } from './strategies';

export interface EvaluationFrame {
  profile: StrategyProfile;
  metrics: StrategyResult;
}

interface HighConfidenceSignal {
  strategyName: string;
  assetName: string;
  confidenceScore: number;
  recommendedAction: string;
}

// --- TELEGRAM CONFIGURATIONS ---
const TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_API_TOKEN"; 
const TELEGRAM_CHANNEL_ID = "@your_public_channel_username"; // e.g., @EdascoreSignals

/**
 * Fires an automated marketing signal alert to your Telegram community 
 * whenever a strategy breaks threshold criteria to drive inbound turnover volume.
 */
export async function broadcastSignalToTelegram(signal: HighConfidenceSignal) {
  // FIXED: Lowered safety gate to 75% so strategies like Trend Shield Pro trigger instantly
  if (signal.confidenceScore < 75) return;

  const webAppURL = "https://vercel.app";
  
  // Format clean marketing string payload optimized for Telegram Markdown layout structures
  const messageText = encodeURIComponent(
    `🔥 *NEW HIGH-PROBABILITY SIGNAL DETECTED* 🔥\n\n` +
    `🤖 *Strategy:* ${signal.strategyName}\n` +
    `📊 *Asset Class:* ${signal.assetName}\n` +
    `🎯 *AI Confidence Score:* ${signal.confidenceScore}%\n` +
    `⚡ *Action Direction:* ${signal.recommendedAction === 'DOWN' ? 'PUT 🔴 (FALL)' : 'CALL 🟢 (RISE)'}\n\n` +
    `👉 [Click Here to Deploy Auto-Trader on Your Account](${webAppURL})`
  );

  const telegramApiEndPoint = `https://telegram.org{TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHANNEL_ID}&text=${messageText}&parse_mode=Markdown`;

  try {
    const response = await fetch(telegramApiEndPoint);
    if (response.ok) {
      console.log(`✅ Automated Signal Broadcast dispatched successfully for: ${signal.strategyName}`);
    } else {
      console.error("❌ Telegram channel payload rejected:", response.statusText);
    }
  } catch (error) {
    console.error("🚨 Asynchronous API transmission failed:", error);
  }
}
// scannerLogic.ts - PART 2: Core Processing Engine and Selection Pipeline

export class ScannerLogicEngine {
  private tickRegistry: Record<string, number[]> = {};

  // --- STABILITY & SINGLE-WINNER LOCK STATE ---
  private currentTopStrategyId: string | null = null;
  private lastLockTime: number = 0;
  private lockDurationMs: number = 2700;       // Explicit 2.7-second transition cycle
  private isEditingPaused: boolean = false;    // Pauses tick pipeline loops while typing
  private lastEvaluatedFrames: EvaluationFrame[] = [];
  private lastTickReceivedTimestamp: number = 0;

  // --- COMPREHENSIVE ASSET TOKEN NORMALIZER ---
  private standardizeSymbol(s: string): string {
    const term = s.toUpperCase().trim();
    if (term.includes('1HZ10V') || term === 'R_10') return 'R_10';
    if (term.includes('1HZ25V') || term === 'R_25') return 'R_25';
    if (term.includes('1HZ50V') || term === 'R_50') return 'R_50';
    if (term.includes('1HZ75V') || term === 'R_75') return 'R_75';
    if (term.includes('1HZ100V') || term === 'R_100') return 'R_100';
    return s;
  }

  public injectTick(symbol: string, price: number): void {
    const normalizedSymbol = this.standardizeSymbol(symbol);

    if (!this.tickRegistry[normalizedSymbol]) {
      this.tickRegistry[normalizedSymbol] = [];
    }
    
    this.tickRegistry[normalizedSymbol].push(price);
    this.lastTickReceivedTimestamp = Date.now();

    if (this.tickRegistry[normalizedSymbol].length > 120) {
      this.tickRegistry[normalizedSymbol].shift();
    }
  }

  public setEditingState(isEditing: boolean): void {
    this.isEditingPaused = isEditing;
  }

  /**
   * ADMIN MANUAL OVERRIDE: Skips all pipeline criteria and forces an instant Telegram alert
   */
  public forceManualTelegramBroadcast(activeFrame: EvaluationFrame): void {
    if (!activeFrame) return;
    
    broadcastSignalToTelegram({
      strategyName: activeFrame.profile.name,
      assetName: activeFrame.profile.targetSymbol.replace('R_', 'Volatility '),
      confidenceScore: activeFrame.metrics.finalConfidence,
      recommendedAction: activeFrame.metrics.direction
    });
    
    console.log(`⚡ Admin Override: Manually pushed ${activeFrame.profile.name} to channel feed.`);
  }

  public runScannerPipeline(): EvaluationFrame[] {
    if (this.isEditingPaused && this.lastEvaluatedFrames.length > 0) {
      return this.lastEvaluatedFrames;
    }

    const currentTime = Date.now();

    // NETWORK WATCHDOG OVERRIDE
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
    
    const freshFrames: EvaluationFrame[] = STRATEGY_PROFILES.map(profile => {
      const targetToken = this.standardizeSymbol(profile.targetSymbol);
      const currentTicks = this.tickRegistry[targetToken] || [];
      const metrics = evaluateStrategy(profile, currentTicks);
      return { profile, metrics };
    });

    const pools = {
      RISE_FALL: freshFrames.filter(f => f.profile.contractType === 'RISE_FALL'),
      OVER_UNDER: freshFrames.filter(f => f.profile.contractType === 'OVER_UNDER'),
      TOUCH_NO_TOUCH: freshFrames.filter(f => f.profile.contractType === 'TOUCH_NO_TOUCH'),
      ACCUMULATOR: freshFrames.filter(f => f.profile.contractType === 'ACCUMULATOR')
    };

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
    
    const balancedPoolWinnerList: EvaluationFrame[] = [];
    
    if (sortedRiseFall.length > 0) balancedPoolWinnerList.push(...sortedRiseFall.slice(0, 2));
    if (sortedOverUnder.length > 0) balancedPoolWinnerList.push(...sortedOverUnder.slice(0, 2));
    if (sortedTouch.length > 0) balancedPoolWinnerList.push(...sortedTouch.slice(0, 2));
    if (sortedAccum.length > 0) balancedPoolWinnerList.push(...sortedAccum.slice(0, 2));

    const existingIds = new Set(balancedPoolWinnerList.map(f => f.profile.id));
    const remainderStrats = freshFrames.filter(f => !existingIds.has(f.profile.id));
    
    const combinedBalancedOutput = [
      ...balancedPoolWinnerList,
      ...remainderStrats.sort((a, b) => b.metrics.finalConfidence - a.metrics.finalConfidence)
    ];

    const globalSortedChallengers = [...freshFrames].sort((a, b) => {
      return (b.metrics.scannerScore + b.metrics.finalConfidence) - (a.metrics.scannerScore + a.metrics.finalConfidence);
    });
    const candidateWinner = globalSortedChallengers[0];

    const currentLeaderFrame = freshFrames.find(f => f.profile.id === this.currentTopStrategyId);
    
    const isLockExpired = (currentTime - this.lastLockTime) > this.lockDurationMs;
    const currentWinnerStillViable = currentLeaderFrame && currentLeaderFrame.metrics.finalConfidence >= 55;
    
    let isCurrentWinnerDethronedByPerformance = false;
    if (candidateWinner && currentLeaderFrame && candidateWinner.profile.id !== this.currentTopStrategyId) {
      const leaderWeight = currentLeaderFrame.metrics.scannerScore + currentLeaderFrame.metrics.finalConfidence;
      const candidateWeight = candidateWinner.metrics.scannerScore + candidateWinner.metrics.finalConfidence;
      
      if (candidateWeight > (leaderWeight + 8)) {
        isCurrentWinnerDethronedByPerformance = true;
      }
    }

    if (isLockExpired || !this.currentTopStrategyId || !currentWinnerStillViable || isCurrentWinnerDethronedByPerformance) {
      if (candidateWinner && candidateWinner.metrics.finalConfidence >= 55) {
        this.currentTopStrategyId = candidateWinner.profile.id;
        this.lastLockTime = currentTime;
      } else {
        this.currentTopStrategyId = null; 
      }
    }

    const finalizedFrames = combinedBalancedOutput.map(frame => {
      const isIsolatedWinner = this.currentTopStrategyId && (frame.profile.id === this.currentTopStrategyId);

      return {
        ...frame,
        metrics: {
          ...frame.metrics,
          status: isIsolatedWinner ? 'HIGH' : (frame.metrics.finalConfidence >= 62 ? 'MEDIUM' : 'LOW')
        }
      };
    });

    const rankedOutput = [...finalizedFrames].sort((a, b) => {
      const scoreA = a.metrics.status === 'HIGH' ? 2 : (a.metrics.status === 'MEDIUM' ? 1 : 0);
      const scoreB = b.metrics.status === 'HIGH' ? 2 : (b.metrics.status === 'MEDIUM' ? 1 : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.metrics.finalConfidence - a.metrics.finalConfidence;
    });

    // --- AUTOMATED TELEGRAM SIGNAL BROADCAST TRIGGER ENGINE ---
    const activeWinner = rankedOutput.find(f => f.metrics.status === 'HIGH');
    if (activeWinner && activeWinner.metrics.finalConfidence >= 75) { // Threshold lowered to 75
      broadcastSignalToTelegram({
        strategyName: activeWinner.profile.name,
        assetName: activeWinner.profile.targetSymbol.replace('R_', 'Volatility '),
        confidenceScore: activeWinner.metrics.finalConfidence,
        recommendedAction: activeWinner.metrics.direction
      });
    }

    this.lastEvaluatedFrames = rankedOutput;
    return rankedOutput;
  }
}
