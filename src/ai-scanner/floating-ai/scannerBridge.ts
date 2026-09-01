// scannerBridge.ts

export type TickCallback = (symbol: string, tick: number) => void;

export class DerivScannerBridge {
  private ws: WebSocket | null = null;
  private onTickCallback: TickCallback | null = null;
  private activeSymbols: string[] = [];
  private boundMessageHandler: ((event: MessageEvent) => void) | null = null;

  constructor(private appCtx: any) {
    this.interceptSystemSocket();
  }

  private interceptSystemSocket(): void {
    const globalWin = window as any;
    
    // Traverses every potential production block layout location where your active bot shell binds its connection handle
    this.ws = 
      globalWin.derivWebSocket || 
      globalWin.ws || 
      globalWin.socket || 
      globalWin.g_wallet_socket ||
      globalWin.Blockly?.derivWorkspace?.socket ||
      (globalWin.Blockly?.derivWorkspace?.connection_?.websocket_) ||
      (globalWin.Blockly?.mainWorkspace?.connection_?.websocket_);

    // Look inside your context structure layers if window tracking variables are clean
    if (!this.ws && this.appCtx) {
      this.ws = this.appCtx.websocketInstance || this.appCtx.ws || this.appCtx.socket || this.appCtx.api?.api?.ws;
    }
  }

  public initPipeline(symbols: string[], onTick: TickCallback): void {
    this.onTickCallback = onTick;
    
    // Normalize target token mappings directly to the broker's underlying symbol syntax mapping keys
    this.activeSymbols = symbols.map(s => (s === 'R_100' || s === 'Volatility 100 (1s) Index') ? '1HZ100V' : s);

    this.interceptSystemSocket();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Re-poll until active bot workspace shell establishes network state parameters
      setTimeout(() => this.initPipeline(symbols, onTick), 1000);
      return;
    }

    this.boundMessageHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Match live stream ticker frames
        if (data.msg_type === 'tick' && data.tick) {
          const { symbol, quote } = data.tick;
          if (this.activeSymbols.includes(symbol)) {
            this.onTickCallback?.(symbol, parseFloat(quote));
          }
        }
        
        // Match history snap matrix streams
        if (data.msg_type === 'history' && data.history) {
          const symbol = data.echo_req.ticks_history;
          const prices: number[] = data.history.prices;
          if (this.activeSymbols.includes(symbol) && prices) {
            prices.forEach(p => this.onTickCallback?.(symbol, Number(p)));
          }
        }
      } catch (e) {}
    };

    this.ws.addEventListener('message', this.boundMessageHandler);

    // Request active feed data states over authorized channel handles
    this.activeSymbols.forEach(symbol => {
      try {
        // Send history query payload matching the exact protocol version structure expected by Deriv API servers
        this.ws?.send(JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          count: 100,
          end: 'latest',
          start: 1,
          style: 'ticks'
        }));

        // Subscribe to live tick tracking stream updates
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
