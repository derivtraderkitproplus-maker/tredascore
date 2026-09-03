// scannerLogic.ts - PART 1: Server-Safe LocalStorage Circuit-Breaker Engine

export interface EvaluationFrame {
  profile: any;
  metrics: any;
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

const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || "YOUR_TELEGRAM_BOT_API_TOKEN"; 
const TELEGRAM_CHANNEL_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_ID || "@your_public_channel_username"; 

export const ACCOUNT_LIMITS = {
  TAKE_PROFIT_TARGET: 150.00,       
  MAX_STOP_LOSS_LIMIT: -50.00,      
  MAX_ALLOWED_SLIPPAGE_MS: 380      
};

const STATE_KEYS = {
  PnL: 'EDASCORE_CURRENT_RUN_PNL',
  LOSS_STREAK: 'EDASCORE_CONSECUTIVE_LOSS_COUNT',
  KILL_SWITCH: 'EDASCORE_SYSTEM_RUN_TERMINATED'
};

/**
 * FIXED: Secure environment check ensures Vercel cloud rendering engines 
 * skip local browser storage access during structural initialization loops.
 */
function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getPersistedState() {
  if (!isClient()) {
    return { pnl: 0, losses: 0, terminated: false };
  }
  return {
    pnl: parseFloat(localStorage.getItem(STATE_KEYS.PnL) || '0.00'),
    losses: parseInt(localStorage.getItem(STATE_KEYS.LOSS_STREAK) || '0', 10),
    terminated: localStorage.getItem(STATE_KEYS.KILL_SWITCH) === 'true'
  };
}

export function checkEngineStatus(): boolean {
  return getPersistedState().terminated;
}

let masterActiveHighStrategyId: string | null = null;

export async function broadcastSignalToTelegram(signal: HighConfidenceSignal, strategyId: string) {
  if (checkEngineStatus()) {
    console.error("🛑 [SAFETY SHIELD] Signal broadcast dropped. Circuit-breaker is TRIPPED.");
    return;
  }

  if (signal.executionLatencyMs > ACCOUNT_LIMITS.MAX_ALLOWED_SLIPPAGE_MS) {
    console.warn(`⚠️ [SLIP DEFLECTOR] Trade rejected: Latency (${signal.executionLatencyMs}ms) exceeds bounds.`);
    return;
  }

  if (signal.confidenceScore <= 80) return;

  if (signal.riskTier === 'HIGH') {
    if (masterActiveHighStrategyId !== null && masterActiveHighStrategyId !== strategyId) return;
    masterActiveHighStrategyId = strategyId;
  }

  const activeState = getPersistedState();
  const webAppURL = "https://vercel.app";
  const messageText = encodeURIComponent(
    `🚀 *CRITICAL HIGH-CONFIDENCE REAL SIGNAL* 🚀\n\n` +
    `🤖 *Strategy:* ${signal.strategyName}\n` +
    `📊 *Asset Class:* ${signal.assetName}\n` +
    `🎯 *Verified Confidence:* ${signal.confidenceScore}%\n` +
    `⏱️ *Slip-Window Ping:* ${signal.executionLatencyMs}ms\n` +
    `📈 *Session Profit/Loss:* $${activeState.pnl.toFixed(2)}\n\n` +
    `👉 [Deploy Live Trade Instantly](${webAppURL})`
  );

  const telegramApiEndPoint = `https://telegram.org{TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHANNEL_ID}&text=${messageText}&parse_mode=Markdown`;

  try {
    const response = await fetch(telegramApiEndPoint);
    if (!response.ok) console.error("❌ Telegram gateway rejected payload:", response.statusText);
  } catch (error) {
    console.error("🚨 Transmission network failure:", error);
  }
}

export function trackExecutedTradeResult(profitOrLoss: number) {
  if (!isClient()) return;
  
  const state = getPersistedState();
  
  state.pnl += profitOrLoss;
  if (profitOrLoss < 0) {
    state.losses += 1;
    console.warn(`⚠️ Loss recorded. Streak marker: ${state.losses}/3`);
  } else {
    state.losses = 0; 
  }

  if (state.losses >= 3) {
    state.terminated = true;
    console.error("🚨 [CRITICAL SHUTDOWN] 3 consecutive losses hit!");
  } else if (state.pnl >= ACCOUNT_LIMITS.TAKE_PROFIT_TARGET) {
    state.terminated = true;
    console.log(`🎉 [TARGET ATTAINED] Profit Target of $${ACCOUNT_LIMITS.TAKE_PROFIT_TARGET} hit.`);
  } else if (state.pnl <= ACCOUNT_LIMITS.MAX_STOP_LOSS_LIMIT) {
    state.terminated = true;
    console.error(`🚨 [RISK BREACH] Stop Loss of $${ACCOUNT_LIMITS.MAX_STOP_LOSS_LIMIT} hit.`);
  }

  localStorage.setItem(STATE_KEYS.PnL, state.pnl.toString());
  localStorage.setItem(STATE_KEYS.LOSS_STREAK, state.losses.toString());
  localStorage.setItem(STATE_KEYS.KILL_SWITCH, state.terminated.toString());

  if (state.terminated) {
    const alertsText = encodeURIComponent(`🛑 *AUTOMATED BOT RUN TERMINATED* 🛑\n\nReason: Account thresholds reached or 3 consecutive losses hit. Live execution channels have been disabled.`);
    fetch(`https://telegram.org{TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHANNEL_ID}&text=${alertsText}&parse_mode=Markdown`).catch(() => {});
  }
}

export function resetAccountSessionRun() {
  if (!isClient()) return;
  localStorage.removeItem(STATE_KEYS.PnL);
  localStorage.removeItem(STATE_KEYS.LOSS_STREAK);
  localStorage.removeItem(STATE_KEYS.KILL_SWITCH);
  console.log("🔄 Session states wiped cleanly.");
}

export function resetMasterHighLock() { masterActiveHighStrategyId = null; }
// scannerLogic.ts - PART 2: Safe Core Scanner Pipeline with Embedded Hydration Guardrails
import { broadcastSignalToTelegram, resetMasterHighLock, checkEngineStatus } from './Part1'; 
import { STRATEGY_PROFILES, evaluateStrategy, StrategyResult, StrategyProfile } from './strategies';

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
    // If circuit breaker state checks true on client side, gracefully update view structures
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

    const sortedGlobalChallengers = [...rawFrames].sort((a, b) => {
      return (b.metrics.scannerScore + b.metrics.finalConfidence) - (a.metrics.scannerScore + a.metrics.finalConfidence);
    });

    const candidateWinner = sortedGlobalChallengers; 

    const assetToken = candidateWinner ? this.standardizeSymbol(candidateWinner.profile.targetSymbol) : '';
    const currentLatency = currentTime - (this.tickTimestamps[assetToken] || currentTime);

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
