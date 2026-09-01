// scannerBridge.ts

export type TickCallback = (symbol: string, tick: number) => void;

export class DerivScannerBridge {
  private ws: WebSocket | null = null;
  private onTickCallback: TickCallback | null = null;
  private activeSymbols: string[] = [];
  private boundMessageHandler: ((event: MessageEvent) => void) | null = null;

  constructor(private appCtx: any) {
    this.extractAuthorizedSocket();
  }

  private extractAuthorizedSocket(): void {
    const globalWin = window as any;
    
    // 1. Check if the app store context passed from bot-builder has the socket inside its core API map
    if (this.appCtx) {
      this.ws = 
        this.appCtx.websocketInstance || 
        this.appCtx.ws || 
        this.appCtx.socket || 
        this.appCtx.api?.api?.ws ||
        this.appCtx.api?.ws;
    }

    // 2. Fallback: If context is busy, scan the browser memory paths for open platform connections
    if (!this.ws) {
      this.ws = 
        globalWin.derivWebSocket || 
        globalWin.ws || 
        globalWin.socket || 
        globalWin.g_wallet_socket ||
        globalWin.Blockly?.derivWorkspace?.socket ||
        globalWin.Blockly?.derivWorkspace?.connection_?.websocket_ ||
        globalWin.Blockly?.mainWorkspace?.connection_?.websocket_;
    }
  }

  public initPipeline(symbols: string[], onTick: TickCallback): void {
    this.onTickCallback = onTick;
    
    // Map selection variables directly to the correct asset codes (e.g. Volatility 100 (1s) -> 1HZ100V)
    this.activeSymbols = symbols.map(s => 
      (s === 'R_100' || s === 'Volatility 100 (1s) Index' || s === '1HZ100V') ? '1HZ100V' : s
    );

    this.extractAuthorizedSocket();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("AI Scanner: Waiting for production dashboard trade connection socket...");
      setTimeout(() => this.initPipeline(symbols, onTick), 1500);
      return;
    }

    this.boundMessageHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle incoming live price feed tick updates
        if (data.msg_type === 'tick' && data.tick) {
          const { symbol, quote } = data.tick;
          if (this.activeSymbols.includes(symbol)) {
            this.onTickCallback?.(symbol, parseFloat(quote));
          }
        }
        
        // Handle incoming historical tick arrays
        if ((data.msg_type === 'history' || data.msg_type === 'ticks_history') && data.history) {
          const symbol = data.echo_req.ticks_history;
          const prices: number[] = data.history.prices;
          if (this.activeSymbols.includes(symbol) && prices) {
            prices.forEach(p => this.onTickCallback?.(symbol, Number(p)));
          }
        }
      } catch (e) {}
    };

    this.ws.addEventListener('message', this.boundMessageHandler);

    // Request tick histories and live stream updates using the safe, authorized channel handles
    this.activeSymbols.forEach(symbol => {
      try {
        // Request history snapshots to satisfy your 100-tick baseline calculations immediately
        this.ws?.send(JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          count: 100,
          end: 'latest',
          start: 1,
          style: 'ticks'
        }));

        // Subscribe to ongoing market stream updates
        this.ws?.send(JSON.stringify({ ticks: symbol }));
      } catch (err) {
        console.error("Failed to write to authorized socket:", err);
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
