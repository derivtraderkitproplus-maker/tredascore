// scannerBridge.ts

export type TickCallback = (symbol: string, tick: number) => void;

export interface BotParameters {
  direction: string;
  stake: number;
  stopLoss: number;
  takeProfit: number;
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

  public initPipeline(symbols: string[], onTick: TickCallback): void {
    this.onTickCallback = onTick;
    this.activeSymbols = symbols.map(s => (s === 'R_100' || s === 'Volatility 100 (1s) Index' || s === '1HZ100V') ? '1HZ100V' : s);

    this.extractSystemSocket();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.boundMessageHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.msg_type === 'tick' && data.tick) {
            const { symbol, quote } = data.tick;
            if (this.activeSymbols.includes(symbol)) {
              this.onTickCallback?.(symbol, parseFloat(quote));
            }
          }
        } catch (e) {}
      };
      this.ws.addEventListener('message', this.boundMessageHandler);
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

      allBlocks.forEach((block: any) => {
        // A. Inject entry asset buy direction (CALL vs PUT)
        if (block.type === 'purchase') {
          const purchaseField = block.getField('PURCHASE_LIST');
          if (purchaseField) {
            purchaseField.setValue(params.direction === 'UP' ? 'CALL' : 'PUT');
          }
        }

        // B. FIXED: Safely targets separate child inputs within the blockly schema structure
        if (block.type === 'trade_definition_tradeoptions') {
          // Explicitly lock your option duration to a safe, valid 1 tick boundary limit
          const durationField = block.getField('DURATION');
          if (durationField) {
            durationField.setValue("1"); 
          }
          
          // Hunt inside structural inputs to map the proper Stake field values
          const amountInput = block.getInput('AMOUNT');
          if (amountInput && amountInput.connection && amountInput.connection.targetBlock()) {
            const stakeBlock = amountInput.connection.targetBlock();
            const numField = stakeBlock.getField('NUM');
            if (numField) {
              numField.setValue(params.stake.toString());
            }
          }
        }

        // C. Clean updates for user canvas variables (maxStake, etc.)
        if (block.type === 'variables_set') {
          const fieldVar = block.getField('VAR');
          if (fieldVar) {
            const variableName = fieldVar.getText();
            const valueInput = block.getInput('VALUE');
            
            if (valueInput && valueInput.connection && valueInput.connection.targetBlock()) {
              const targetBlock = valueInput.connection.targetBlock();
              const numField = targetBlock.getField('NUM');
              
              if (numField) {
                if (variableName === 'maxStake') {
                  numField.setValue(params.stake.toString());
                }
                if (variableName.toLowerCase().includes('loss') || variableName.toLowerCase().includes('threshold')) {
                  numField.setValue(params.stopLoss.toString());
                }
                if (variableName.toLowerCase().includes('profit') || variableName.toLowerCase().includes('target')) {
                  numField.setValue(params.takeProfit.toString());
                }
              }
            }
          }
        }
      });

      // Synchronize workspace adjustments
      if (typeof workspace.render === 'function') {
        workspace.render();
      }

      alert("you have successfully imported a bot, click run");

    } catch (err) {
      console.error("Blockly Input Mapping Failure:", err);
    }
  }

  public closePipeline(): void {
    if (this.ws && this.boundMessageHandler) {
      this.ws.removeEventListener('message', this.boundMessageHandler);
    }
  }
}
