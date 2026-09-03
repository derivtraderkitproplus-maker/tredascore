// scannerLogic.ts - PART 1: Broadcast Engine with Slip-Window Deflector & Target Safety Gates
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
  executionLatencyMs: number;
}

const TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_API_TOKEN"; 
const TELEGRAM_CHANNEL_ID = "@your_public_channel_username"; 

// --- REAL-MONEY INFRASTRUCTURE TARGET CONFIGURATIONS ---
export const ACCOUNT_LIMITS = {
  TAKE_PROFIT_TARGET: 150.00,       // Absolute profit threshold target in USD
  MAX_STOP_LOSS_LIMIT: -50.00,      // Absolute loss limit threshold in USD
  MAX_ALLOWED_SLIPPAGE_MS: 380,     // Slip-Window Deflector limit cutoff (380ms maximum routing window)
};

// --- RUNTIME STATE TRACKERS ---
let globalActiveHighStrategyId: string | null = null;
let currentRunProfitLoss = 0.00;     
let consecutiveLossCount = 0;        
let isEngineTerminated = false;      

export async function broadcastSignalToTelegram(signal: HighConfidenceSignal, strategyId: string) {
  // CRITICAL SAFETY 1: Complete pipeline shutdown verification check
  if (isEngineTerminated) {
    console.warn("🛑 Trade blocked: System run has been terminated by account safety rules.");
    return;
  }

  // DYNAMIC SLIP-WINDOW DEFLECTOR: Rejects the trade if broker-side pipeline lag is too high
  if (signal.executionLatencyMs > ACCOUNT_LIMITS.MAX_ALLOWED_SLIPPAGE_MS) {
    console.error(`⚠️ [SLIP DEFLECTOR] Trade blocked! Network latency (${signal.executionLatencyMs}ms) exceeds the safe execution window of ${ACCOUNT_LIMITS.MAX_ALLOWED_SLIPPAGE_MS}ms.`);
    return;
  }

  // CONFIDENCE FLOOR GATE: Must be strictly greater than 80%
  if (signal.confidenceScore <= 80) return;

  // GLOBAL SINGLE-HIGH MUTEX
  if (signal.riskTier === 'HIGH') {
    if (masterActiveHighStrategyId !== null && masterActiveHighStrategyId !== strategyId) return;
    masterActiveHighStrategyId = strategyId;
  }

  const webAppURL = "https://vercel.app";
  const messageText = encodeURIComponent(
    `🚀 *CRITICAL HIGH-CONFIDENCE REAL SIGNAL* 🚀\n\n` +
    `🤖 *Strategy:* ${signal.strategyName}\n` +
    `📊 *Asset Class:* ${signal.assetName}\n` +
    `🎯 *Verified Confidence:* ${signal.confidenceScore}%\n` +
    `⏱️ *Slip-Window Ping:* ${signal.executionLatencyMs}ms (SAFE)\n` +
    `📈 *Current Run PnL:* $${currentRunProfitLoss.toFixed(2)}\n\n` +
    `👉 [Deploy Live Trade Instantly](${webAppURL})`
  );

  const telegramApiEndPoint = `https://telegram.org{TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHANNEL_ID}&text=${messageText}&parse_mode=Markdown`;

  try {
    const response = await fetch(telegramApiEndPoint);
    if (!response.ok) console.error("❌ Telegram gateway rejected payload:", response.statusText);
  } catch (error) {
    console.error("🚨 Transmission pipeline network failure:", error);
  }
}

// --- ENGINE SYSTEM STATE SETTERS (Hook these up to your execution callbacks) ---
export function trackExecutedTradeResult(profitOrLoss: number) {
  currentRunProfitLoss += profitOrLoss;

  if (profitOrLoss < 0) {
    consecutiveLossCount++;
    console.warn(`⚠️ Loss recorded. Consecutive loss streak: ${consecutiveLossCount}/3`);
  } else {
    consecutiveLossCount = 0; // Reset streak instantly upon winning
  }

  // KILL-SWITCH A: 3 Consecutive Losses
  if (consecutiveLossCount >= 3) {
    isEngineTerminated = true;
    console.error("🚨 [CRITICAL KILL-SWITCH] 3 consecutive losses hit! Stopping the run immediately to protect capital.");
  }

  // KILL-SWITCH B: Profit/Loss Threshold targets hit
  if (currentRunProfitLoss >= ACCOUNT_LIMITS.TAKE_PROFIT_TARGET) {
    isEngineTerminated = true;
    console.log(`🎉 [TARGET ACHIEVED] Take Profit Target ($${ACCOUNT_LIMITS.TAKE_PROFIT_TARGET}) achieved! Stopping the run.`);
  } else if (currentRunProfitLoss <= ACCOUNT_LIMITS.MAX_STOP_LOSS_LIMIT) {
    isEngineTerminated = true;
    console.error(`🚨 [RISK CAP HIT] Max Stop Loss Limit ($${ACCOUNT_LIMITS.MAX_STOP_LOSS_LIMIT}) breached! Stopping the run.`);
  }
}

