// scannerLogic.ts - PART 1: Global Typings & Core Engine Structures

import { STRATEGY_PROFILES, evaluateStrategy } from './strategies';

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

export const ACCOUNT_LIMITS = {
  MAX_ALLOWED_SLIPPAGE_MS: 380,
  RISK_PER_TRADE_PERCENT: 0.02 
};

const STATE_KEYS = {
  PnL: 'EDASCORE_CURRENT_RUN_PNL',
  LOSS_STREAK: 'EDASCORE_CONSECUTIVE_LOSS_COUNT',
  KILL_SWITCH: 'EDASCORE_SYSTEM_RUN_TERMINATED',
  TOTAL_RUNS_COUNT: 'EDASCORE_SESSION_TOTAL_RUNS_COUNT'
};

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function checkEngineStatus(): boolean {
  if (!isClient()) return false;
  return localStorage.getItem(STATE_KEYS.KILL_SWITCH) === 'true';
}

let masterActiveHighStrategyId: string | null = null;
export let liveExecutionLock = false; 

const SYMBOL_BROKER_MAP: Record<string, string> = {
  'R_10': '1HZ10V',
  'R_25': '1HZ25V', 
  'R_50': '1HZ50V',
  'R_75': '1HZ75V',
  'R_100': '1HZ100V'
};
// scannerLogic.ts - PART 2: Connection-Resilient Broker Trade Routers

/**
 * CORE QUANT MACHINE BROKER ROUTING ENGINE
 * Connects directly to the exchange API layer to fire trades instantly
 */
export async function executeBrokerTrade(signal: HighConfidenceSignal) {
  if (liveExecutionLock || checkEngineStatus()) return;
  liveExecutionLock = true; 

  const tradeData = signal.executionPayload;
  if (!tradeData) {
    liveExecutionLock = false;
    return;
  }

  console.log(`⚡ [EXECUTION INITIATED] Fire order: ${signal.contractType} | Asset: ${signal.assetName}`);

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
      ...(isAccumulator && { growth_rate: tradeData.growthRate }) 
    }
  };

  try {
    const response = await fetch("https://deriv.com", { 
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
      startVirtualProtectionEngine(result.contract_id, tradeData.takeProfit, tradeData.stopLoss, isAccumulator);
    } else {
      console.error("❌ Broker API rejected allocation payload:", result.message);
      // 🛠️ DEFENSIVE LOCK FIX: Free execution gate locks down instantly if broker rejects parameters
      liveExecutionLock = false; 
    }
  } catch (error) {
    console.error("🚨 Order execution fatal pipeline network failure:", error);
    // 🛠️ DEFENSIVE LOCK FIX: Free locks safely if hardware connection fails mid-flight
    liveExecutionLock = false; 
  }
}

/**
 * CONNECTION-RESILIENT VIRTUAL RUNTIME MONITOR
 * Watches running trade state streams and pushes automated exit requests matching SL/TP forms
 */
