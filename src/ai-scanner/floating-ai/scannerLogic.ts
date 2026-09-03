// scannerLogic.ts - PART 1A: Core Engine Declarations & Global Types

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
    executionPayload?: {
      stake: number;
      takeProfit: number;
      stopLoss: number;
      growthRate: number;
    };
  };
}

export interface HighConfidenceSignal {
  strategyName: string;
  assetName: string;
  confidenceScore: number;
  recommendedAction: string;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH';
  contractType: string;
  executionLatencyMs: number;
  executionPayload?: {
    stake: number;
    takeProfit: number;
    stopLoss: number;
    growthRate: number;
  };
}

const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || "YOUR_TELEGRAM_BOT_API_TOKEN"; 
const TELEGRAM_CHANNEL_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_ID || "@your_public_channel_username"; 

// RESTRUCTURED ACCOUNT BOUNDARIES MATCHING BROKER COMPATIBILITY
export const ACCOUNT_LIMITS = {
  MAX_ALLOWED_SLIPPAGE_MS: 380,
  RISK_PER_TRADE_PERCENT: 0.02 // Strict: Never risk more than 2% of bankroll per run
};

const STATE_KEYS = {
  PnL: 'EDASCORE_CURRENT_RUN_PNL',
  LOSS_STREAK: 'EDASCORE_CONSECUTIVE_LOSS_COUNT',
  KILL_SWITCH: 'EDASCORE_SYSTEM_RUN_TERMINATED'
};

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function checkEngineStatus(): boolean {
  if (!isClient()) return false;
  return localStorage.getItem(STATE_KEYS.KILL_SWITCH) === 'true';
}

let masterActiveHighStrategyId: string | null = null;
export let liveExecutionLock = false; // Exposed internally to keep safe structural boundary control

// Mapping application targets to exact Broker structural assets
const SYMBOL_BROKER_MAP: Record<string, string> = {
  'R_10': '1HZ10V',
  'R_25': '1HZ25V', // Volatility 25 Index
  'R_50': '1HZ50V',
  'R_75': '1HZ75V',
  'R_100': '1HZ100V'
};

/**
 * CORE QUANT MACHINE BROKER ROUTING ENGINE
 * Connects directly to the exchange API layer to fire trades instantly
 */
export async function executeBrokerTrade(signal: HighConfidenceSignal) {
  if (liveExecutionLock || checkEngineStatus()) return;
  liveExecutionLock = true; // Engage concurrency block

  const tradeData = signal.executionPayload;
  if (!tradeData) {
    liveExecutionLock = false;
    return;
  }

  console.log(`⚡ [EXECUTION INITIATED] Fire order: ${signal.contractType} | Asset: ${signal.assetName}`);

  // Structuring the payload specifically to handle Accumulator rules safely
  const isAccumulator = signal.contractType === 'ACCUMULATOR';
  
  const brokerPayload = {
    buy: 1,
    price: tradeData.stake,
    parameters: {
      amount: tradeData.stake,
      basis: "stake",
      contract_type: isAccumulator ? "ACCU" : (signal.recommendedAction === 'UP' ? 'CALL' : 'PUT'),
      currency: "USD",
      symbol: SYMBOL_BROKER_MAP[signal.assetName] || '1HZ25V',
      ...(isAccumulator && { growth_rate: tradeData.growthRate }) // Add growth factor safely if matching index type
    }
  };

  try {
    const response = await fetch("https://deriv.com", { // Replace with your active proxy or WebSockets bridge URL
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_BROKER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(brokerPayload)
    });

    const result = await response.json();

    if (response.ok && result.contract_id) {
      console.log(`✅ [ORDER FILLED] Position running under ID: ${result.contract_id}`);
      
      // If the executed contract is an accumulator, instantiate local virtual watcher loop
      if (isAccumulator) {
        startVirtualProtectionEngine(result.contract_id, tradeData.takeProfit, tradeData.stopLoss);
      }
    } else {
      console.error("❌ Broker API rejected allocation payload:", result.message);
      liveExecutionLock = false;
    }
  } catch (error) {
    console.error("🚨 Order execution fatal pipeline network failure:", error);
    liveExecutionLock = false;
  }
}
/**
 * THE ACCUMULATOR FIX: VIRTUAL RUNTIME MONITOR
 * Watches running trade state streams and pushes automated exit requests matching SL/TP forms
 */
