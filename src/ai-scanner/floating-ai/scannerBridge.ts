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
      let stakeLoaded = false;
      let maxStakeLoaded = false;

      allBlocks.forEach((block: any) => {
        // A. Inject Entry Conditions directly into Purchase Choice drop-down block field
        if (block.type === 'purchase') {
          const purchaseField = block.getField('PURCHASE_LIST');
          if (purchaseField) {
            purchaseField.setValue(params.direction === 'UP' ? 'CALL' : 'PUT');
          }
        }

        // B. Target the native block inline trade options Stake token block element field
        if (block.type === 'trade_definition_tradeoptions') {
          const stakeField = block.getField('AMOUNT');
          if (stakeField) {
            stakeField.setValue(params.stake.toString());
            stakeLoaded = true;
          }
        }

        // C. Update the variable block inputs matching 'maxStake' text structures seen on your canvas layout
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
                  maxStakeLoaded = true;
                }
                // Adaptive variable matching checks for target loss threshold conditions
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

      // D. Fallback block parser: Updates any disconnected custom block fields
      if (!stakeLoaded || !maxStakeLoaded) {
        allBlocks.forEach((b: any) => {
          if (b.getField('NUM') && b.getParent()?.type === 'trade_definition_tradeoptions') {
            b.getField('NUM').setValue(params.stake.toString());
          }
        });
      }

      // Re-render block alignments across your active canvas layout workspace safely
      if (typeof workspace.render === 'function') {
        workspace.render();
      }

      // FIXED NOTIFICATION STRING LOGIC BLOCK TEXT NODES
      alert("you have successfully imported a bot, click run");

    } catch (err) {
      console.error("Blockly Input Sync Failure:", err);
    }
  }

  public closePipeline(): void {
    if (this.ws && this.boundMessageHandler) {
      this.ws.removeEventListener('message', this.boundMessageHandler);
    }
  }
}
