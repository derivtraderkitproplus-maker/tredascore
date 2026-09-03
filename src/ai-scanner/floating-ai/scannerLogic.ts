// scannerLogic.ts - PART 1: Enhanced Safe-Execution Engine, Configurations, and Guarded Broadcast Engine
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
  executionLatencyMs?: number;
}

// --- TELEGRAM CONFIGURATIONS ---
const TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_API_TOKEN"; 
const TELEGRAM_CHANNEL_ID = "@your_public_channel_username"; 

// --- REAL-MONEY SAFETY CONFIGURATIONS ---
const ENGINE_SAFETY_CONFIG = {
  MIN_LIVE_CONFIDENCE: 82,          // Raised from 75% to filter out market noise on ROT accounts
  MAX_LATENCY_THRESHOLD_MS: 1200,   // Strict watchdog boundary to prevent lagging executions
  COOLDOWN_PERIOD_MS: 60000,        // 1-minute system lock after signal or error state
};

// Global rate-limiting safety lock state
let lastBroadcastTimestamp = 0;

/**
 * Fires an automated real-money signal alert with embedded execution latency safety checks.
 * Prevents toxic front-running and slippage entries by enforcing strict validation gates.
 */
export async function broadcastSignalToTelegram(signal: HighConfidenceSignal) {
  const currentTime = Date.now();
  
  // REAL-MONEY GUARD 1: Prevent rapid-fire loop execution and broker rate-limiting
  if (currentTime - lastBroadcastTimestamp < ENGINE_SAFETY_CONFIG.COOLDOWN_PERIOD_MS) {
    console.warn("⚠️ Signal blocked: Cooldown period active to protect live capital.");
    return;
  }

  // REAL-MONEY GUARD 2: Reject low-probability or high-noise setups
  if (signal.confidenceScore < ENGINE_SAFETY_CONFIG.MIN_LIVE_CONFIDENCE) {
    console.log(`ℹ️ Signal skipped: Confidence (${signal.confidenceScore}%) below safe ROT threshold (${ENGINE_SAFETY_CONFIG.MIN_LIVE_CONFIDENCE}%).`);
    return;
  }

  // REAL-MONEY GUARD 3: Drop executions if network latency compromises entry timing
  if (signal.executionLatencyMs && signal.executionLatencyMs > ENGINE_SAFETY_CONFIG.MAX_LATENCY_THRESHOLD_MS) {
    console.error(`🚨 Execution aborted: Network latency (${signal.executionLatencyMs}ms) exceeds safety bounds.`);
    return;
  }

  lastBroadcastTimestamp = currentTime;
  const webAppURL = "https://vercel.app";
  
  const messageText = encodeURIComponent(
    `🚀 *STRENGTHENED REAL-MONEY SIGNAL DETECTED* 🚀\n\n` +
    `🤖 *Strategy:* ${signal.strategyName}\n` +
    `📊 *Asset Class:* ${signal.assetName}\n` +
    `🎯 *Verified Confidence:* ${signal.confidenceScore}%\n` +
    `⚡ *Direction:* ${signal.recommendedAction === 'DOWN' ? 'PUT 🔴 (FALL)' : 'CALL 🟢 (RISE)'}\n` +
    `⏱️ *Engine Latency:* ${signal.executionLatencyMs || 0}ms\n\n` +
    `⚠️ *ROT Rule:* Ensure a minimum duration of 5 Ticks / 1 Min to absorb market slippage.\n\n` +
    `👉 [Deploy Auto-Trader Safely](${webAppURL})`
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
// scannerLogic.ts - PART 2: Reinforced Core Processing Engine, Slippage Shields, and Safe Selection Pipeline

export class ScannerLogicEngine {
  private tickRegistry: Record<string, number[]> = {};
  private tickTimestamps: Record<string, number> = {};

  // --- STABILITY & SINGLE-WINNER LOCK STATE ---
  private currentTopStrategyId: string | null = null;
  private lastLockTime: number = 0;
  private lockDurationMs: number = 2700;       
  private isEditingPaused: boolean = false;    
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
    const currentTime = Date.now();

    if (!this.tickRegistry[normalizedSymbol]) {
      this.tickRegistry[normalizedSymbol] = [];
    }
    
    this.tickRegistry[normalizedSymbol].push(price);
    this.lastTickReceivedTimestamp = currentTime;
    this.tickTimestamps[normalizedSymbol] = currentTime;

    // Maintain 120-period depth for solid statistical calculation grounding
    if (this.tickRegistry[normalizedSymbol].length > 120) {
      this.tickRegistry[normalizedSymbol].shift();
    }
  }

  public setEditingState(isEditing: boolean): void {
    this.isEditingPaused = isEditing;
  }

  /**
   * ADMIN MANUAL OVERRIDE: Manually forces broadcast after resolving latency verification filters
   */
  public forceManualTelegramBroadcast(activeFrame: EvaluationFrame): void {
    if (!activeFrame) return;
    
    const assetToken = this.standardizeSymbol(activeFrame.profile.targetSymbol);
    const lastTickTime = this.tickTimestamps[assetToken] || Date.now();
    const currentLatency = Date.now() - lastTickTime;

    broadcastSignalToTelegram({
      strategyName: activeFrame.profile.name,
      assetName: activeFrame.profile.targetSymbol.replace('R_', 'Volatility '),
      confidenceScore: activeFrame.metrics.finalConfidence,
      recommendedAction: activeFrame.metrics.direction,
      executionLatencyMs: currentLatency
    });
    
    console.log(`⚡ Admin Override: Manually pushed ${activeFrame.profile.name} to channel feed.`);
  }

  public runScannerPipeline(): EvaluationFrame[] {
    if (this.isEditingPaused && this.lastEvaluatedFrames.length > 0) {
      return this.lastEvaluatedFrames;
    }

    const currentTime = Date.now();

    // REAL-MONEY WATCHDOG SHIELD: Reduced threshold from 3500ms to 1200ms to instantly isolate lag
    const timeSinceLastTick = currentTime - this.lastTickReceivedTimestamp;
    if (this.lastTickReceivedTimestamp > 0 && timeSinceLastTick > 1200) {
      console.warn("⚠️ CRITICAL: Stale data feed or high network latency detected. Invalidating scores.");
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
    const currentWinnerStillViable = currentLeaderFrame && currentLeaderFrame.metrics.finalConfidence >= 65; // Raised from 55 to prevent erratic switching
    
    let isCurrentWinnerDethronedByPerformance = false;
    if (candidateWinner && currentLeaderFrame && candidateWinner.profile.id !== this.currentTopStrategyId) {
      const leaderWeight = currentLeaderFrame.metrics.scannerScore + currentLeaderFrame.metrics.finalConfidence;
      const candidateWeight = candidateWinner.metrics.scannerScore + candidateWinner.metrics.finalConfidence;
      
      // Increased buffer requirement to prevent rapid switching during high real-time volatility
      if (candidateWeight > (leaderWeight + 15)) {
        isCurrentWinnerDethronedByPerformance = true;
      }
    }

    if (isLockExpired || !this.currentTopStrategyId || isCurrentWinnerDethronedByPerformance || !currentWinnerStillViable) {
      if (candidateWinner && candidateWinner.metrics.finalConfidence >= 65) {
        this.currentTopStrategyId = candidateWinner.profile.id;
        this.lastLockTime = currentTime;
        
        const token = this.standardizeSymbol(candidateWinner.profile.targetSymbol);
        const latency = currentTime - (this.tickTimestamps[token] || currentTime);
        
        // Auto-trigger secure execution broadcast when a strong winner stabilizes
        broadcastSignalToTelegram({
          strategyName: candidateWinner.profile.name,
          assetName: candidateWinner.profile.targetSymbol.replace('R_', 'Volatility '),
          confidenceScore: candidateWinner.metrics.finalConfidence,
          recommendedAction: candidateWinner.metrics.direction,
          executionLatencyMs: latency
        });
      }
    }

    this.lastEvaluatedFrames = combinedBalancedOutput;
    return combinedBalancedOutput;
  }
}
