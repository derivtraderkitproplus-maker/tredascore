// scannerLogic.ts - PART 1: Core Engine Declarations & Client-Safe Gateways

export interface EvaluationFrame {
  profile: {
    id: string;
    name: string;
    targetSymbol: string;
    contractType: string;
  };
  metrics: {
    finalConfidence: number;
    scannerScore: number;
    direction: string;
    status: string;
    marketState?: string;
    marketCompatibility?: number;
  };
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

// Safe runtime utility function
function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function checkEngineStatus(): boolean {
  if (!isClient()) return false;
  return localStorage.getItem(STATE_KEYS.KILL_SWITCH) === 'true';
}

let masterActiveHighStrategyId: string | null = null;

export async function broadcastSignalToTelegram(signal: HighConfidenceSignal, strategyId: string) {
  if (checkEngineStatus()) return;
  if (signal.executionLatencyMs > ACCOUNT_LIMITS.MAX_ALLOWED_SLIPPAGE_MS) return;
  if (signal.confidenceScore <= 80) return;

  if (signal.riskTier === 'HIGH') {
    if (masterActiveHighStrategyId !== null && masterActiveHighStrategyId !== strategyId) return;
    masterActiveHighStrategyId = strategyId;
  }

  // Safe tracking read block
  const currentPnl = isClient() ? parseFloat(localStorage.getItem(STATE_KEYS.PnL) || '0.00') : 0.00;
  const webAppURL = "https://vercel.app";
  const messageText = encodeURIComponent(
    `🚀 *CRITICAL HIGH-CONFIDENCE REAL SIGNAL* 🚀\n\n` +
    `🤖 *Strategy:* ${signal.strategyName}\n` +
    `📊 *Asset Class:* ${signal.assetName}\n` +
    `🎯 *Verified Confidence:* ${signal.confidenceScore}%\n` +
    `⏱️ *Slip-Window Ping:* ${signal.executionLatencyMs}ms\n` +
    `📈 *Session Profit/Loss:* $${currentPnl.toFixed(2)}\n\n` +
    `👉 [Deploy Live Trade Instantly](${webAppURL})`
  );

  const telegramApiEndPoint = `https://telegram.org{TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHANNEL_ID}&text=${messageText}&parse_mode=Markdown`;

  try {
    const response = await fetch(telegramApiEndPoint);
    if (!response.ok) console.error("❌ Telegram gateway rejected execution payload:", response.statusText);
  } catch (error) {
    console.error("🚨 Transmission pipe pipeline network failure:", error);
  }
}

export function trackExecutedTradeResult(profitOrLoss: number) {
  if (!isClient()) return;
  
  let currentPnl = parseFloat(localStorage.getItem(STATE_KEYS.PnL) || '0.00');
  let lossStreak = parseInt(localStorage.getItem(STATE_KEYS.LOSS_STREAK) || '0', 10);
  let isTerminated = false;
  
  currentPnl += profitOrLoss;
  if (profitOrLoss < 0) {
    lossStreak += 1;
  } else {
    lossStreak = 0; 
  }

  if (lossStreak >= 3) {
    isTerminated = true;
    console.error("🚨 [CRITICAL SHUTDOWN] 3 consecutive losses hit!");
  } else if (currentPnl >= ACCOUNT_LIMITS.TAKE_PROFIT_TARGET) {
    isTerminated = true;
  } else if (currentPnl <= ACCOUNT_LIMITS.MAX_STOP_LOSS_LIMIT) {
    isTerminated = true;
  }

  localStorage.setItem(STATE_KEYS.PnL, currentPnl.toString());
  localStorage.setItem(STATE_KEYS.LOSS_STREAK, lossStreak.toString());
  localStorage.setItem(STATE_KEYS.KILL_SWITCH, isTerminated.toString());

  if (isTerminated) {
    const alertsText = encodeURIComponent(`🛑 *AUTOMATED BOT RUN TERMINATED* 🛑\n\nReason: Account thresholds reached or 3 consecutive losses hit. Live execution channels have been disabled.`);
    fetch(`https://telegram.org{TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHANNEL_ID}&text=${alertsText}&parse_mode=Markdown`).catch(() => {});
  }
}

export function resetAccountSessionRun() {
  if (!isClient()) return;
  localStorage.removeItem(STATE_KEYS.PnL);
  localStorage.removeItem(STATE_KEYS.LOSS_STREAK);
  localStorage.removeItem(STATE_KEYS.KILL_SWITCH);
}

export function resetMasterHighLock() { masterActiveHighStrategyId = null; }
// scannerLogic.ts - PART 2: Safe Core Scanner Engine Pipeline

import { broadcastSignalToTelegram, resetMasterHighLock, checkEngineStatus } from './Part1'; 
import { STRATEGY_PROFILES, evaluateStrategy } from './strategies';

export class ScannerLogicEngine {
  private tickRegistry: Record<string, number[]> = {};
  private tickTimestamps: Record<string, number> = {};

  private currentTopStrategyId: string | null = null;
  private lastLockTime: number = 0;
  private lockDurationMs: number = 4000;       
  private isEditingPaused: boolean = false;    
  private lastEvaluatedFrames: any[] = [];
  private lastTickReceivedTimestamp: number = 0;

