// scannerLogic.ts - PART 1: Guarded Broadcast Engine & Global Mutual Exclusion Gate
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

let masterActiveHighStrategyId: string | null = null;
let lastBroadcastTimestamp = 0;
const GLOBAL_COOLDOWN_MS = 45000; // Increased cooldown to prevent quick consecutive alerts

export async function broadcastSignalToTelegram(signal: HighConfidenceSignal, strategyId: string) {
  const currentTime = Date.now();

  // RULE 1: Direct confidence floor gate—must be strictly greater than 80%
  if (signal.confidenceScore <= 80) {
    return;
  }

  // RULE 2: Strict single-HIGH constraint reservation check
  if (signal.riskTier === 'HIGH') {
    if (masterActiveHighStrategyId !== null && masterActiveHighStrategyId !== strategyId) {
      return; // Absolute drop if another strategy holds the global high reservation
    }
    masterActiveHighStrategyId = strategyId;
  }

  if (currentTime - lastBroadcastTimestamp < GLOBAL_COOLDOWN_MS) return;

  lastBroadcastTimestamp = currentTime;
  const webAppURL = "https://vercel.app";
  
  const messageText = encodeURIComponent(
    `🚀 *CRITICAL HIGH-CONFIDENCE REAL SIGNAL* 🚀\n\n` +
    `🤖 *Strategy:* ${signal.strategyName}\n` +
    `📊 *Asset Class:* ${signal.assetName}\n` +
    `🎯 *Verified Confidence:* ${signal.confidenceScore}% (>80% Rule Enforced)\n` +
    `⚡ *Direction:* ${signal.recommendedAction}\n` +
    `🚨 *Risk Status:* ${signal.riskTier}\n\n` +
    `👉 [Deploy Live Trade Instantly](${webAppURL})`
  );

  const telegramApiEndPoint = `https://telegram.org{TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHANNEL_ID}&text=${messageText}&parse_mode=Markdown`;

  try {
    const response = await fetch(telegramApiEndPoint);
    if (!response.ok) console.error("❌ Telegram gateway link rejected payload:", response.statusText);
  } catch (error) {
    console.error("🚨 Transmission pipeline network failure:", error);
  }
}

export function resetMasterHighLock() {
  masterActiveHighStrategyId = null;
}
// scannerLogic.ts - PART 2: Core Scanner Pipeline and Global Pre-Sort Winner Demotion Matrix
import { broadcastSignalToTelegram, resetMasterHighLock } from './Part1'; 

export class ScannerLogicEngine {
  private tickRegistry: Record<string, number[]> = {};
  private tickTimestamps: Record<string, number> = {};

  private currentTopStrategyId: string | null = null;
  private lastLockTime: number = 0;
  private lockDurationMs: number = 5000;       // Extended hold time to 5 seconds to eliminate quick UI flickering
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
      riskTier: activeFrame.metrics.status as any,
      contractType: activeFrame.profile.contractType,
      executionLatencyMs: currentLatency
    }, activeFrame.profile.id);
  }

  public runScannerPipeline(): EvaluationFrame[] {
    if (this.isEditingPaused && this.lastEvaluatedFrames.length > 0) {
      return this.lastEvaluatedFrames;
    }

    const currentTime = Date.now();

    // Sudden WebSocket disconnection watchdog fallback 
    const timeSinceLastTick = currentTime - this.lastTickReceivedTimestamp;
    if (this.lastTickReceivedTimestamp > 0 && timeSinceLastTick > 2500) {
      resetMasterHighLock();
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
    
    // 1. Calculate metrics for all active rows
    const rawFrames: EvaluationFrame[] = STRATEGY_PROFILES.map(profile => {
      const targetToken = this.standardizeSymbol(profile.targetSymbol);
      const currentTicks = this.tickRegistry[targetToken] || [];
      const metrics = evaluateStrategy(profile, currentTicks);
      return { profile, metrics };
    });

    // 2. SYSTEM-WIDE PRE-SORT: Sort globally by performance weights *before* evaluating statuses
    const sortedGlobalChallengers = [...rawFrames].sort((a, b) => {
      return (b.metrics.scannerScore + b.metrics.finalConfidence) - (a.metrics.scannerScore + a.metrics.finalConfidence);
    });

    // Extract the strict single candidate winner at index position [0]
    const candidateWinner = sortedGlobalChallengers[0]; 

    // 3. HARD ENFORCEMENT LOOP: Force single-winner rules and strip secondary tags
    const strictEnforcedFrames = rawFrames.map(frame => {
      const isAbsoluteGlobalWinner = candidateWinner && frame.profile.id === candidateWinner.profile.id;
      const passesConfidenceThreshold = frame.metrics.finalConfidence > 80;

      if (isAbsoluteGlobalWinner && passesConfidenceThreshold) {
        frame.metrics.status = 'HIGH';
      } else {
        // Absolute demotion: If it isn't the clear global winner over 80%, it cannot be HIGH
        frame.metrics.status = frame.metrics.finalConfidence >= 65 ? 'MEDIUM' : 'LOW';
      }
      return frame;
    });

    const currentLeaderFrame = strictEnforcedFrames.find(f => f.profile.id === this.currentTopStrategyId);
    const isLockExpired = (currentTime - this.lastLockTime) > this.lockDurationMs;
    
    // Require a 78% baseline to keep holding the top locked display position
    const currentWinnerStillViable = currentLeaderFrame && currentLeaderFrame.metrics.finalConfidence >= 78;
    
    let isCurrentWinnerDethronedByPerformance = false;
    if (candidateWinner && currentLeaderFrame && candidateWinner.profile.id !== this.currentTopStrategyId) {
      const leaderWeight = currentLeaderFrame.metrics.scannerScore + currentLeaderFrame.metrics.finalConfidence;
      const candidateWeight = candidateWinner.metrics.scannerScore + candidateWinner.metrics.finalConfidence;
      
      // Increased buffer gap to +22 points to absorb quick multi-asset tick spikes completely
      if (candidateWeight > (leaderWeight + 22)) {
        isCurrentWinnerDethronedByPerformance = true;
      }
    }

    if (isLockExpired || !this.currentTopStrategyId || isCurrentWinnerDethronedByPerformance || !currentWinnerStillViable) {
      if (candidateWinner && candidateWinner.metrics.finalConfidence > 80) {
        this.currentTopStrategyId = candidateWinner.profile.id;
        this.lastLockTime = currentTime;
        
        const token = this.standardizeSymbol(candidateWinner.profile.targetSymbol);
        const latency = currentTime - (this.tickTimestamps[token] || currentTime);
        
        broadcastSignalToTelegram({
          strategyName: candidateWinner.profile.name,
          assetName: candidateWinner.profile.targetSymbol.replace('R_', 'Volatility '),
          confidenceScore: candidateWinner.metrics.finalConfidence,
          recommendedAction: candidateWinner.metrics.direction,
          riskTier: 'HIGH',
          contractType: candidateWinner.profile.contractType,
          executionLatencyMs: latency
        }, candidateWinner.profile.id);
      } else {
        resetMasterHighLock();
      }
    }

    // Sort final view structures cleanly by highest confidence to keep your layout lists aligned
    const finalViewOutput = [...strictEnforcedFrames].sort((a, b) => b.metrics.finalConfidence - a.metrics.finalConfidence);
    this.lastEvaluatedFrames = finalViewOutput;
    return finalViewOutput;
  }
}
