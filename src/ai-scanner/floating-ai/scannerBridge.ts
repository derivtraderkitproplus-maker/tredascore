// scannerBridge.ts - Complete Fixed Low-Latency Framework
export type TickCallback = (symbol: string, tick: number) => void;

export interface BotParameters {
  direction: string;
  stake: number;
  stopLoss: number;
  takeProfit: number;
  contractType: string;  
  targetSymbol: string;  
}

export interface HighConfidenceSignal {
  strategyName: string;
  assetName: string;
  confidenceScore: number;
  recommendedAction: string;
  riskTier: string;
  contractType: string;
  executionLatencyMs: number;
  executionPayload?: any;
}

export class DerivScannerBridge {
  private ws: WebSocket | null = null;
  private onTickCallback: TickCallback | null = null;
  private activeSymbols: string[] = [];
  private boundMessageHandler: ((event: MessageEvent) => void) | null = null;
  private worker: Worker | null = null;
  
  private isPerformanceWatcherActive: boolean = false;
  private monitoredStopLoss: number = 0;
  private monitoredTakeProfit: number = 0;

  // DYNAMIC RISK BALANCES
  private baseStake: number = 0.35;
  private consecutiveLossesCount: number = 0;
  public liveExecutionLock: boolean = false;

  constructor(private appCtx: any) {
    this.extractSystemSocket();
    this.initializeBackgroundWorker();
  }

  private extractSystemSocket(): void {
    const globalWin = window as any;
    if (this.appCtx) {
      this.ws = this.appCtx.websocketInstance || this.appCtx.ws || this.appCtx.socket;
    }
    if (!this.ws) {
      this.ws = globalWin.derivWebSocket || globalWin.ws || globalWin.socket || globalWin.Blockly?.derivWorkspace?.socket;
    }
  }

  private initializeBackgroundWorker(): void {
    if (typeof window === 'undefined') return;
    
    // Rspack-compatible dynamic URL module background multi-thread worker instantiation
    this.worker = new Worker(new URL('./scanner.worker.ts', import.meta.url), { type: 'module' });

    this.worker.onmessage = (e: MessageEvent) => {
      const { action, payload } = e.data;
      if (action === 'SCANNER_BATCH_READY' && payload.length > 0) {
        const primaryWinner = payload; 
        
        if (primaryWinner && primaryWinner.metrics?.finalConfidence > 80 && !this.liveExecutionLock) {
          this.executeWebSocketOrder({
            strategyName: primaryWinner.profile.name,
            assetName: primaryWinner.profile.targetSymbol,
            confidenceScore: primaryWinner.metrics.finalConfidence,
            recommendedAction: primaryWinner.metrics.direction,
            riskTier: primaryWinner.metrics.status,
            contractType: primaryWinner.profile.contractType,
            executionLatencyMs: 0,
            executionPayload: primaryWinner.metrics.executionPayload
          });
        }
      }
    };
  }

  private normalizeSymbolString(s: string): string {
    const term = s.toUpperCase().trim();
    if (term.includes('1HZ10V') || term === 'R_10') return 'R_10';
    if (term.includes('1HZ25V') || term === 'R_25') return 'R_25';
    if (term.includes('1HZ50V') || term === 'R_50') return 'R_50';
    if (term.includes('1HZ75V') || term === 'R_75') return 'R_75';
    if (term.includes('1HZ100V') || term === 'R_100') return 'R_100';
    return s;
  }

  private checkSymbolMatch(incoming: string, registered: string): boolean {
    return this.normalizeSymbolString(incoming) === this.normalizeSymbolString(registered);
  }

