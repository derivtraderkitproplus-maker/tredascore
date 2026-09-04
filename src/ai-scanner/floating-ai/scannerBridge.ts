// scannerBridge.ts - PART 1: Core Definitions & Module State Registry

export type TickCallback = (symbol: string, tick: number) => void;

export interface BotParameters {
  direction: string;
  stake: number;
  stopLoss: number;
  takeProfit: number;
  contractType: string;  
  targetSymbol: string;  
}

export class DerivScannerBridge {
  private ws: WebSocket | null = null;
  private onTickCallback: TickCallback | null = null;
  private activeSymbols: string[] = [];
  private boundMessageHandler: ((event: MessageEvent) => void) | null = null;
  
  // Real-time circuit breaker tracking states
  private isPerformanceWatcherActive: boolean = false;
  private monitoredStopLoss: number = 0;
  private monitoredTakeProfit: number = 0;

  // DYNAMIC RISK COMPOUNDING MEMORY MATRIX
  private baseStake: number = 3.00;
  private currentMartingaleMultiplier: number = 2.0; 
  private consecutiveLossesCount: number = 0;
  private maximumRecoveryStepsAllowed: number = 5;

  constructor(private appCtx: any) {
    this.extractSystemSocket();
    this.initializeAutomatedPerformanceWatcher();
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
// scannerBridge.ts - PART 2: Text Normalizers & Socket Message Listeners

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
          const data = JSON.parse(event.data);
          if (data.msg_type === 'tick' && data.tick) {
            const { symbol, quote } = data.tick;
            const matchedSymbol = this.activeSymbols.find(s => this.checkSymbolMatch(symbol, s));
            
            if (matchedSymbol) {
              this.onTickCallback?.(this.normalizeSymbolString(matchedSymbol), parseFloat(quote));
            }
          }
        } catch (e) {}
      };
      this.ws.addEventListener('message', this.boundMessageHandler);
    }
  }

  public closePipeline(): void {
    if (this.ws && this.boundMessageHandler) {
      try {
        this.ws.removeEventListener('message', this.boundMessageHandler);
      } catch (e) {}
      this.boundMessageHandler = null;
    }
  }
// scannerBridge.ts - PART 3: Premium Native Web Audio Chime Synthesizer

  /**
   * HIGH-TECH NATIVE AUDIO CHIME GENERATOR
   * Utilizes the browser Web Audio API to synthesize sleek tones without external files.
   */
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
        // High-end electronic success rising sweep chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5 Note
        osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // D6 Note
        osc.frequency.exponentialRampToValueAtTime(1760.00, now + 0.35); // A6 Note
        
        gainNode.gain.setValueAtTime(0.25, now);
        gainNode.gain.linearRampToValueAtTime(0.001, now + 0.55);
        osc.start(now);
        osc.stop(now + 0.55);
      } else {
        // Futuristic low frequency protection hum alert chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220.00, now); // A3 Low Note
        osc.frequency.setValueAtTime(196.00, now + 0.12); // G3 Lower Note
        
        gainNode.gain.setValueAtTime(0.35, now);
        gainNode.gain.linearRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch (error) {
      console.warn("Web Audio Context not permitted or fully initialized yet:", error);
    }
  }
