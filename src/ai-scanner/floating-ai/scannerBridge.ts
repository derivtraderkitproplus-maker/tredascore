// scannerBridge.ts

type TickCallback = (symbol: string, tick: number) => void;

export class DerivScannerBridge {
  private ws: WebSocket | null = null;
  private onTickCallback: TickCallback | null = null;
  private activeSymbols: string[] = [];

  constructor(private appCtx: any) {
    // Uses the client-side instance handled by Deriv engineers
    this.ws = appCtx?.websocketInstance || null; 
  }

  public initPipeline(symbols: string[], onTick: TickCallback) {
    this.onTickCallback = onTick;
    this.activeSymbols = symbols;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("Deriv Infrastructure Native WS not connected or ready.");
      return;
    }

    // Bind event multiplexer directly to active stream
    this.ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.msg_type === 'tick' && data.tick) {
        const { symbol, quote } = data.tick;
        if (this.activeSymbols.includes(symbol)) {
          this.onTickCallback?.(symbol, parseFloat(quote));
        }
      }
    });

    // Send Bulk Feed Subscriptions
    this.activeSymbols.forEach(symbol => {
      this.ws?.send(JSON.stringify({ ticks: symbol }));
    });
  }

  public closePipeline() {
    this.activeSymbols.forEach(symbol => {
      this.ws?.send(JSON.stringify({ forget_all: 'ticks' }));
    });
  }
}