let masterActiveHighStrategyId: string | null = null;
export function resetMasterHighLock() { masterActiveHighStrategyId = null; }
export function checkEngineStatus(): boolean { return isEngineTerminated; }
// scannerLogic.ts - PART 2: Core Processing Engine and Safe Pre-Sort Demotion Matrix
import { broadcastSignalToTelegram, resetMasterHighLock, checkEngineStatus } from './Part1'; 

export class ScannerLogicEngine {
  private tickRegistry: Record<string, number[]> = {};
  private tickTimestamps: Record<string, number> = {};

  private currentTopStrategyId: string | null = null;
  private lastLockTime: number = 0;
  private lockDurationMs: number = 4000;       
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
    if (!activeFrame || checkEngineStatus()) return;
    
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
    // HARD ENFORCEMENT: Kill pipeline computation loop if target metrics or losses stop the run
    if (checkEngineStatus()) {
      return this.lastEvaluatedFrames.map(frame => ({
        ...frame,
        metrics: {
          ...frame.metrics,
          marketState: 'ENGINE_TERMINATED',
          direction: 'FLAT',
          scannerScore: 0,
          finalConfidence: 0,
          status: 'LOW'
        }
      }));
    }

    if (this.isEditingPaused && this.lastEvaluatedFrames.length > 0) {
      return this.lastEvaluatedFrames;
    }

    const currentTime = Date.now();

    // Data-stagnation protection check
    const timeSinceLastTick = currentTime - this.lastTickReceivedTimestamp;
    if (this.lastTickReceivedTimestamp > 0 && timeSinceLastTick > 2000) {
      resetMasterHighLock();
      return this.lastEvaluatedFrames.map(frame => ({
        ...frame,
        metrics: {
          ...frame.metrics,
          marketState: 'STALE_DATA',
          direction: 'FLAT',
          scannerScore: 0,
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

    // SYSTEM PRE-SORT: Isolate candidate rank order globally before parsing rendering status values
    const sortedGlobalChallengers = [...rawFrames].sort((a, b) => {
      return (b.metrics.scannerScore + b.metrics.finalConfidence) - (a.metrics.scannerScore + a.metrics.finalConfidence);
    });

    const candidateWinner = sortedGlobalChallengers[0]; 

    // DETECT PING AND CALCULATE ACTIVE DEVIATION WINDOW
    const assetToken = candidateWinner ? this.standardizeSymbol(candidateWinner.profile.targetSymbol) : '';
    const currentLatency = currentTime - (this.tickTimestamps[assetToken] || currentTime);

    // DEMOTION MATRIX MATRIX MAP LAYER
    const strictEnforcedFrames = rawFrames.map(frame => {
      const isAbsoluteGlobalWinner = candidateWinner && frame.profile.id === candidateWinner.profile.id;
      const passesConfidenceThreshold = frame.metrics.finalConfidence > 80;

      if (isAbsoluteGlobalWinner && passesConfidenceThreshold) {
        frame.metrics.status = 'HIGH';
      } else {
        frame.metrics.status = frame.metrics.finalConfidence >= 65 ? 'MEDIUM' : 'LOW';
      }
      return frame;
    });

    const currentLeaderFrame = strictEnforcedFrames.find(f => f.profile.id === this.currentTopStrategyId);
    const isLockExpired = (currentTime - this.lastLockTime) > this.lockDurationMs;
    const currentWinnerStillViable = currentLeaderFrame && currentLeaderFrame.metrics.finalConfidence >= 78;
    
    let isCurrentWinnerDethronedByPerformance = false;
    if (candidateWinner && currentLeaderFrame && candidateWinner.profile.id !== this.currentTopStrategyId) {
      const leaderWeight = currentLeaderFrame.metrics.scannerScore + currentLeaderFrame.metrics.finalConfidence;
      const candidateWeight = candidateWinner.metrics.scannerScore + candidateWinner.metrics.finalConfidence;
      if (candidateWeight > (leaderWeight + 20)) {
        isCurrentWinnerDethronedByPerformance = true;
      }
    }

    if (isLockExpired || !this.currentTopStrategyId || isCurrentWinnerDethronedByPerformance || !currentWinnerStillViable) {
      if (candidateWinner && candidateWinner.metrics.finalConfidence > 80) {
        this.currentTopStrategyId = candidateWinner.profile.id;
        this.lastLockTime = currentTime;
        
        broadcastSignalToTelegram({
          strategyName: candidateWinner.profile.name,
          assetName: candidateWinner.profile.targetSymbol.replace('R_', 'Volatility '),
          confidenceScore: candidateWinner.metrics.finalConfidence,
          recommendedAction: candidateWinner.metrics.direction,
          riskTier: 'HIGH',
          contractType: candidateWinner.profile.contractType,
          executionLatencyMs: currentLatency
        }, candidateWinner.profile.id);
      } else {
        resetMasterHighLock();
      }
    }

    const finalViewOutput = [...strictEnforcedFrames].sort((a, b) => b.metrics.finalConfidence - a.metrics.finalConfidence);
    this.lastEvaluatedFrames = finalViewOutput;
    return finalViewOutput;
  }
}
