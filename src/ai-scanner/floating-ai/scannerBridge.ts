// scannerBridge.ts

export type TickCallback = (symbol: string, tick: number) => void;

export class DerivScannerBridge {
  private ws: WebSocket | null = null;
  private onTickCallback: TickCallback | null = null;
  private activeSymbols: string[] = [];
  private boundMessageHandler: ((event: MessageEvent) => void) | null = null;

  constructor(private appCtx: any) {
    this.locateWebSocket();
  }

  private locateWebSocket(): void {
    const globalWin = window as any;
    
    // Checks every possible global workspace memory path for an active socket connection
    this.ws = 
      globalWin.derivWebSocket || 
      globalWin.ws || 
      globalWin.socket || 
      globalWin.g_wallet_socket ||
      globalWin.Blockly?.derivWorkspace?.socket ||
      (globalWin.Blockly?.derivWorkspace?.connection_?.websocket_);

    if (!this.ws && this.appCtx) {
      this.ws = this.appCtx.websocketInstance || this.appCtx.ws || this.appCtx.socket;
    }
  }

  public initPipeline(symbols: string[], onTick: TickCallback): void {
    this.onTickCallback = onTick;
    
    // FIXED: Maps your client choice strings to standard Deriv server syntax
    this.activeSymbols = symbols.map(s => s === 'R_100' ? '1HZ100V' : s);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.locateWebSocket();
    }

    if (!this.ws) {
      setTimeout(() => this.initPipeline(symbols, onTick), 1000);
      return;
    }

    if (this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.addEventListener('open', () => this.initPipeline(symbols, onTick), { once: true });
      return;
    }

    this.boundMessageHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.msg_type === 'tick' && data.tick) {
          const { symbol, quote } = data.tick;
          if (this.activeSymbols.includes(symbol)) {
            this.onTickCallback?.(symbol, parseFloat(quote));
          }
        }
        
        if (data.msg_type === 'ticks_history' && data.history) {
          const symbol = data.echo_req.ticks_history;
          const prices: number[] = data.history.prices;
          if (this.activeSymbols.includes(symbol) && prices) {
            prices.forEach(p => this.onTickCallback?.(symbol, Number(p)));
          }
        }
      } catch (e) {}
    };

    this.ws.addEventListener('message', this.boundMessageHandler);

    this.activeSymbols.forEach(symbol => {
      try {
        // Instantly requests 100 historical snapshots to unfreeze the counter from 0/100
        this.ws?.send(JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          count: 100,
          end: "latest",
          start: 1
        }));

        this.ws?.send(JSON.stringify({ ticks: symbol }));
      } catch (err) {}
    });
  }

  public closePipeline(): void {
    if (this.ws && this.boundMessageHandler) {
      this.ws.removeEventListener('message', this.boundMessageHandler);
    }
    this.activeSymbols.forEach(symbol => {
      try {
        this.ws?.send(JSON.stringify({ forget: symbol }));
      } catch (e) {}
    });
  }
}
