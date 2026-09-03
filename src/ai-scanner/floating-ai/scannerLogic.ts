// scannerLogic.ts - PART 1: Guarded Broadcast Engine (>80% Confidence & Strict Single-HIGH Filter)
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
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH';
  contractType: string;
  executionLatencyMs?: number;
}

const TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_API_TOKEN"; 
const TELEGRAM_CHANNEL_ID = "@your_public_channel_username"; 

// Track the globally active HIGH execution state to prevent concurrent double-triggers
let activeHighStrategyId: string | null = null;
let lastBroadcastTimestamp = 0;
const COOLDOWN_PERIOD_MS = 30000; 

export async function broadcastSignalToTelegram(signal: HighConfidenceSignal, strategyId: string) {
  const currentTime = Date.now();

  // RULE 1: Strict confidence floor—must be strictly greater than 80%
  if (signal.confidenceScore <= 80) {
    return;
  }

  // RULE 2: Single "HIGH" constraint logic
  if (signal.riskTier === 'HIGH') {
    // If a different HIGH strategy is already running or locked, block this one completely
    if (activeHighStrategyId !== null && activeHighStrategyId !== strategyId) {
      console.warn(`[ROT SHIELD] Blocked HIGH strategy ${signal.strategyName}. Another HIGH instance (${activeHighStrategyId}) is currently active.`);
      return;
    }
    // Lock the token slot to this specific strategy ID
    activeHighStrategyId = strategyId;
  }

  // Rate limit check to safeguard exchange execution endpoints
  if (currentTime - lastBroadcastTimestamp < COOLDOWN_PERIOD_MS) return;

  lastBroadcastTimestamp = currentTime;
  const webAppURL = "https://vercel.app";
  
  const messageText = encodeURIComponent(
    `🚀 *CRITICAL HIGH-CONFIDENCE SIGNAL* 🚀\n\n` +
    `🤖 *Strategy:* ${signal.strategyName}\n` +
    `📊 *Asset Class:* ${signal.assetName}\n` +
    `🎯 *Verified Confidence:* ${signal.confidenceScore}% (>80% Rule)\n` +
    `⚡ *Direction:* ${signal.recommendedAction}\n` +
    `🚨 *Risk Tier Status:* ${signal.riskTier}\n\n` +
    `👉 [Deploy Live Trade Instantly](${webAppURL})`
  );

  const telegramApiEndPoint = `https://telegram.org{TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHANNEL_ID}&text=${messageText}&parse_mode=Markdown`;

  try {
    const response = await fetch(telegramApiEndPoint);
    if (!response.ok) console.error("❌ Telegram transmission rejected:", response.statusText);
  } catch (error) {
    console.error("🚨 Broadcast gateway failure:", error);
  }
}

/**
 * Resets the active single-HIGH lock state when a strategy is explicitly dethroned or turns stale.
 */
export function clearActiveHighLock(strategyId: string) {
  if (activeHighStrategyId === strategyId) {
    activeHighStrategyId = null;
  }
}
// scannerLogic.ts - PART 2: Core Scanner Pipeline and Single-HIGH Winner Enforcement Logic
import { broadcastSignalToTelegram, clearActiveHighLock } from './Part1'; 

export class ScannerLogicEngine {
  private tickRegistry: Record<string, number[]> = {};
  private tickTimestamps: Record<string, number> = {};

  private currentTopStrategyId: string | null = null;
  private lastLockTime: number = 0;
  private lockDurationMs: number = 2700;       
  private isEditingPaused: boolean = false;    
  private lastEvaluatedFrames: EvaluationFrame[] = [];
  private lastTickReceivedTimestamp: number = 0;

  private standardizeSymbol(s: string): string {
    const term = s.toUpperCase().trim();
    if (term.includes('100') || term === 'R_100') return 'R_100';
    if (term.includes('75') || term === 'R_75') return 'R_75';
    if (term.includes('50') || term === 'R_50') return 'R_50';
    if (term.includes('25') || term === 'R_25') return 'R_25';
    if (term.includes('10') || term === 'R_10') return 'R_10';
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

    if (this.tickRegistry[normalizedSymbol].length > 120) {
      this.tickRegistry[normalizedSymbol].shift();
    }
  }