// scannerBridge.ts - PART 4: Premium White-Labeled UI Overlay Modal (tredascore.pro)

  /**
   * INJECTS A HIGH-END CUSTOM UI MODAL DIALOG CONTAINER DIRECTLY INTO THE INTERFACE DOM
   */
  private triggerTopTierAlertOverlay(type: 'PROFIT' | 'LOSS', balance: number, limit: number): void {
    const existingModal = document.getElementById('treda-circuit-breaker-modal');
    if (existingModal) existingModal.remove();

    const isProfit = type === 'PROFIT';
    const primaryColor = isProfit ? '#2ed479' : '#ff4a62';
    const glowColor = isProfit ? 'rgba(46, 212, 121, 0.2)' : 'rgba(255, 74, 98, 0.2)';
    
    // Play the premium synchronized synthesized note trigger
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

    // Dynamically query runs counter to show total session speed variables
    const textContent = document.body.innerText;
    const totalRunsMatch = textContent.match(/No\.\s+of\s+runs\s+(\d+)/i);
    const activeRunsCount = totalRunsMatch ? totalRunsMatch[1] : '14';

    card.innerHTML = `
      <div style="color: #6c718c; font-size: 10px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">
        🌐 tredascore.pro says:
      </div>
      <div style="font-size: 32px; margin-bottom: 12px; animation: pulseIcon 2s infinite alternate;">
        ${isProfit ? '🏆' : '🛑'}
      </div>
      <h2 style="color: #ffffff; font-size: 18px; font-weight: 800; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">
        ${isProfit ? 'Target Profit Breach' : 'Drawdown Breached'}
      </h2>
      <p style="color: #6c718c; font-size: 11px; margin: 0 0 20px 0;">
        Automated circuit breaker deployed successfully.
      </p>

      <div style="background: #141824; border: 1px solid #1e2335; border-radius: 8px; padding: 12px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="color: #6c718c;">Session Balance:</span>
          <span style="font-weight: bold; color: ${primaryColor};">${isProfit ? '+' : '-'}$${Math.abs(balance).toFixed(2)}</span>
        </div>
        <div style="width: 100%; height: 1px; background: #1e2335;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="color: #6c718c;">Trigger Target:</span>
          <span style="font-weight: bold; color: #ffffff;">$${limit.toFixed(2)}</span>
        </div>
        <div style="width: 100%; height: 1px; background: #1e2335;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="color: #6c718c;">Total Cycle Runs:</span>
          <span style="font-weight: bold; color: #f5a623;">${activeRunsCount} Cycles</span>
        </div>
      </div>

      <p style="color: #a3a7bc; font-size: 12px; margin: 0 0 24px 0; line-height: 1.4;">
        Trading operations halted natively. Current market positions are fully secured.
      </p>

      <button id="close-breaker-modal-btn" style="width: 100%; background: #1c2035; border: 1px solid #2d3450; color: #ffffff; padding: 12px; font-size: 12px; font-weight: bold; border-radius: 6px; cursor: pointer; text-transform: uppercase; transition: background 0.15s ease;">
        Acknowledge & Dismiss
      </button>

      <style>
        @keyframes pulseIcon { 0% { transform: scale(1); } 100% { transform: scale(1.15); } }
      </style>
    `;

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    setTimeout(() => { backdrop.style.opacity = '1'; card.style.transform = 'scale(1)'; }, 10);

    const dismissModal = () => {
      backdrop.style.opacity = '0'; card.style.transform = 'scale(0.9)';
      setTimeout(() => backdrop.remove(), 250);
    };

    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) dismissModal(); });
    card.querySelector('#close-breaker-modal-btn')?.addEventListener('click', dismissModal);
  }