async function startVirtualProtectionEngine(contractId: string, takeProfit: number, stopLoss: number, isAccumulator: boolean) {
  let activeWatcher = true;
  let consecutiveNetworkFailures = 0;

  while (activeWatcher) {
    // 🛠️ NETWORK STATUS CHECKER: Abort watcher loop instantly if device interface flags offline state
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.error("🚨 Hardware network interface reported OFFLINE state. Aborting watcher safely.");
      handleFatalNetworkDisconnection(contractId);
      break;
    }

    try {
      // 🛠️ FETCH TIMEOUT SHIELD: Force execution limits to prevent hanging connections on slow networks
      const checkResponse = await fetch(`https://deriv.com{contractId}`, {
        signal: AbortSignal.timeout(1500)
      });
      
      const trackingNode = await checkResponse.json();
      consecutiveNetworkFailures = 0; // Reset network tracking counters upon clean handshake response

      if (!checkResponse.ok || trackingNode.is_expired) {
        trackExecutedTradeResult(trackingNode.profit || -1.00); 
        activeWatcher = false;
        break;
      }

      // Flat contract types expire natively on the broker array layer; continuously scan Accumulators
      if (!isAccumulator) {
        await new Promise(res => setTimeout(res, 1000));
        continue;
      }

      const currentFloatingPnL = trackingNode.profit; 

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

      await new Promise(res => setTimeout(res, 250));
    } catch (error) {
      consecutiveNetworkFailures++;
      console.warn(`⚠️ Network connection pipeline verification drop: ${consecutiveNetworkFailures}/4`);
      
      // If server check requests fail 4 times consecutively (approx 4-5 seconds), initialize safety loops
      if (consecutiveNetworkFailures >= 4) {
        console.error("🚨 Persistent data pipeline disconnect identified during trade execution runtime.");
        handleFatalNetworkDisconnection(contractId);
        activeWatcher = false;
        break;
      }
      await new Promise(res => setTimeout(res, 1000)); 
    }
  }
}
// scannerLogic.ts - PART 3: Fallback Network Disconnection & Telegram Gateway Broadcasters

/**
 * THE GHOST POSITION RESOLVER
 * Forces local storage data down to clear frozen system engine states mid-crash
 */
function handleFatalNetworkDisconnection(contractId: string) {
  liveExecutionLock = false; 
  if (isClient()) {
    localStorage.setItem(STATE_KEYS.KILL_SWITCH, 'true');
  }

  const offlineAlertText = encodeURIComponent(
    `🚨 *CRITICAL HARDWARE DATA NETWORK DROP* 🚨\n\n` +
    `Your system script lost its active internet feed mid-run.\n` +
    `⚠️ *Position ID:* \`${contractId}\` is running unmonitored on broker node arrays.\n\n` +
    `👉 Log into your primary trade terminal application immediately to inspect or close positions manually!`
  );
  
  fetch(`https://telegram.org{TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHANNEL_ID}&text=${offlineAlertText}&parse_mode=Markdown`)
    .catch(() => console.error("🚨 Network failure: Emergency Telegram broadcast failed due to complete lack of internet connection lines."));
}