  public initPipeline(symbols: string[], onTick: TickCallback): void {
    this.closePipeline();
    this.onTickCallback = onTick;
    this.activeSymbols = symbols;
    this.extractSystemSocket();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.boundMessageHandler = (event: MessageEvent) => {
        try {
          const incomingFrame = JSON.parse(event.data);
          
          if (incomingFrame.msg_type === 'tick' && incomingFrame.tick) {
            const { symbol, quote } = incomingFrame.tick;
            const normalized = this.normalizeSymbolString(symbol);
            
            if (this.activeSymbols.some(s => this.normalizeSymbolString(s) === normalized)) {
              this.onTickCallback?.(normalized, parseFloat(quote));
              this.worker?.postMessage({
                action: 'INFLOW_TICK',
                symbol: normalized,
                price: parseFloat(quote)
              });
            }
          }

          if (incomingFrame.msg_type === 'proposal_open_contract') {
            const contract = incomingFrame.proposal_open_contract;
            if (contract && (contract.is_expired || contract.status !== 'open')) {
              console.log(`🏁 Contract settlement event verified: $${contract.profit}`);
              this.handleContractSettlementEvent(contract);
            }
          }
        } catch (e) {}
      };
      this.ws.addEventListener('message', this.boundMessageHandler);
    }
  }

  public handleContractSettlementEvent(contractNode: any): void {
    if (!contractNode) return;

    const currentFloatingPnL = parseFloat(contractNode.profit) || 0;
    const activeRunsCount = contractNode.transaction_ids?.length || 8;

    // 🎯 REFACTORED LOCK RELEASE: Releases the execution barrier instantly upon cycle settlement
    this.liveExecutionLock = false;

    if (this.monitoredTakeProfit > 0 && currentFloatingPnL >= this.monitoredTakeProfit) {
      this.triggerTopTierAlertOverlay('PROFIT', currentFloatingPnL, this.monitoredTakeProfit, activeRunsCount);
      this.emergencyHaltOperations();
    } 
    else if (this.monitoredStopLoss > 0 && currentFloatingPnL <= -Math.abs(this.monitoredStopLoss)) {
      this.triggerTopTierAlertOverlay('LOSS', currentFloatingPnL, this.monitoredStopLoss, activeRunsCount);
      this.emergencyHaltOperations();
    }
  }

  public executeWebSocketOrder(signal: HighConfidenceSignal): void {
    if (this.liveExecutionLock || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    this.liveExecutionLock = true;
    console.log(`🚀 [ENGINE DISPATCH] Outbound transaction message packet sent for: ${signal.strategyName}`);

    const brokerPayload = {
      buy: 1,
      price: signal.executionPayload?.stake || this.baseStake,
      parameters: {
        amount: signal.executionPayload?.stake || this.baseStake,
        basis: "stake",
        contract_type: signal.recommendedAction === 'UP' ? 'CALL' : 'PUT',
        currency: "USD",
        symbol: this.normalizeSymbolString(signal.assetName) === 'R_25' ? '1HZ25V' : '1HZ100V',
        duration: 1,
        duration_unit: "t"
      }
    };

    this.ws.send(JSON.stringify(brokerPayload));
  }

  private playPremiumSynthesizerChime(style: 'SUCCESS_RISE' | 'ALERT_ECHO'): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      const now = ctx.currentTime;

      if (style === 'SUCCESS_RISE') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); 
        osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); 
        gainNode.gain.setValueAtTime(0.25, now);
        gainNode.gain.linearRampToValueAtTime(0.001, now + 0.55);
        osc.start(now); osc.stop(now + 0.55);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220.00, now); 
        gainNode.gain.setValueAtTime(0.35, now);
        gainNode.gain.linearRampToValueAtTime(0.001, now + 0.45);
        osc.start(now); osc.stop(now + 0.45);
      }
    } catch (e) {}
  }

  private triggerTopTierAlertOverlay(type: 'PROFIT' | 'LOSS', balance: number, limit: number, activeRunsCount: number | string): void {
    const existingModal = document.getElementById('treda-circuit-breaker-modal');
    if (existingModal) existingModal.remove();

    const isProfit = type === 'PROFIT';
    const primaryColor = isProfit ? '#2ed479' : '#ff4a62';
    const glowColor = isProfit ? 'rgba(46, 212, 121, 0.2)' : 'rgba(255, 74, 98, 0.2)';
    
    this.playPremiumSynthesizerChime(isProfit ? 'SUCCESS_RISE' : 'ALERT_ECHO');

    const backdrop = document.createElement('div');
    backdrop.id = 'treda-circuit-breaker-modal';
    Object.assign(backdrop.style, {
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
      backgroundColor: 'rgba(5, 7, 13, 0.85)', backdropFilter: 'blur(6px)',
      zIndex: '100000', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', boxSizing: 'border-box', opacity: '0', transition: 'opacity 0.25s ease'
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      background: '#0e111a', border: `1px solid ${primaryColor}`, borderRadius: '14px',
      width: '100%', maxWidth: '340px', padding: '24px 20px', boxSizing: 'border-box',
      textAlign: 'center', boxShadow: `0 10px 40px ${glowColor}`, transform: 'scale(0.9)',
      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)', fontFamily: '-apple-system, sans-serif'
    });

    card.innerHTML = `
      <div style="color: #6c718c; font-size: 10px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">
        🌐 tredascore.pro says:
      </div>
      <div style="font-size: 32px; margin-bottom: 12px;">\${isProfit ? '🏆' : '🛑'}</div>
      <h2 style="color: #ffffff; font-size: 18px; font-weight: 800; margin: 0 0 4px 0; text-transform: uppercase;">
        \${isProfit ? 'Target Profit Breach' : 'Drawdown Breached'}
      </h2>
      <p style="color: #6c718c; font-size: 11px; margin: 0 0 20px 0;">Automated circuit breaker deployed.</p>
      <div style="background: #141824; border: 1px solid #1e2335; border-radius: 8px; padding: 12px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="color: #6c718c;">Session Balance:</span>
          <span style="font-weight: bold; color: \${primaryColor};">\${isProfit ? '+' : '-'}$\${Math.abs(balance).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="color: #6c718c;">Trigger Target:</span>
          <span style="font-weight: bold; color: #ffffff;">$\${limit.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="color: #6c718c;">Total Cycle Runs:</span>
          <span style="font-weight: bold; color: #f5a623;">\${activeRunsCount} Cycles</span>
        </div>
      </div>
      <button id="close-breaker-modal-btn" style="width: 100%; background: #1c2035; border: 1px solid #2d3450; color: #ffffff; padding: 12px; font-size: 12px; font-weight: bold; border-radius: 6px; cursor: pointer;">
        ACKNOWLEDGE & DISMISS
      </button>
    `;

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    setTimeout(() => { backdrop.style.opacity = '1'; card.style.transform = 'scale(1)'; }, 10);

    const dismissModal = () => {
      backdrop.style.opacity = '0'; card.style.transform = 'scale(0.9)';
      setTimeout(() => {
        backdrop.remove();
        const el = document.querySelector('#id-dashboard') || document.querySelector('.dbot-tab__dashboard');
        if (el) (el as HTMLElement).click();
      }, 250);
    };

    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) dismissModal(); });
    card.querySelector('#close-breaker-modal-btn')?.addEventListener('click', dismissModal);
  }

  private emergencyHaltOperations(): void {
    this.liveExecutionLock = true; 
    const globalWin = window as any;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('EDASCORE_SYSTEM_RUN_TERMINATED', 'true');
    }
    const coreApp = globalWin.derivRunner || globalWin.DBot || globalWin.Blockly?.derivWorkspace;
    if (coreApp && typeof coreApp.stopBot === 'function') coreApp.stopBot();
    this.monitoredTakeProfit = 0; this.monitoredStopLoss = 0;
  }

  public injectDataToBlockly(params: BotParameters): void {
    const globalWin = window as any;
    this.monitoredStopLoss = parseFloat(params.stopLoss as any) || 0;
    this.monitoredTakeProfit = parseFloat(params.takeProfit as any) || 0;
    this.baseStake = parseFloat(params.stake as any) || 3.00;

    globalWin.tredaPendingParams = { ...params };
    let workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.mainWorkspace;
    
    setTimeout(() => {
      workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.mainWorkspace;
      if (!workspace) return;

      try {
        const cachedParams = globalWin.tredaPendingParams || params;
        const allBlocks = workspace.getAllBlocks(false);
        let blockInjectionCounter = 0;

        allBlocks.forEach((block: any) => {
          if (block.type === 'trade_definition_market') {
            const symbolField = block.getField('SYMBOL_LIST');
            if (symbolField) {
              let systemSymbol = cachedParams.targetSymbol.toUpperCase().trim();
              if (systemSymbol === 'R_25') systemSymbol = '1HZ25V';
              if (systemSymbol === 'R_100') systemSymbol = '1HZ100V';
              symbolField.setValue(systemSymbol);
              blockInjectionCounter++;
            }
          }

          if (block.type === 'variables_set') {
            const fieldVar = block.getField('VAR');
            if (fieldVar) {
              const variableName = fieldVar.getText();
              const valueInput = block.getInput('VALUE');
              
              if (valueInput && valueInput.connection) {
                const targetBlock = valueInput.connection.targetBlock();
                if (targetBlock) {
                  const numField = targetBlock.getField('NUM');
                  if (numField) {
                    const normalizedVar = variableName.toLowerCase().trim();
                    if (normalizedVar.includes('stake') || normalizedVar === 'maxstake') {
                      numField.setValue(Number(cachedParams.stake).toFixed(2));
                      blockInjectionCounter++;
                    }
                    else if (normalizedVar.includes('loss') || normalizedVar === 'sl') {
                      numField.setValue(Number(cachedParams.stopLoss).toFixed(2));
                      blockInjectionCounter++;
                    }
                    else if (normalizedVar.includes('profit') || normalizedVar === 'tp') {
                      numField.setValue(Number(cachedParams.takeProfit).toFixed(2));
                      blockInjectionCounter++;
                    }
                  }
                }
              }
            }
          }
        });

        if (workspace && typeof workspace.render === 'function') workspace.render();
        if (blockInjectionCounter > 0) globalWin.tredaPendingParams = null;
      } catch (err) {
        console.error(err);
      }
    }, 300); 
  }

  public closePipeline(): void {
    if (this.ws && this.boundMessageHandler) {
      try { this.ws.removeEventListener('message', this.boundMessageHandler); } catch (e) {}
      this.boundMessageHandler = null;
    }
  }
      }
