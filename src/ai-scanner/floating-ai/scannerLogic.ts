// scannerLogic.ts - PART 1: Guarded Broadcast Engine & Global Mutex Lock Gate
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

// MASTER SYSTEM LOGIC SHIELD: Forces an absolute single slot registry across the entire runtime execution
let globalActiveHighStrategyId: string | null = null;
let lastBroadcastTimestamp = 0;
const GLOBAL_COOLDOWN_MS = 30000; 

export async function broadcastSignalToTelegram(signal: HighConfidenceSignal, strategyId: string) {
  const currentTime = Date.now();

  // RULE 1: Direct confidence floor check — must strictly exceed 80%
  if (signal.confidenceScore <= 80) {
    return;
  }

  // RULE 2: Global single HIGH reservation enforce lock
  if (signal.riskTier === 'HIGH') {
    if (globalActiveHighStrategyId !== null && globalActiveHighStrategyId !== strategyId) {
      // Hard block: Drops concurrent setups instantly if another script occupies the high seat
      return;
    }
    globalActiveHighStrategyId = strategyId;
  }

  // Prevent rate-limiting endpoint overruns 
  if (currentTime - lastBroadcastTimestamp < GLOBAL_COOLDOWN_MS) return;

  lastBroadcastTimestamp = currentTime;
  const webAppURL = "https://vercel.app";
  
  const messageText = encodeURIComponent(
    `🚀 *CRITICAL HIGH-CONFIDENCE SIGNAL* 🚀\n\n` +
    `🤖 *Strategy:* ${signal.strategyName}\n` +
    `📊 *Asset Class:* ${signal.assetName}\n` +
    `🎯 *Verified Confidence:* ${signal.confidenceScore}% (>80% Enforced)\n` +
    `⚡ *Direction:* ${signal.recommendedAction}\n` +
    `🚨 *Risk Tier Status:* ${signal.riskTier}\n\n` +
    `👉 [Deploy Live Trade Instantly](${webAppURL})`
  );

  const telegramApiEndPoint = `https://telegram.org{TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHANNEL_ID}&text=${messageText}&parse_mode=Markdown`;

  try {
    const response = await fetch(telegramApiEndPoint);
    if (!response.ok) console.error("❌ Telegram gateway rejected payload:", response.statusText);
  } catch (error) {
    console.error("🚨 Transmission pipe exception:", error);
  }
}

/**
 * System-wide hook to release the high seat when a strategy decays or drops rank position
 */
export function setGlobalHighLock(strategyId: string | null) {
  globalActiveHighStrategyId = strategyId;
}

export function getGlobalHighLock(): string | null {
  return globalActiveHighStrategyId;
}
// scannerLogic.ts - PART 2: Core Scanner Pipeline and Global HIGH State Demotion Map
import { broadcastSignalToTelegram, setGlobalHighLock, getGlobalHighLock } from './Part1'; 

export class ScannerLogicEngine {
  private tickRegistry: Record<string, number[]> = {};
  private tickTimestamps: Record<string, number> = {};

  private currentTopStrategyId: string | null = null;
  private lastLockTime: number = 0;
  private lockDurationMs: number = 3500;       // Extended lock duration from 2700ms to 3500ms to calm down quick flickering
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

    // Catch stagnant WebSocket connections quickly
    const timeSinceLastTick = currentTime - this.lastTickReceivedTimestamp;
    if (this.lastTickReceivedTimestamp > 0 && timeSinceLastTick > 2500) {
      setGlobalHighLock(null);
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
    
    const rawFrames: EvaluationFrame[] = STRATEGY_PROFILES.map(profile => {
      const targetToken = this.standardizeSymbol(profile.targetSymbol);
      const currentTicks = this.tickRegistry[targetToken] || [];
      const metrics = evaluateStrategy(profile, currentTicks);
      return { profile, metrics };
    });

    // 1. Sort the entire matrix system-wide by pure mathematical weight first
    const sortedGlobalChallengers = [...rawFrames].sort((a, b) => {
      return (b.metrics.scannerScore + b.metrics.finalConfidence) - (a.metrics.scannerScore + a.metrics.finalConfidence);
    });

    // 2. Identify the single ultimate candidate winner strategy object
    const candidateWinner = sortedGlobalChallengers[0]; 
    
    // 3. HARD ENFORCEMENT FILTER: Clear all secondary HIGH tiers. Force a single high layout item.
    const strictEnforcedFrames = rawFrames.map(frame => {
      // If this item is NOT the absolute current candidate winner, it is strictly forbidden from claiming HIGH status
      if (candidateWinner && frame.profile.id === candidateWinner.profile.id) {
        // Enforce the text constraint logic requirement (> 80% check)
        if (frame.metrics.finalConfidence > 80) {
          frame.metrics.status = 'HIGH';
        } else {
          frame.metrics.status = 'MEDIUM'; // Drop back down if it cannot beat the threshold check
        }
      } else {
        // Forcefully demote status parameters for every single competitor row to prevent concurrent flashing
        if (frame.metrics.status === 'HIGH') {
          frame.metrics.status = 'MEDIUM';
        }
      }
      return frame;
    });

    const currentLeaderFrame = strictEnforcedFrames.find(f => f.profile.id === this.currentTopStrategyId);
    const isLockExpired = (currentTime - this.lastLockTime) > this.lockDurationMs;
    const currentWinnerStillViable = currentLeaderFrame && currentLeaderFrame.metrics.finalConfidence >= 75;
    
    let isCurrentWinnerDethronedByPerformance = false;
    if (candidateWinner && currentLeaderFrame && candidateWinner.profile.id !== this.currentTopStrategyId) {
      const leaderWeight = currentLeaderFrame.metrics.scannerScore + currentLeaderFrame.metrics.finalConfidence;
      const candidateWeight = candidateWinner.metrics.scannerScore + candidateWinner.metrics.finalConfidence;
      // Increased performance buffer wall gap to +18 to freeze rapid chart jumping anomalies
      if (candidateWeight > (leaderWeight + 18)) {
        isCurrentWinnerDethronedByPerformance = true;
      }
    }

    if (isLockExpired || !this.currentTopStrategyId || isCurrentWinnerDethronedByPerformance || !currentWinnerStillViable) {
      if (candidateWinner && candidateWinner.metrics.finalConfidence > 80) {
        this.currentTopStrategyId = candidateWinner.profile.id;
        this.lastLockTime = currentTime;
        setGlobalHighLock(candidateWinner.profile.id);
        
        const token = this.standardizeSymbol(candidateWinner.profile.targetSymbol);
        const latency = currentTime - (this.tickTimestamps[token] || currentTime);
        
        broadcastSignalToTelegram({
          strategyName: candidateWinner.profile.name,
          assetName: candidateWinner.profile.targetSymbol.replace('R_', 'Volatility '),
          confidenceScore: candidateWinner.metrics.finalConfidence,
          recommendedAction: candidateWinner.metrics.direction,
          riskTier: 'HIGH', // Enforced winner tier state
          contractType: candidateWinner.profile.contractType,
          executionLatencyMs: latency
        }, candidateWinner.profile.id);
      } else {
        // Clear active seat locks if no strategy scores clear the >80% condition gate
        setGlobalHighLock(null);
      }
    }

    // Sort final downstream mapped records by confidence metrics cleanly for UI table lists
    const finalViewOutput = [...strictEnforcedFrames].sort((a, b) => b.metrics.finalConfidence - a.metrics.finalConfidence);
    this.lastEvaluatedFrames = finalViewOutput;
    return finalViewOutput;
  }
}
