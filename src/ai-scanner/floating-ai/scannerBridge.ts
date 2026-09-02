// scannerBridge.ts

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

  constructor(private appCtx: any) {
    this.extractSystemSocket();
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
    // 💥 FIX 2: Prevent memory leaks and lagging UIs by clearing old listeners first
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

  public injectDataToBlockly(params: BotParameters): void {
    const globalWin = window as any;
    const workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.mainWorkspace;
    
    if (!workspace) {
      alert("⚠️ Blockly canvas loading. Please make sure the Bot Builder tab is fully active.");
      return;
    }

    try {
      const allBlocks = workspace.getAllBlocks(false);
      let blockInjectionCounter = 0;

      allBlocks.forEach((block: any) => {
        // 1. FIXED ASSET INJECTION (Keeps variable names consistent for clean commission routing)
        if (block.type === 'trade_definition_market') {
          const symbolField = block.getField('SYMBOL_LIST');
          if (symbolField) {
            let systemSymbol = params.targetSymbol.toUpperCase().trim();
            // Fallback checking to keep data formats aligned across platforms
            if (systemSymbol === 'R_10') systemSymbol = '1HZ10V';
            if (systemSymbol === 'R_25') systemSymbol = '1HZ25V';
            if (systemSymbol === 'R_50') systemSymbol = '1HZ50V';
            if (systemSymbol === 'R_75') systemSymbol = '1HZ75V';
            if (systemSymbol === 'R_100') systemSymbol = '1HZ100V';
            
            symbolField.setValue(systemSymbol);
            blockInjectionCounter++;
          }
        }

        // 2. DYNAMIC CONTRACT TYPE MAPPING LAYER
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

        // 3. PURCHASE CALL / PUT ORDER SIGNALS
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

        // 4. DURATIONS & FLOATING POINT STAKE RE-WRITER
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
                // Force clean 2-decimal strings to prevent server rejection errors
                numField.setValue(Number(params.stake).toFixed(2));
                blockInjectionCounter++;
              }
            }
          }
        }

        // 5. AUTO-FALLBACK VARIABLE MAPPING (Secures Risk Controls)
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
                  
                  if (normalizedVar === 'maxstake' || normalizedVar.includes('stake') || normalizedVar === 'initialstake') {
                    numField.setValue(Number(params.stake).toFixed(2));
                    blockInjectionCounter++;
                  }
                  if (normalizedVar.includes('loss') || normalizedVar.includes('threshold') || normalizedVar.includes('stop')) {
                    numField.setValue(params.stopLoss.toString());
                    blockInjectionCounter++;
                  }
                  if (normalizedVar.includes('profit') || normalizedVar.includes('target') || normalizedVar.includes('take')) {
                    numField.setValue(params.takeProfit.toString());
                    blockInjectionCounter++;
                  }
                }
              }
            }
          }
        }
      });

      if (typeof workspace.render === 'function') {
        workspace.render();
      }

      // Operational success validation modal
      if (blockInjectionCounter > 0) {
        alert(`✅ Parameters Optimized Successfully!\nAsset Pool: ${params.targetSymbol.replace('R_', 'Volatility ')}\nTrading Mode: ${params.contractType}`);
      } else {
        console.warn("Blockly Injection alert: Parsed structural workspace blocks without matching parameter selectors.");
      }

    } catch (err) {
      console.error("Blockly Input Mapping Failure:", err);
    }
  }
}