  private standardizeSymbol(s: string): string {
    if (!s) return 'R_10';
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

  public forceManualTelegramBroadcast(activeFrame: any): void {
    if (!activeFrame || !activeFrame.profile || !activeFrame.metrics || checkEngineStatus()) return;
    
    const assetToken = this.standardizeSymbol(activeFrame.profile.targetSymbol);
    const lastTickTime = this.tickTimestamps[assetToken] || Date.now();
    const currentLatency = Date.now() - lastTickTime;

    broadcastSignalToTelegram({
      strategyName: activeFrame.profile.name || 'Unknown',
      assetName: (activeFrame.profile.targetSymbol || '').replace('R_', 'Volatility '),
      confidenceScore: activeFrame.metrics.finalConfidence || 0,
      recommendedAction: activeFrame.metrics.direction || 'FLAT',
      riskTier: activeFrame.metrics.status as any,
      contractType: activeFrame.profile.contractType || 'RISE_FALL',
      executionLatencyMs: currentLatency
    }, activeFrame.profile.id);
  }

  public runScannerPipeline(): any[] {
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
    
    // SAFE FALLBACK: Check if strategy files exist before looping
    const profiles = STRATEGY_PROFILES || [];
    const rawFrames = profiles.map(profile => {
      const targetToken = this.standardizeSymbol(profile.targetSymbol);
      const currentTicks = this.tickRegistry[targetToken] || [];
      const metrics = evaluateStrategy ? evaluateStrategy(profile, currentTicks) : { finalConfidence: 0, scannerScore: 0, direction: 'FLAT', status: 'LOW' };
      return { profile, metrics };
    });

    const sortedGlobalChallengers = [...rawFrames].sort((a, b) => {
      const scoreA = (a.metrics?.scannerScore || 0) + (a.metrics?.finalConfidence || 0);
      const scoreB = (b.metrics?.scannerScore || 0) + (b.metrics?.finalConfidence || 0);
      return scoreB - scoreA;
    });

    // Explicit fallback protection to prevent index evaluation runtime crashes
    const candidateWinner = sortedGlobalChallengers.length > 0 ? sortedGlobalChallengers[0] : null; 

    const assetToken = candidateWinner ? this.standardizeSymbol(candidateWinner.profile.targetSymbol) : '';
    const currentLatency = currentTime - (this.tickTimestamps[assetToken] || currentTime);

    const strictEnforcedFrames = rawFrames.map(frame => {
      const isAbsoluteGlobalWinner = candidateWinner && frame.profile.id === candidateWinner.profile.id;
      const confidence = frame.metrics?.finalConfidence || 0;
      const passesConfidenceThreshold = confidence > 80;

      if (isAbsoluteGlobalWinner && passesConfidenceThreshold) {
        frame.metrics.status = 'HIGH';
      } else {
        frame.metrics.status = confidence >= 65 ? 'MEDIUM' : 'LOW';
      }
      return frame;
    });

    const currentLeaderFrame = strictEnforcedFrames.find(f => f.profile.id === this.currentTopStrategyId);
    const isLockExpired = (currentTime - this.lastLockTime) > this.lockDurationMs;
    const currentWinnerStillViable = currentLeaderFrame && (currentLeaderFrame.metrics?.finalConfidence || 0) >= 78;
    
    let isCurrentWinnerDethronedByPerformance = false;
    if (candidateWinner && currentLeaderFrame && candidateWinner.profile.id !== this.currentTopStrategyId) {
      const leaderWeight = (currentLeaderFrame.metrics?.scannerScore || 0) + (currentLeaderFrame.metrics?.finalConfidence || 0);
      const candidateWeight = (candidateWinner.metrics?.scannerScore || 0) + (candidateWinner.metrics?.finalConfidence || 0);
      if (candidateWeight > (leaderWeight + 20)) {
        isCurrentWinnerDethronedByPerformance = true;
      }
    }

    if (isLockExpired || !this.currentTopStrategyId || isCurrentWinnerDethronedByPerformance || !currentWinnerStillViable) {
      if (candidateWinner && (candidateWinner.metrics?.finalConfidence || 0) > 80) {
        this.currentTopStrategyId = candidateWinner.profile.id;
        this.lastLockTime = currentTime;
        
        broadcastSignalToTelegram({
          strategyName: candidateWinner.profile.name || 'Unknown',
          assetName: (candidateWinner.profile.targetSymbol || '').replace('R_', 'Volatility '),
          confidenceScore: candidateWinner.metrics.finalConfidence || 0,
          recommendedAction: candidateWinner.metrics.direction || 'FLAT',
          riskTier: 'HIGH',
          contractType: candidateWinner.profile.contractType || 'RISE_FALL',
          executionLatencyMs: currentLatency
        }, candidateWinner.profile.id);
      } else {
        resetMasterHighLock();
      }
    }

    const finalViewOutput = [...strictEnforcedFrames].sort((a, b) => (b.metrics?.finalConfidence || 0) - (a.metrics?.finalConfidence || 0));
    this.lastEvaluatedFrames = finalViewOutput;
    return finalViewOutput;
  }
    }
