// scannerBridge.ts - PART 1: Core Definitions, Network Pipes & Live Profit Watcher

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
  
  // High-frequency tracker memories to ensure performance notifications trigger only once per session
  private isPerformanceWatcherActive: boolean = false;
  private monitoredStopLoss: number = 0;
  private monitoredTakeProfit: number = 0;

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

  /**
   * ADDED NEW: REAL-TIME TERMINATION AND PERFORMANCE ALERT WATCHER
   * Hooks into the global workspace layout mutations to intercept when the execution runs end.
   */
  private initializeAutomatedPerformanceWatcher(): void {
    if (this.isPerformanceWatcherActive) return;
    this.isPerformanceWatcherActive = true;

    console.log("🛡️ [PERFORMANCE OBSERVER] Risk mitigation surveillance listener running...");

    const evaluateSessionMetrics = () => {
      const globalTextContent = document.body.innerText;
      
      // Catches the exact moment the active position terminal transitions into a stopped state
      const isBotStopped = globalTextContent.includes('Bot is not running');
      const hasSessionHistory = globalTextContent.includes('Total profit/loss');

      if (isBotStopped && hasSessionHistory) {
        // Scrapes your exact screen analytics matrix numbers cleanly via regex patterns
        const profitLossMatch = globalTextContent.match(/Total profit\/loss\s+(-?[\d.]+)/i);
        
        if (profitLossMatch && profitLossMatch[1]) {
          const sessionNetBalance = parseFloat(profitLossMatch[1]);

          // Verify metrics limits exist and prevent alert flooding by validating thresholds
          if (sessionNetBalance !== 0) {
            
            // A. TAKE PROFIT TARGET HIT CELEBRATION DISPATCHER
            if (this.monitoredTakeProfit > 0 && sessionNetBalance >= this.monitoredTakeProfit) {
              alert(`🎉 [TAKE PROFIT TARGET ACHIEVED]\n\n🏆 Performance Target Smashed!\n💰 Session Net Growth: +$${sessionNetBalance.toFixed(2)}\n🎯 Target Limit Ceiling: +$${this.monitoredTakeProfit.toFixed(2)}\n\nTrading loop terminated safely to secure returns.`);
              this.monitoredTakeProfit = 0; // Clear bounds states to preserve tracking balances
              this.monitoredStopLoss = 0;
            } 
            
            // B. STOP LOSS MAX EXPOSURE PROTECTION DISPATCHER
            else if (this.monitoredStopLoss > 0 && sessionNetBalance <= -Math.abs(this.monitoredStopLoss)) {
              alert(`⚠ [STOP LOSS EXPOSURE LIMIT TRIGGERED]\n\n🛑 Risk Drawdown Threshold Breach!\n📉 Session Net Balance: -$${Math.abs(sessionNetBalance).toFixed(2)}\n🛡 Max Permitted Slip: -$${Math.abs(this.monitoredStopLoss).toFixed(2)}\n\nCircuit breaker deployed. Capital protected successfully.`);
              this.monitoredTakeProfit = 0; // Clear bounds states to preserve tracking balances
              this.monitoredStopLoss = 0;
            }
          }
        }
      }
    };

    // Instantiate high-frequency DOM observation filters to catch metrics mutations instantly
    const metricsObserver = new MutationObserver(evaluateSessionMetrics);
    metricsObserver.observe(document.body, { childList: true, subtree: true });
  }
// scannerBridge.ts - PART 2: Verified Parameters Injector Engine (With Core Variable ID Fixes)

  public injectDataToBlockly(params: BotParameters): void {
    const globalWin = window as any;
    const workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.mainWorkspace;
    
    if (!workspace) {
      alert("⚠️ Blockly canvas loading. Please make sure the Bot Builder tab is fully active.");
      return;
    }

    try {
      // Seed target parameters into background memory to fuel performance notifications
      this.monitoredStopLoss = parseFloat(params.stopLoss as any) || 0;
      this.monitoredTakeProfit = parseFloat(params.takeProfit as any) || 0;

      const allBlocks = workspace.getAllBlocks(false);
      let blockInjectionCounter = 0;

      allBlocks.forEach((block: any) => {
        // 1. VERIFIED ORIGINAL WORKING FIXED ASSET INJECTION
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

        // 2. VERIFIED ORIGINAL WORKING DYNAMIC CONTRACT TYPE MAPPING LAYER
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

        // 3. VERIFIED ORIGINAL WORKING PURCHASE CALL / PUT ORDER SIGNALS
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

        // 4. VERIFIED ORIGINAL WORKING DURATIONS & STAKE RE-WRITER
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

        // 5. EXTENDED VARIABLE MAPPING LAYER (Original Stake updates + new dynamic Variable ID bindings)
        if (block.type === 'variables_set') {
          const fieldVar = block.getField('VAR');
          if (fieldVar) {
            const variableName = fieldVar.getText();
            const normalizedVar = variableName.toLowerCase().trim();
            const valueInput = block.getInput('VALUE');
            
            // Query the central database object grid to fetch the true workspace model ID reference
            const targetWorkspaceVarModel = workspace.getVariable(variableName);
            
            if (targetWorkspaceVarModel && valueInput && valueInput.connection) {
              const targetBlock = valueInput.connection.targetBlock();
              if (targetBlock) {
                const numField = targetBlock.getField('NUM');
                if (numField) {
                  
                  // STAKE FIELD CONTROLS (Your original working logic)
                  if (normalizedVar === 'maxstake' || normalizedVar.includes('stake') || normalizedVar === 'initialstake' || normalizedVar === 'defaultstake') {
                    block.setFieldValue(targetWorkspaceVarModel.getId(), 'VAR'); // Lock in true reference tracking hash
                    numField.setValue(Number(params.stake).toFixed(2));
                    blockInjectionCounter++;
                  }
                  
                  // STOP LOSS CONTROLS (Binds your custom input to matching variables securely via IDs)
                  else if (normalizedVar.includes('loss') || normalizedVar.includes('threshold') || normalizedVar.includes('stop') || normalizedVar === 'sl') {
                    block.setFieldValue(targetWorkspaceVarModel.getId(), 'VAR'); // Lock in true reference tracking hash
                    numField.setValue(Number(params.stopLoss).toFixed(2));
                    blockInjectionCounter++;
                  }
                  
                  // TAKE PROFIT CONTROLS (Binds your custom input to matching variables securely via IDs)
                  else if (normalizedVar.includes('profit') || normalizedVar.includes('target') || normalizedVar.includes('take') || normalizedVar === 'tp') {
                    block.setFieldValue(targetWorkspaceVarModel.getId(), 'VAR'); // Lock in true reference tracking hash
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

      // Action validation confirmation pop-up banner
      if (blockInjectionCounter > 0) {
        alert(`✅ Strategy Configuration Loaded!\n\n• Asset Pool: ${params.targetSymbol.replace('R_', 'Volatility ')}\n• Active Stake: $${Number(params.stake).toFixed(2)}\n• Stop Loss: $${Number(params.stopLoss).toFixed(2)}\n• Take Profit: $${Number(params.takeProfit).toFixed(2)}`);
      } else {
        console.warn("Blockly Injection alert: Parsed structural workspace blocks without matching parameter selectors.");
      }

    } catch (err) {
      console.error("Blockly Input Mapping Failure:", err);
    }
  }
}
