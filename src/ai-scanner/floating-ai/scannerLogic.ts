// scannerLogic.ts - Production Version (Refactored for Low-Latency & Strict Routing)
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

export const SYMBOL_BROKER_MAP: Record<string, string> = {
  'R_10': '1HZ10V',
  'R_25': '1HZ25V', 
  'R_50': '1HZ50V',
  'R_75': '1HZ75V',
  'R_100': '1HZ100V'
};

export function resetMasterHighLock() { masterActiveHighStrategyId = null; }

/** * REFACTORED: ULTRA LOW-LATENCY WEBSOCKET ROUTER * Sub-millisecond execution bypassing the generic HTTP fetch framework completely */
export function executeBrokerTrade(signal: HighConfidenceSignal, activeWebSocketInstance: WebSocket) {
  if (liveExecutionLock || checkEngineStatus()) return;
  
  const tradeData = signal.executionPayload;
  if (!tradeData) return;

  if (activeWebSocketInstance.readyState !== WebSocket.OPEN) {
    console.error("🚨 Active WebSocket connection line is closed. Aborting order execution pipeline.");
    return;
  }

  liveExecutionLock = true; 
  console.log(`⚡ [EXECUTION INITIATED] Routing via WebSocket: ${signal.contractType} | Asset: ${signal.assetName}`);

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
      duration: 1,
      duration_unit: "t", 
      ...(isAccumulator && { growth_rate: tradeData.growthRate }) 
    }
  };

  activeWebSocketInstance.send(JSON.stringify(brokerPayload));
}

/** * REFACTORED: FIXES TELEGRAM PATH INTERPOLATION AND API ENDPOINTS */
export function dispatchTelegramNotification(messageString: string) {
  const encodedText = encodeURIComponent(messageString);
  const telegramApiEndPoint = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHANNEL_ID}&text=${encodedText}&parse_mode=Markdown`;

  fetch(telegramApiEndPoint).catch((err) => 
    console.error("🚨 System alert transmission pipeline failure:", err)
  );
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
  } else if (currentPnl >= 30.00) { 
    isTerminated = true;
    console.log("🎯 Session financial profit goal reached. Shutting down.");
  } else if (currentPnl <= -15.00) { 
    isTerminated = true;
  }

  localStorage.setItem(STATE_KEYS.PnL, currentPnl.toString());
  localStorage.setItem(STATE_KEYS.LOSS_STREAK, lossStreak.toString());
  localStorage.setItem(STATE_KEYS.KILL_SWITCH, isTerminated.toString());

  liveExecutionLock = false; 

  if (isTerminated) {
    dispatchTelegramNotification(`🛑 *AUTOMATED BOT RUN TERMINATED* 🛑\n\nReason: Session targets hit ($${currentPnl.toFixed(2)} PnL). Execution loops are locked down.`);
  }
}

export function resetAccountSessionRun() {
  if (!isClient()) return;
  localStorage.removeItem(STATE_KEYS.PnL);
  localStorage.removeItem(STATE_KEYS.LOSS_STREAK);
  localStorage.removeItem(STATE_KEYS.KILL_SWITCH);
  liveExecutionLock = false;
}

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

    // Call dynamic telegram broadcaster safely via refactored endpoint
    const currentPnl = isClient() ? parseFloat(localStorage.getItem(STATE_KEYS.PnL) || '0.00') : 0.00;
    const msg = `🚀 *MANUAL TELEGRAM SIGNAL ALERT* 🚀\n\n🤖 *Strategy:* ${activeFrame.profile.name}\n📊 *Asset:* ${assetToken}\n🎯 *Confidence:* ${activeFrame.metrics.finalConfidence}%\n⏱️ *Latency:* ${currentLatency}ms\n📈 *PnL:* $${currentPnl.toFixed(2)}`;
    dispatchTelegramNotification(msg);
  }

  public runScannerPipeline(): any[] {
    if (checkEngineStatus()) {
      return this.lastEvaluatedFrames.map(frame => ({
        ...frame,
        metrics: { ...frame.metrics, marketState: 'ENGINE_TERMINATED', direction: 'FLAT', scannerScore: 0, finalConfidence: 0, status: 'LOW' }
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
        metrics: { ...frame.metrics, marketState: 'STALE_DATA', direction: 'FLAT', scannerScore: 0, finalConfidence: 0, status: 'LOW' }
      }));
    }
    
    const profiles = STRATEGY_PROFILES || [];
    
    const rawFrames = profiles.map(profile => {
      const targetToken = this.standardizeSymbol(profile.targetSymbol);
      const currentTicks = this.tickRegistry[targetToken] || [];
      
      const isolatedProfileCopy = {
        ...profile,
        runtimeSettings: profile.runtimeSettings ? { ...profile.runtimeSettings } : undefined
      };
      
      const baseMetrics = evaluateStrategy ? evaluateStrategy(isolatedProfileCopy, currentTicks) : { finalConfidence: 0, scannerScore: 0, direction: 'FLAT', status: 'LOW' };
      
      return { profile: isolatedProfileCopy, metrics: { ...baseMetrics } };
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
        
        const currentPnl = isClient() ? parseFloat(localStorage.getItem(STATE_KEYS.PnL) || '0.00') : 0.00;
        const msg = `🚀 *HIGH-CONFIDENCE AUTO SIGNAL* 🚀\n\n🤖 *Strategy:* ${candidateWinner.profile.name}\n📊 *Asset:* ${assetToken}\n🎯 *Confidence:* ${candidateWinner.metrics.finalConfidence}%\n⏱️ *Latency:* ${currentLatency}ms\n📈 *PnL:* $${currentPnl.toFixed(2)}`;
        dispatchTelegramNotification(msg);
      } else {
        resetMasterHighLock();
      }
    }

    const finalViewOutput = [...strictEnforcedFrames].sort((a, b) => (b.metrics?.finalConfidence || 0) - (a.metrics?.finalConfidence || 0));
    this.lastEvaluatedFrames = finalViewOutput;
    return finalViewOutput;
  }
}
