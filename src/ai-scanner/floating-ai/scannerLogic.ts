// scannerLogic.ts - PART 1: Core Type Frameworks & Shared State Configuration

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
  // Strict 5-Run Tracking Node Key
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
      liveExecutionLock = false; 
    }
  } catch (error) {
    console.error("🚨 Order execution fatal pipeline network failure:", error);
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
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.error("🚨 Hardware network interface reported OFFLINE state. Aborting watcher safely.");
      handleFatalNetworkDisconnection(contractId);
      break;
    }

    try {
      const checkResponse = await fetch(`https://deriv.com{contractId}`, {
        signal: AbortSignal.timeout(1500)
      });
      
      const trackingNode = await checkResponse.json();
      consecutiveNetworkFailures = 0; 

      if (!checkResponse.ok || trackingNode.is_expired) {
        trackExecutedTradeResult(trackingNode.profit || -1.00); 
        activeWatcher = false;
        break;
      }

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
// scannerLogic.ts - PART 3: Safe Account Resets, Telegram Bridges & 5-Run Circuit Breakers

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

  // --- AUTOMATED SAFETY CIRCUIT BREAKERS MATRIX ---
  
  // 📉 1. Stop Loss Protection Threshold Breaker
  if (lossStreak >= 3) {
    isTerminated = true;
    shutdownReason = "3 Consecutive Losses Registered.";
  } 
  // 📈 2. Take Profit Ceiling Target Attained
  else if (currentPnl >= 30.00) { 
    isTerminated = true;
    shutdownReason = `Session Profit Target Achieved (+$${currentPnl.toFixed(2)}).`;
  } 
  // 🛑 3. Maximum Total Account Drawdown Cap
  else if (currentPnl <= -15.00) { 
    isTerminated = true;
    shutdownReason = `Maximum Account Risk Floor Breached (-$${Math.abs(currentPnl).toFixed(2)}).`;
  }
  // 🔢 4. Strict 5-Run Absolute Structural Cap
  else if (totalRunsCount >= 5) {
    isTerminated = true;
    shutdownReason = `Strict Execution Cap Restraint Reached (${totalRunsCount}/5 trades completed).`;
  }

  // Save localized memory state logs back down to the browser database context
  localStorage.setItem(STATE_KEYS.PnL, currentPnl.toString());
  localStorage.setItem(STATE_KEYS.LOSS_STREAK, lossStreak.toString());
  localStorage.setItem(STATE_KEYS.TOTAL_RUNS_COUNT, totalRunsCount.toString());
  localStorage.setItem(STATE_KEYS.KILL_SWITCH, isTerminated.toString());

  liveExecutionLock = false; 

  // If any safety criterion is tripped, freeze trade workflows globally and broadcast to Telegram
  if (isTerminated) {
    console.warn(`🛡️ [CIRCUIT BREAKER ACTIVATED] Locking loops down automatically: ${shutdownReason}`);
    
    const alertsText = encodeURIComponent(
      `🛑 *AUTOMATED BOT RUN TERMINATED* 🛑\n\n` +
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