  public setEditingState(isEditing: boolean): void {
    this.isEditingPaused = isEditing;
  }

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
      riskTier: activeFrame.metrics.status as 'LOW' | 'MEDIUM' | 'HIGH',
      contractType: activeFrame.profile.contractType,
      executionLatencyMs: currentLatency
    }, activeFrame.profile.id);
  }

  public runScannerPipeline(): EvaluationFrame[] {
    if (this.isEditingPaused && this.lastEvaluatedFrames.length > 0) {
      return this.lastEvaluatedFrames;
    }

    const currentTime = Date.now();

    // Stale data safety disconnect gate
    const timeSinceLastTick = currentTime - this.lastTickReceivedTimestamp;
    if (this.lastTickReceivedTimestamp > 0 && timeSinceLastTick > 2500) {
      if (this.currentTopStrategyId) {
        clearActiveHighLock(this.currentTopStrategyId);
      }
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
    
    let freshFrames: EvaluationFrame[] = STRATEGY_PROFILES.map(profile => {
      const targetToken = this.standardizeSymbol(profile.targetSymbol);
      const currentTicks = this.tickRegistry[targetToken] || [];
      const metrics = evaluateStrategy(profile, currentTicks);
      return { profile, metrics };
    });

    // SINGLE HIGH FILTER: Ensure only one strategy can carry a "HIGH" tier tag at any single moment
    let highRiskAssigned = false;
    freshFrames = freshFrames.map(frame => {
      if (frame.metrics.status === 'HIGH') {
        if (highRiskAssigned) {
          // Downgrade any subsequent conflicting "HIGH" statuses to MEDIUM to preserve matrix balance
          return {
            ...frame,
            metrics: { ...frame.metrics, status: 'MEDIUM' }
          };
        }
        highRiskAssigned = true;
      }
      return frame;
    });

    const globalSortedChallengers = [...freshFrames].sort((a, b) => {
      return (b.metrics.scannerScore + b.metrics.finalConfidence) - (a.metrics.scannerScore + a.metrics.finalConfidence);
    });
    
    const candidateWinner = globalSortedChallengers[0];
    const currentLeaderFrame = freshFrames.find(f => f.profile.id === this.currentTopStrategyId);
    
    const isLockExpired = (currentTime - this.lastLockTime) > this.lockDurationMs;
    const currentWinnerStillViable = currentLeaderFrame && currentLeaderFrame.metrics.finalConfidence >= 65;
    
    let isCurrentWinnerDethronedByPerformance = false;
    if (candidateWinner && currentLeaderFrame && candidateWinner.profile.id !== this.currentTopStrategyId) {
      const leaderWeight = currentLeaderFrame.metrics.scannerScore + currentLeaderFrame.metrics.finalConfidence;
      const candidateWeight = candidateWinner.metrics.scannerScore + candidateWinner.metrics.finalConfidence;
      if (candidateWeight > (leaderWeight + 12)) {
        isCurrentWinnerDethronedByPerformance = true;
      }
    }

    if (isLockExpired || !this.currentTopStrategyId || isCurrentWinnerDethronedByPerformance || !currentWinnerStillViable) {
      if (candidateWinner) {
        // Clear lock on the previous top item if it gets knocked down
        if (this.currentTopStrategyId && this.currentTopStrategyId !== candidateWinner.profile.id) {
          clearActiveHighLock(this.currentTopStrategyId);
        }

        this.currentTopStrategyId = candidateWinner.profile.id;
        this.lastLockTime = currentTime;
        
        const token = this.standardizeSymbol(candidateWinner.profile.targetSymbol);
        const latency = currentTime - (this.tickTimestamps[token] || currentTime);
        
        broadcastSignalToTelegram({
          strategyName: candidateWinner.profile.name,
          assetName: candidateWinner.profile.targetSymbol.replace('R_', 'Volatility '),
          confidenceScore: candidateWinner.metrics.finalConfidence,
          recommendedAction: candidateWinner.metrics.direction,
          riskTier: candidateWinner.metrics.status as any,
          contractType: candidateWinner.profile.contractType,
          executionLatencyMs: latency
        }, candidateWinner.profile.id);
      }
    }

    // Sort output view for UI rendering maps
    const combinedBalancedOutput = [...freshFrames].sort((a, b) => b.metrics.finalConfidence - a.metrics.finalConfidence);
    this.lastEvaluatedFrames = combinedBalancedOutput;
    return combinedBalancedOutput;
  }
}
