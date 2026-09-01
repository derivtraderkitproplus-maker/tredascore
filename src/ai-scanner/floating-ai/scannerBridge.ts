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

  // DEEP DOM INJECTOR LOOKUP - Scans the browser memory for any active open broker lines
  private locateWebSocket(): void {
    const globalWin = window as any;
    
    // Iterates through all common names used by binary/deriv platforms
    this.ws = 
      globalWin.derivWebSocket || 
      globalWin.ws || 
      globalWin.socket || 
      globalWin.g_wallet_socket ||
      globalWin.Blockly?.derivWorkspace?.socket;

    // Advanced fallbacks: Probes inside your application store maps for standard socket structures
    if (!this.ws && this.appCtx) {
      this.ws = this.appCtx.websocketInstance || this.appCtx.ws || this.appCtx.socket;
    }
  }

  public initPipeline(symbols: string[], onTick: TickCallback): void {
    this.onTickCallback = onTick;
    this.activeSymbols = symbols;

    // Force a fresh memory lookup if connection was previously dropped
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.locateWebSocket();
    }

    if (!this.ws) {
      console.warn("AI Pipeline Mirroring: Socket handle missing from client container stack. Re-polling...");
      setTimeout(() => this.initPipeline(symbols, onTick), 1500);
      return;
    }

    if (this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.addEventListener('open', () => this.initPipeline(symbols, onTick), { once: true });
      return;
    }

    this.boundMessageHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Catches regular continuous live price streams
        if (data.msg_type === 'tick' && data.tick) {
          const { symbol, quote } = data.tick;
          if (this.activeSymbols.includes(symbol)) {
            this.onTickCallback?.(symbol, parseFloat(quote));
          }
        }
        
        // Captures historical snapshot pre-fill data blocks
        if (data.msg_type === 'ticks_history' && data.history) {
          const symbol = data.echo_req.ticks_history;
          const prices: number[] = data.history.prices;
          if (this.activeSymbols.includes(symbol) && prices) {
            prices.forEach(price => this.onTickCallback?.(symbol, Number(price)));
          }
        }
      } catch (e) {}
    };

    this.ws.addEventListener('message', this.boundMessageHandler);

    // Request immediate data feed synchronization streams
    this.activeSymbols.forEach(symbol => {
      try {
        // Pre-fetch the past 100 pricing coordinates to satisfy strategy filters instantly
        this.ws?.send(JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          count: 100,
          end: "latest",
          start: 1
        }));

        // Subscribe to ongoing feed pulses
        this.ws?.send(JSON.stringify({ ticks: symbol }));
      } catch (err) {
        console.error("Payload writing block failure:", err);
      }
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
