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
      this.ws = this.appCtx.websocketInstance || this.appCtx.ws || this.appCtx.socket || this.appCtx.api?.api?.ws;
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
      console.warn("AI Loader Bridge: Workspace could not be found.");
      return;
    }

    try {
      const allBlocks = workspace.getAllBlocks(false);

      allBlocks.forEach((block: any) => {
        if (block.type === 'purchase') {
          const purchaseField = block.getField('PURCHASE_LIST');
          if (purchaseField) {
            purchaseField.setValue(params.direction === 'UP' ? 'CALL' : 'PUT');
          }
        }

        if (block.type === 'variables_set') {
          const fieldVar = block.getField('VAR');
          if (fieldVar) {
            const variableName = fieldVar.getText();
            const valueInput = block.getInput('VALUE');
            
            if (valueInput && valueInput.connection && valueInput.connection.targetBlock()) {
              const targetBlock = valueInput.connection.targetBlock();
              const numField = targetBlock.getField('NUM');
              
              if (numField) {
                if (variableName.toLowerCase().includes('stake')) {
                  numField.setValue(params.stake.toString());
                }
                if (variableName.toLowerCase().includes('loss')) {
                  numField.setValue(params.stopLoss.toString());
                }
                if (variableName.toLowerCase().includes('profit')) {
                  numField.setValue(params.takeProfit.toString());
                }
              }
            }
          }
        }
      });

      alert("🎉 Strategy parameters successfully loaded to blocks! Click 'Run' to activate the execution sequence.");
    } catch (err) {
      console.error("AI Loader Matrix Error:", err);
    }
  }

  public closePipeline(): void {
    if (this.ws && this.boundMessageHandler) {
      this.ws.removeEventListener('message', this.boundMessageHandler);
    }
  }
}
