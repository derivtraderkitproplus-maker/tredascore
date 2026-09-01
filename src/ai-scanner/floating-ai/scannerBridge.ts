// scannerBridge.ts

export type TickCallback = (symbol: string, tick: number) => void;

export class DerivScannerBridge {
  private ws: WebSocket | null = null;
  private onTickCallback: TickCallback | null = null;
  private activeSymbols: string[] = [];
  private boundMessageHandler: ((event: MessageEvent) => void) | null = null;

  constructor(private appCtx: any) {
    // Explicitly targets your application shell architecture instance safely
    this.ws = appCtx?.websocketInstance || appCtx?.ws || (window as any).derivWebSocket || null;
  }

  public initPipeline(symbols: string[], onTick: TickCallback): void {
    this.onTickCallback = onTick;
    this.activeSymbols = symbols;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("Deriv Infrastructure WS not actively open. Attempting global search wrapper.");
      const fallback = (window as any).ws || (window as any).socket;
      if (fallback && fallback.readyState === WebSocket.OPEN) {
        this.ws = fallback;
      } else {
        return;
      }
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
      } catch (e) {
        // Suppress parsing anomalies silently
      }
    };

    this.ws.addEventListener('message', this.boundMessageHandler);

    this.activeSymbols.forEach(symbol => {
      this.ws?.send(JSON.stringify({ ticks: symbol }));
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
