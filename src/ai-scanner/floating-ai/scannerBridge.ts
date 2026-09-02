// scannerBridge.ts - PART 1: Tickers Standardizer & WebSocket Listener Bridge
export type TickCallback = (symbol: string, tick: number) => void;

export interface BotParameters {
  direction: string;
  stake: number;
  stopLoss: number;
  takeProfit: number;
  contractType: string;  // Added configuration mapping to mirror engine properties
  targetSymbol: string;  // Target index e.g., 'R_50'
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

  // Normalizes varying API symbol keys into standard engine tokens
  private normalizeSymbolString(s: string): string {
    const term = s.toUpperCase();
    if (term.includes('1HZ10V') || term === 'R_10') return 'R_10';
    if (term.includes('1HZ25V') || term === 'R_25') return 'R_25';
    if (term.includes('1HZ50V') || term === 'R_50') return 'R_50';
    if (term.includes('1HZ75V') || term === 'R_75') return 'R_75';
    if (term.includes('1HZ100V') || term === 'R_100') return 'R_100';
    return s;
  }

  // Maps clean code arrays out to match system level tick events
  private checkSymbolMatch(incoming: string, registered: string): boolean {
    return this.normalizeSymbolString(incoming) === this.normalizeSymbolString(registered);
  }

  public initPipeline(symbols: string[], onTick: TickCallback): void {
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
      this.ws.removeEventListener('message', this.boundMessageHandler);
    }
  }
// scannerBridge.ts - PART 2: Stable Blockly Workspace Canvas Injection Logic
  public injectDataToBlockly(params: BotParameters): void {
    const globalWin = window as any;
    const workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.mainWorkspace;
    
    if (!workspace) {
      alert("⚠️ Blockly canvas loading. Please make sure the Bot Builder tab is fully active.");
      return;
    }

    try {
      const allBlocks = workspace.getAllBlocks(false);

      // Parse current numbers explicitly into verified floats
      const finalStake = parseFloat(params.stake.toString()) || 0;
      const finalLoss = parseFloat(params.stopLoss.toString()) || 0;
      const finalProfit = parseFloat(params.takeProfit.toString()) || 0;

      allBlocks.forEach((block: any) => {
        // 1. DYNAMIC ASSET & MARKET TYPE INJECTION
        if (block.type === 'trade_definition_market') {
          const symbolField = block.getField('SYMBOL_LIST');
          if (symbolField) {
            let systemSymbol = params.targetSymbol;
            if (params.targetSymbol === 'R_10') systemSymbol = '1HZ10V';
            if (params.targetSymbol === 'R_25') systemSymbol = '1HZ25V';
            if (params.targetSymbol === 'R_50') systemSymbol = '1HZ50V';
            if (params.targetSymbol === 'R_75') systemSymbol = '1HZ75V';
            if (params.targetSymbol === 'R_100') systemSymbol = '1HZ100V';
            symbolField.setValue(systemSymbol);
          }
        }

        // 2. DYNAMIC CONTRACT TYPE MAPPING LAYER
        if (block.type === 'trade_definition_contracttype') {
          const contractTypeField = block.getField('CONTRACT_TYPE_LIST');
          if (contractTypeField) {
            let mappedValue = 'both'; 
            if (params.contractType === 'RISE_FALL') mappedValue = 'risefall';
            if (params.contractType === 'OVER_UNDER') mappedValue = 'digits';
            if (params.contractType === 'TOUCH_NO_TOUCH') mappedValue = 'touchnotouch';
            if (params.contractType === 'ACCUMULATOR') mappedValue = 'accumulator';
            contractTypeField.setValue(mappedValue);
          }
        }

        // 3. PURCHASE CALL / PUT ORDER SIGNALS
        if (block.type === 'purchase') {
          const purchaseField = block.getField('PURCHASE_LIST');
          if (purchaseField) {
            if (params.contractType === 'OVER_UNDER') {
              purchaseField.setValue('DIGITUNDER'); 
            } else if (params.contractType === 'TOUCH_NO_TOUCH') {
              purchaseField.setValue('ONETOUCH');
            } else {
              purchaseField.setValue(params.direction === 'UP' ? 'CALL' : 'PUT');
            }
          }
        }

        // 4. DURATIONS & FIXED INPUT CONTROLLER STAKE FIELDS
        if (block.type === 'trade_definition_tradeoptions') {
          const durationField = block.getField('DURATION');
          if (durationField) {
            durationField.setValue("1"); 
          }
          
          const amountInput = block.getInput('AMOUNT');
          if (amountInput && amountInput.connection && amountInput.connection.targetBlock()) {
            const stakeBlock = amountInput.connection.targetBlock();
            const numField = stakeBlock.getField('NUM');
            if (numField) {
              numField.setValue(finalStake.toFixed(2));
            }
          }
        }

        // 5. VISUAL VARIABLE TILES SYNC LAYER (Safely updates input values)
        if (block.type === 'variables_set') {
          const fieldVar = block.getField('VAR');
          if (fieldVar) {
            const variableName = fieldVar.getText();
            const valueInput = block.getInput('VALUE');
            
            if (valueInput && valueInput.connection && valueInput.connection.targetBlock()) {
              const targetBlock = valueInput.connection.targetBlock();
              const numField = targetBlock.getField('NUM');
              
              if (numField) {
                if (variableName === 'maxStake' || variableName.toLowerCase().includes('stake')) {
                  numField.setValue(finalStake.toFixed(2));
                }
                if (variableName.toLowerCase().includes('loss') || variableName.toLowerCase().includes('threshold')) {
                  numField.setValue(finalLoss.toFixed(2));
                }
                if (variableName.toLowerCase().includes('profit') || variableName.toLowerCase().includes('target')) {
                  numField.setValue(finalProfit.toFixed(2));
                }
              }
            }
          }
        }
      });

      // --- 🛡️ CRASH-SAFE RUNTIME VALUE OVERRIDES ---
      // Safely binds values to global tracking keys to handle variations 
      // in how the strategy templates are configured.
      const variableMap = workspace.getVariableMap ? workspace.getVariableMap() : null;
      if (variableMap) {
        const totalVariablesList = variableMap.getAllVariables();
        totalVariablesList.forEach((v: any) => {
          const rawName = v.name;
          const vName = rawName.toLowerCase();
          
          if (vName === 'maxstake' || vName.includes('stake')) {
            globalWin[v.id_] = finalStake;
            globalWin[rawName] = finalStake;
          }
          if (vName.includes('loss') || vName.includes('threshold')) {
            globalWin[v.id_] = finalLoss;
            globalWin[rawName] = finalLoss;
          }
          if (vName.includes('profit') || vName.includes('target')) {
            globalWin[v.id_] = finalProfit;
            globalWin[rawName] = finalProfit;
          }
        });
      }

      // Explicit global system overrides for common bot configurations
      globalWin.maxStake = finalStake;
      globalWin.stake = finalStake;
      globalWin.takeProfit = finalProfit;
      globalWin.profitTarget = finalProfit;
      globalWin.stopLoss = finalLoss;
      globalWin.lossThreshold = finalLoss;

      if (typeof workspace.render === 'function') {
        workspace.render();
      }

      alert(`Bot imported successfully!\nAsset: ${params.targetSymbol.replace('R_', 'Volatility ')}\nEngine Strategy Type: ${params.contractType}`);

    } catch (err) {
      console.error("Blockly Input Mapping Failure:", err);
    }
  }
}
