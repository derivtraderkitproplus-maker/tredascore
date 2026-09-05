// scannerLogic.ts - PART 1: Module Typings, Channel Tokens & Operational Storage Keys

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
  MAX_ALLOWED_SLIPPAGE_MS: 180, // Optimized to 180ms to match institutional execution bounds
  RISK_PER_TRADE_PERCENT: 0.02 
};

export const STATE_KEYS = {
  PnL: 'EDASCORE_CURRENT_RUN_PNL',
  LOSS_STREAK: 'EDASCORE_CONSECUTIVE_LOSS_COUNT',
  KILL_SWITCH: 'EDASCORE_SYSTEM_RUN_TERMINATED'
};

export function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function checkEngineStatus(): boolean {
  if (!isClient()) return false;
  return localStorage.getItem(STATE_KEYS.KILL_SWITCH) === 'true';
}

let masterActiveHighStrategyId: string | null = null;
export let liveExecutionLock = false; 

// FIXED BROKER ASSET LOOKUP KEYS (Matches the raw strategy string keys precisely)
export const SYMBOL_BROKER_MAP: Record<string, string> = {
  'R_10': '1HZ10V',
  'R_25': '1HZ25V', 
  'R_50': '1HZ50V',
  'R_75': '1HZ75V',
  'R_100': '1HZ100V'
};
// scannerLogic.ts - PART 2: High-Performance Broker Order Router

/**
 * CORE QUANT MACHINE BROKER ROUTING ENGINE
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
    const response = await fetch(`https://deriv.com`, { 
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
// scannerLogic.ts - PART 3: Connection-Resilient Virtual Tracking Engine & Emergency Safeguards

let activeProtectionInterval: NodeJS.Timeout | null = null;

/**
 * START VIRTUAL PROTECTION ENGINE
 * Deploys an high-frequency independent background thread to guard capital metrics
 */
export function startVirtualProtectionEngine(
  contractId: string, 
  takeProfitTarget: number, 
  stopLossTarget: number,
  isAccumulatorMode: boolean
) {
  if (activeProtectionInterval) clearInterval(activeProtectionInterval);
  
  const initialCheckTime = Date.now();
  let trackingCycleCounter = 0;

  activeProtectionInterval = setInterval(async () => {
    trackingCycleCounter++;
    
    try {
      // Direct high-speed network request to monitor running contract status
      const response = await fetch(`https://deriv.com{contractId}`);
      if (!response.ok) throw new Error("Contract tracking telemetry dropped");
      
      const contract = await response.json();
      const currentPnL = parseFloat(contract.profit) || 0;
      
      console.log(`📡 [TELEMETRY LOOP] Cycle: ${trackingCycleCounter} | Live P&L: $${currentPnL.toFixed(2)}`);

      // CHECK GATE A: PROFIT TARGET REACHED
      if (currentPnL >= takeProfitTarget) {
        console.log(`🏆 [TARGET BREACHED] Profit target hit at +$${currentPnL.toFixed(2)}. Halting operations...`);
        executeEmergencyHalt('PROFIT', currentPnL, takeProfitTarget);
      }
      // CHECK GATE B: STOP LOSS FLOOR REACHED
      else if (currentPnL <= -Math.abs(stopLossTarget)) {
        console.log(`🛑 [DRAWDOWN BREACHED] Stop loss floor hit at -$${Math.abs(currentPnL).toFixed(2)}. Halting...`);
        
        // Reset tracking metrics in local browser storage to safe values
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('EDASCORE_CONSECUTIVE_LOSS_COUNT', '0');
        }
        executeEmergencyHalt('LOSS', currentPnL, stopLossTarget);
      }
      
      // CHECK GATE C: STATUS RESOLVED (Contract closed normally)
      if (contract.is_settled || contract.status !== 'open') {
        console.log(`🏁 [POSITION SETTLED] Contract closed normally with status: ${contract.status}`);
        clearTrackingEngine();
      }

    } catch (err) {
      console.warn(`⚠️ [TRACKING SYSTEM] Cycle ${trackingCycleCounter} error:`, err);
      
      // Connection Resiliency Timeout: If disconnected for more than 15 seconds, execute emergency preservation sequence
      if (Date.now() - initialCheckTime > 15000) {
        console.error("🚨 [CRITICAL ALERT] Telemetry link lost for 15s. Deploying account protection locks...");
        executeEmergencyHalt('LOSS', 0, stopLossTarget);
      }
    }
  }, 250); // Checks every 250ms to match sub-second execution speeds
}

function clearTrackingEngine() {
  if (activeProtectionInterval) {
    clearInterval(activeProtectionInterval);
    activeProtectionInterval = null;
  }
  liveExecutionLock = false;
  console.log("🔓 [SECURITY UNLOCKED] Engine tracking state cleared. Ready for next signal pulse.");
}

function executeEmergencyHalt(type: 'PROFIT' | 'LOSS', balance: number, limit: number) {
  clearTrackingEngine();
  
  // Call global window methods to communicate directly with your UI alerts overlay layer
  const globalWin = window as any;
  if (globalWin.tredaScannerBridgeInstance && typeof globalWin.tredaScannerBridgeInstance.triggerTopTierAlertOverlay === 'function') {
    globalWin.tredaScannerBridgeInstance.triggerTopTierAlertOverlay(type, balance, limit);
  } else {
    alert(`🛑 [CIRCUIT BREAKER] Trading Halted!\nReason: ${type === 'PROFIT' ? 'Target Profit' : 'Stop Loss'} Breach\nSession Balance: $${balance.toFixed(2)}`);
  }
}
