// scannerBridge.ts

export type TickCallback = (symbol: string, tick: number) => void;

export class DerivScannerBridge {
  private ws: WebSocket | null = null;
  private onTickCallback: TickCallback | null = null;
  private activeSymbols: string[] = [];
  private boundMessageHandler: ((event: MessageEvent) => void) | null = null;
  private isFallbackMode: boolean = false;

  constructor(private appCtx: any) {
    this.locateActiveSocket();
  }

  private locateActiveSocket(): void {
    const globalWin = window as any;
    
    // Scan all runtime workspace memory instances for open connections
    this.ws = 
      globalWin.derivWebSocket || 
      globalWin.ws || 
      globalWin.socket || 
      globalWin.g_wallet_socket ||
      globalWin.Blockly?.derivWorkspace?.socket ||
      globalWin.Blockly?.derivWorkspace?.connection_?.websocket_ ||
      globalWin.Blockly?.mainWorkspace?.connection_?.websocket_;

    if (!this.ws && this.appCtx) {
      this.ws = this.appCtx.websocketInstance || this.appCtx.ws || this.appCtx.socket || this.appCtx.api?.api?.ws;
    }
  }

  public initPipeline(symbols: string[], onTick: TickCallback): void {
    this.onTickCallback = onTick;
    
    // Map human market strings straight to standard short symbols
    this.activeSymbols = symbols.map(s => 
      (s === 'R_100' || s === 'Volatility 100 (1s) Index' || s === '1HZ100V') ? '1HZ100V' : s
    );

    this.locateActiveSocket();

    // FALLBACK ENGINE ACTIVATION: Spin up an isolated background client stream if shell socket is dead
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (!this.isFallbackMode) {
        console.warn("AI Scanner: Primary hook missing. Spinning up public endpoint channel...");
        this.isFallbackMode = true;
        this.ws = new WebSocket('wss://://derivws.com'); // Uses general public application layout id
        
        this.ws.onopen = () => {
          this.executeSubscriptions();
        };
        this.ws.onmessage = (e) => this.handleIncomingPackets(e);
        return;
      }
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.executeSubscriptions();
    } else {
      setTimeout(() => this.initPipeline(symbols, onTick), 1200);
    }
  }

  private executeSubscriptions(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Attach listener if not in custom callback mode
    if (!this.isFallbackMode) {
      this.boundMessageHandler = (e: MessageEvent) => this.handleIncomingPackets(e);
      this.ws.addEventListener('message', this.boundMessageHandler);
    }

    this.activeSymbols.forEach(symbol => {
      try {
        // Request historical snapshots
        this.ws?.send(JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          count: 100,
          end: 'latest',
          start: 1,
          style: 'ticks'
        }));

        // Subscribe to real-time streams
        this.ws?.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
      } catch (err) {
        console.error("Pipeline request transmission fault:", err);
      }
    });
  }

  private handleIncomingPackets(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Route real-time tick streaming data packages
      if (data.msg_type === 'tick' && data.tick) {
        const { symbol, quote } = data.tick;
        if (this.activeSymbols.includes(symbol)) {
          this.onTickCallback?.(symbol, parseFloat(quote));
        }
      }
      
      // Route historical snapshot back-fill arrays
      if ((data.msg_type === 'history' || data.msg_type === 'ticks_history') && data.history) {
        const symbol = data.echo_req.ticks_history;
        const prices: number[] = data.history.prices;
        if (this.activeSymbols.includes(symbol) && prices) {
          prices.forEach(p => this.onTickCallback?.(symbol, Number(p)));
        }
      }
    } catch (err) {}
  }

  public closePipeline(): void {
    if (this.isFallbackMode && this.ws) {
      this.ws.close();
    } else if (this.ws && this.boundMessageHandler) {
      this.ws.removeEventListener('message', this.boundMessageHandler);
    }
    this.activeSymbols.forEach(symbol => {
      try {
        this.ws?.send(JSON.stringify({ forget: symbol }));
      } catch (e) {}
    });
  }
}