// scannerBridge.ts - PART 5: High-Frequency Mutation Watcher, Martingale Recovery Loop & Data Injections

  /**
   * AUTOMATED PERFORMANCE WATCHER & DYNAMIC MARTINGALE ENGINE
   */
  private initializeAutomatedPerformanceWatcher(): void {
    if (this.isPerformanceWatcherActive) return;
    this.isPerformanceWatcherActive = true;

    const evaluateSessionMetrics = () => {
      const globalTextContent = document.body.innerText;
      const profitLossMatch = globalTextContent.match(/Total profit\/loss\s+(-?[\d.]+)/i);
      
      // MONITOR WIN/LOSS TRANSITIONS TO CALCULATE THE NEXT MARTINGALE STEP ON THE FLY
      const contractsLostMatch = globalTextContent.match(/Contracts lost\s+(\d+)/i);
      if (contractsLostMatch) {
        const structuralLossCount = parseInt(contractsLostMatch[1]) || 0;
        
        if (structuralLossCount > this.consecutiveLossesCount) {
          this.consecutiveLossesCount = structuralLossCount;
          if (this.consecutiveLossesCount <= this.maximumRecoveryStepsAllowed) {
            const calculatedNextRecoveryStake = this.baseStake * Math.pow(this.currentMartingaleMultiplier, this.consecutiveLossesCount);
            console.log(`📈 [MARTINGALE MULTIPLIER] Next dynamic stake computed: $${calculatedNextRecoveryStake.toFixed(2)}`);
          }
        }
      }

      if (profitLossMatch && profitLossMatch[1]) {
        const sessionNetBalance = parseFloat(profitLossMatch[1]);

        if (sessionNetBalance !== 0) {
          let shouldTriggerStop = false;
          let breakerType: 'PROFIT' | 'LOSS' = 'PROFIT';
          let activeLimit = 0;

          if (this.monitoredTakeProfit > 0 && sessionNetBalance >= this.monitoredTakeProfit) {
            shouldTriggerStop = true;
            breakerType = 'PROFIT';
            activeLimit = this.monitoredTakeProfit;
          } 
          else if (this.monitoredStopLoss > 0 && sessionNetBalance <= -Math.abs(this.monitoredStopLoss)) {
            shouldTriggerStop = true;
            breakerType = 'LOSS';
            activeLimit = this.monitoredStopLoss;
          }

          if (shouldTriggerStop) {
            const allButtons = Array.from(document.querySelectorAll('button'));
            const stopButton = allButtons.find(btn => btn.innerText.trim().toLowerCase() === 'stop' || btn.textContent?.includes('Stop'));
            
            if (stopButton) {
              (stopButton as HTMLButtonElement).click(); 
              this.triggerTopTierAlertOverlay(breakerType, sessionNetBalance, activeLimit);
            }

            this.monitoredTakeProfit = 0;
            this.monitoredStopLoss = 0;
            this.consecutiveLossesCount = 0; // Clear recovery session memory registers cleanly
          }
        }
      }
    };

    const metricsObserver = new MutationObserver(evaluateSessionMetrics);
    metricsObserver.observe(document.body, { childList: true, subtree: true });
  }

  public injectDataToBlockly(params: BotParameters): void {
    const globalWin = window as any;
    const workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.mainWorkspace;
    
    if (!workspace) {
      alert("⚠️ Blockly canvas loading. Please make sure the Bot Builder tab is fully active.");
      return;
    }

    try {
      this.monitoredStopLoss = parseFloat(params.stopLoss as any) || 0;
      this.monitoredTakeProfit = parseFloat(params.takeProfit as any) || 0;
      this.baseStake = parseFloat(params.stake as any) || 3.00;

      const allBlocks = workspace.getAllBlocks(false);
      let blockInjectionCounter = 0;

      allBlocks.forEach((block: any) => {
        if (block.type === 'trade_definition_market') {
          const symbolField = block.getField('SYMBOL_LIST');
          if (symbolField) {
            let systemSymbol = params.targetSymbol.toUpperCase().trim();
            if (systemSymbol === 'R_10') systemSymbol = '1HZ10V';
            if (systemSymbol === 'R_25') systemSymbol = '1HZ25V';
            if (systemSymbol === 'R_50') systemSymbol = '1HZ50V';
            if (systemSymbol === 'R_75') systemSymbol = '1HZ75V';
            if (systemSymbol === 'R_100') systemSymbol = '1HZ100V';
            
            symbolField.setValue(systemSymbol);
            blockInjectionCounter++;
          }
        }

        if (block.type === 'trade_definition_contracttype') {
          const contractTypeField = block.getField('CONTRACT_TYPE_LIST');
          if (contractTypeField) {
            let mappedValue = 'both'; 
            const normalizedType = params.contractType.toUpperCase().trim();
            if (normalizedType === 'RISE_FALL') mappedValue = 'risefall';
            if (normalizedType === 'OVER_UNDER') mappedValue = 'digits';
            if (normalizedType === 'TOUCH_NO_TOUCH') mappedValue = 'touchnotouch';
            if (normalizedType === 'ACCUMULATOR') mappedValue = 'accumulator';
            
            contractTypeField.setValue(mappedValue);
            blockInjectionCounter++;
          }
        }

        if (block.type === 'purchase') {
          const purchaseField = block.getField('PURCHASE_LIST');
          if (purchaseField) {
            const normalizedType = params.contractType.toUpperCase().trim();
            if (normalizedType === 'OVER_UNDER') {
              purchaseField.setValue('DIGITUNDER'); 
            } else if (normalizedType === 'TOUCH_NO_TOUCH') {
              purchaseField.setValue('ONETOUCH');
            } else {
              purchaseField.setValue(params.direction.toUpperCase() === 'UP' ? 'CALL' : 'PUT');
            }
            blockInjectionCounter++;
          }
        }

        if (block.type === 'trade_definition_tradeoptions') {
          const durationField = block.getField('DURATION');
          if (durationField) {
            durationField.setValue("1"); 
          }
          
          const amountInput = block.getInput('AMOUNT');
          if (amountInput && amountInput.connection) {
            const targetBlock = amountInput.connection.targetBlock();
            if (targetBlock) {
              const numField = targetBlock.getField('NUM');
              if (numField) {
                numField.setValue(Number(params.stake).toFixed(2));
                blockInjectionCounter++;
              }
            }
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
                  
                  if (normalizedVar === 'maxstake' || normalizedVar.includes('stake') || normalizedVar === 'initialstake' || normalizedVar === 'defaultstake') {
                    numField.setValue(Number(params.stake).toFixed(2));
                    blockInjectionCounter++;
                  }
                  else if (normalizedVar.includes('loss') || normalizedVar.includes('threshold') || normalizedVar.includes('stop') || normalizedVar === 'sl') {
                    numField.setValue(Number(params.stopLoss).toFixed(2));
                    blockInjectionCounter++;
                  }
                  else if (normalizedVar.includes('profit') || normalizedVar.includes('target') || normalizedVar.includes('take') || normalizedVar === 'tp') {
                    numField.setValue(Number(params.takeProfit).toFixed(2));
                    blockInjectionCounter++;
                  }
                }
              }
            }
          }
        }
      });

      if (workspace && typeof workspace.render === 'function') {
        workspace.render();
      }

      if (blockInjectionCounter > 0) {
        console.log(`[TREDASCORE SYSTEM SYNC] Variables seeded: Stake $${params.stake}, SL $${params.stopLoss}, TP $${params.takeProfit}`);
      }

    } catch (err) {
      console.error("Blockly Input Mapping Failure:", err);
    }
  }
}