async function executeEmergencyPositionLiquidation(contractId: string, currentPnL: number) {
  try {
    await fetch(`https://deriv.com{contractId}/close`, { method: "POST" });
    trackExecutedTradeResult(currentPnL);
  } catch (err) {
    console.error("Critical failure during liquidation execution:", err);
  } finally {
    liveExecutionLock = false; 
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

  const telegramApiEndPoint = `https://telegram.org{TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHANNEL_ID}&text=${messageText}&parse_mode=Markdown`;

  try {
    const response = await fetch(telegramApiEndPoint);
    if (!response.ok) console.error("❌ Telegram gateway rejected execution payload:", response.statusText);
  } catch (error) {
    console.error("🚨 Transmission pipe pipeline network failure:", error);
  }
}
// scannerLogic.ts - PART 4A: Operational Circuit Breakers & Session Tracker Mutators

/**
 * 🛠️ DYNAMIC AUTOMATED CIRCUIT BREAKER
 * Enforces immediate automated shutdowns when constraints are met without relying on manual buttons
 */
export function trackExecutedTradeResult(profitOrLoss: number) {
  if (!isClient()) return;
  
  let currentPnl = parseFloat(localStorage.getItem(STATE_KEYS.PnL) || '0.00');
  let lossStreak = parseInt(localStorage.getItem(STATE_KEYS.LOSS_STREAK) || '0', 10);
  
  // Track continuous incremental execution cycles cleanly
  let totalRunsCount = parseInt(localStorage.getItem(STATE_KEYS.TOTAL_RUNS_COUNT) || '0', 10);
  totalRunsCount += 1; 

  let isTerminated = false;
  let shutdownReason = "";
  
  currentPnl += profitOrLoss;
  if (profitOrLoss < 0) {
    lossStreak += 1;
  } else {
    lossStreak = 0; 
  }

  // --- AUTOMATED SAFETY CIRCUIT BREAKERS ---
  if (lossStreak >= 3) {
    isTerminated = true;
    shutdownReason = "3 Consecutive Losses Registered.";
  } else if (currentPnl >= 30.00) { 
    isTerminated = true;
    shutdownReason = `Session Profit Target Achieved (+$${currentPnl.toFixed(2)}).`;
  } else if (currentPnl <= -15.00) { 
    isTerminated = true;
    shutdownReason = `Maximum Account Risk Floor Breached (-$${Math.abs(currentPnl).toFixed(2)}).`;
  } else if (totalRunsCount >= 5) {
    isTerminated = true;
    shutdownReason = `Strict Execution Cap Restraint Reached (${totalRunsCount}/5 trades completed).`;
  }

  // Save localized memory state logs back down to the browser database context
  localStorage.setItem(STATE_KEYS.PnL, currentPnl.toString());
  localStorage.setItem(STATE_KEYS.LOSS_STREAK, lossStreak.toString());
  localStorage.setItem(STATE_KEYS.TOTAL_RUNS_COUNT, totalRunsCount.toString());
  localStorage.setItem(STATE_KEYS.KILL_SWITCH, isTerminated.toString());

  liveExecutionLock = false; 

  if (isTerminated) {
    console.warn(`🛡️ [CIRCUIT BREAKER ACTIVATED] Automated shutdown sequence triggered: ${shutdownReason}`);
    const alertsText = encodeURIComponent(
      `🛑 *AUTOMATED ROBOT RUN TERMINATED* 🛑\n\n` +
      `👤 *Trigger:* Automated Circuit Breaker\n` +
      `📝 *Reason:* ${shutdownReason}\n` +
      `📈 *Final PnL:* $${currentPnl.toFixed(2)}\n` +
      `🔢 *Completed Runs:* ${totalRunsCount}/5\n\n` +
      `⚠️ Live execution loops have been locked out to protect your balance.`
    );
    fetch(`https://telegram.org{TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHANNEL_ID}&text=${alertsText}&parse_mode=Markdown`).catch(() => {});
  }
}

export function resetAccountSessionRun() {
  if (!isClient()) return;
  localStorage.removeItem(STATE_KEYS.PnL);
  localStorage.removeItem(STATE_KEYS.LOSS_STREAK);
  localStorage.removeItem(STATE_KEYS.KILL_SWITCH);
  localStorage.removeItem(STATE_KEYS.TOTAL_RUNS_COUNT); 
  liveExecutionLock = false;
}

export function resetMasterHighLock() { masterActiveHighStrategyId = null; }
// scannerLogic.ts - PART 4B: Exported Scanner Pipeline Logic Engine Class

// 🛠️ CRITICAL COMPILATION FIX: Added the public export keyword to enable clean linking with FloatingAI.tsx
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
      executionPayload: activeFrame.metrics.executionPayload
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
    
    const profiles = STRATEGY_PROFILES || [];
    
    const rawFrames = profiles.map(profile => {
      const targetToken = this.standardizeSymbol(profile.targetSymbol);
      const currentTicks = this.tickRegistry[targetToken] || [];
      const baseMetrics = evaluateStrategy ? evaluateStrategy(profile, currentTicks) : { finalConfidence: 0, scannerScore: 0, direction: 'FLAT', status: 'LOW' };
      
      return { 
        profile: JSON.parse(JSON.stringify(profile)), 
        metrics: { ...baseMetrics }
      };
    });

    const sortedGlobalChallengers = [...rawFrames].sort((a, b) => {
      const scoreA = (a.metrics?.scannerScore || 0) + (a.metrics?.finalConfidence || 0);
      const scoreB = (b.metrics?.scannerScore || 0) + (b.metrics?.finalConfidence || 0);
      return scoreB - scoreA;
    });

    const candidateWinner = sortedGlobalChallengers.length > 0 ? sortedGlobalChallengers : null; 

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