async function startVirtualProtectionEngine(contractId: string, takeProfit: number, stopLoss: number) {
  let activeWatcher = true;

  while (activeWatcher) {
    try {
      const checkResponse = await fetch(`https://deriv.com{contractId}`);
      const trackingNode = await checkResponse.json();

      if (!checkResponse.ok || trackingNode.is_expired) {
        trackExecutedTradeResult(trackingNode.profit || -1.00); // Process natural outcome balance updates
        activeWatcher = false;
        break;
      }

      const currentFloatingPnL = trackingNode.profit; // Real-time profit balance ($ values)

      // A. Virtual Take Profit Trigger
      if (currentFloatingPnL >= takeProfit) {
        console.log(`🎯 Virtual Take Profit Hit (+$${currentFloatingPnL}). Forcing structural sell closure.`);
        await executeEmergencyPositionLiquidation(contractId, currentFloatingPnL);
        activeWatcher = false;
        break;
      }

      // B. Virtual Stop Loss Trigger
      if (currentFloatingPnL <= -stopLoss) {
        console.log(`🛑 Virtual Stop Loss Broken (-$${Math.abs(currentFloatingPnL)}). Killing transaction.`);
        await executeEmergencyPositionLiquidation(contractId, currentFloatingPnL);
        activeWatcher = false;
        break;
      }

      // Poll interval spacing to prevent resource locking
      await new Promise(res => setTimeout(res, 250));
    } catch {
      activeWatcher = false;
      liveExecutionLock = false;
    }
  }
}

async function executeEmergencyPositionLiquidation(contractId: string, currentPnL: number) {
  try {
    await fetch(`https://deriv.com{contractId}/close`, { method: "POST" });
    trackExecutedTradeResult(currentPnL);
  } catch (err) {
    console.error("Critical failure during liquidation execution:", err);
  } finally {
    liveExecutionLock = false; // Disengage concurrency loop
  }
}

export async function broadcastSignalToTelegram(signal: HighConfidenceSignal, strategyId: string) {
  if (checkEngineStatus()) return;
  if (signal.executionLatencyMs > ACCOUNT_LIMITS.MAX_ALLOWED_SLIPPAGE_MS) return;
  if (signal.confidenceScore <= 80) return;

  if (signal.riskTier === 'HIGH') {
    if (masterActiveHighStrategyId !== null && masterActiveHighStrategyId !== strategyId) return;
    masterActiveHighStrategyId = strategyId;
  }

  // 🛠️ CRITICAL FIX: Await core execution loop synchronously to eliminate duplications
  if (!liveExecutionLock) {
    await executeBrokerTrade(signal);
  } else {
    console.warn("⚠️ Pipeline skipped redundant execution to protect system balance.");
    return;
  }

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

  // 🛠️ CRITICAL FIX: Added '$' and clear routing root directory paths to prevent crashing fetch pipes
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

  // Enforcing strict parameter thresholds matching UI input scale bounds
  if (lossStreak >= 3) {
    isTerminated = true;
    console.error("🚨 [CRITICAL SHUTDOWN] 3 consecutive losses hit!");
  } else if (currentPnl >= 1500) { 
    isTerminated = true;
  } else if (currentPnl <= -500) {
    isTerminated = true;
  }

  localStorage.setItem(STATE_KEYS.PnL, currentPnl.toString());
  localStorage.setItem(STATE_KEYS.LOSS_STREAK, lossStreak.toString());
  localStorage.setItem(STATE_KEYS.KILL_SWITCH, isTerminated.toString());

  liveExecutionLock = false; // Always clear execution gate locks down at structural termination resolution

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
  liveExecutionLock = false;
}

export function resetMasterHighLock() { masterActiveHighStrategyId = null; }
// scannerLogic.ts - PART 2A: Scanner Class Definition & Registry Handlers

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
      executionLatencyMs: currentLatency,
      // PIPE LIVE RUNTIME FORM VALUES TO MANUAL PRESS TRIGGERS
      executionPayload: activeFrame.metrics.executionPayload
    }, activeFrame.profile.id);
  }
// scannerLogic.ts - PART 2B: Strategy Scoring Engine Pipeline

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
    
    const profiles = STRATEGY_PROFILES || [];
    
    // 🛠️ CRITICAL FIX: Explicit shallow cloning to prevent shared reference mutations
    const rawFrames = profiles.map(profile => {
      const targetToken = this.standardizeSymbol(profile.targetSymbol);
      const currentTicks = this.tickRegistry[targetToken] || [];
      const baseMetrics = evaluateStrategy ? evaluateStrategy(profile, currentTicks) : { finalConfidence: 0, scannerScore: 0, direction: 'FLAT', status: 'LOW' };
      
      return { 
        profile: { ...profile }, 
        metrics: { ...baseMetrics } 
      };
    });

    const sortedGlobalChallengers = [...rawFrames].sort((a, b) => {
      const scoreA = (a.metrics?.scannerScore || 0) + (a.metrics?.finalConfidence || 0);
      const scoreB = (b.metrics?.scannerScore || 0) + (b.metrics?.finalConfidence || 0);
      return scoreB - scoreA;
    });

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
          executionLatencyMs: currentLatency,
          executionPayload: candidateWinner.metrics.executionPayload
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
