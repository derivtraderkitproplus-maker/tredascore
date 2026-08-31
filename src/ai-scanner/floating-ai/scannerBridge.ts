// ============================================================
// AI SCANNER LIVE WEBSOCKET CONNECTOR BRIDGE (DIAGNOSTIC LOG)
// Location: src/ai-scanner/floating-ai/scannerBridge.ts
// ============================================================

import { api_base } from '../../external/bot-skeleton/services/api/api-base';
import { scanMarket, ScannerResult } from './scannerLogic';

type UIUpdateCallback = (data: {
    marketState: string;
    liveTicks: number;
    confidenceGate: string;
    progressPercentage: number;
    rawScannerResult: ScannerResult | null;
}) => void;

export class ScannerBridge {
    private disconnectSocketListener: (() => void) | null = null;
    private accumulatedPrices: number[] = [];
    private maxHistoryLookback: number = 100;
    private activeUiCallback: UIUpdateCallback;
    private trackedAsset: string = '1HZ100V';
    private logContainer: HTMLDivElement | null = null;

    constructor(onUpdateSignal: UIUpdateCallback) {
        this.activeUiCallback = onUpdateSignal;
        this.createVisualLogOverlay();
    }

    /**
     * Injects a raw floating terminal onto your phone screen to read real-time errors
     */
    private createVisualLogOverlay() {
        if (document.getElementById('mobile-debug-console')) return;
        
        const container = document.createElement('div');
        container.id = 'mobile-debug-console';
        container.style.position = 'fixed';
        container.style.bottom = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '140px';
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        container.style.color = '#00ff00';
        container.style.fontFamily = 'monospace';
        container.style.fontSize = '10px';
        container.style.overflowY = 'scroll';
        container.style.padding = '8px';
        container.style.zIndex = '99999';
        container.style.borderTop = '2px solid #333';
        container.innerHTML = '<div>📱 Scanner Mobile Logger Initialized...</div>';
        
        document.body.appendChild(container);
        this.logContainer = container;
    }

    private printLog(message: string) {
        if (this.logContainer) {
            const entry = document.createElement('div');
            entry.innerText = `[${new Date().toLocaleTimeString()}] ${message}`;
            this.logContainer.appendChild(entry);
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        }
    }

    public startLiveScanning(assetSymbol: string = '1HZ100V') {
        this.stopLiveScanning();
        this.accumulatedPrices = [];
        this.trackedAsset = assetSymbol;

        this.printLog(`Starting Scan for Asset: ${assetSymbol}`);

        this.activeUiCallback({
            marketState: 'INSUFFICIENT_DATA',
            liveTicks: 0,
            confidenceGate: 'WAIT',
            progressPercentage: 0,
            rawScannerResult: null
        });

        try {
            this.printLog("Calling api_base.subscribeToTicks...");
            
            this.disconnectSocketListener = api_base.subscribeToTicks(
                this.trackedAsset, 
                (incomingTick: { symbol: string; quote: number; epoch: number }) => {
                    this.printLog(`🔴 TICK RECEIVED: ${incomingTick.symbol} -> ${incomingTick.quote}`);
                    this.processIncomingSocketTick(incomingTick.quote);
                }
            );

            this.printLog("Subscription initialization hook executed.");
        } catch (error: any) {
            this.printLog(`❌ CRITICAL ENTRY ERROR: ${error?.message || error}`);
        }
    }

    private processIncomingSocketTick(priceQuote: number) {
        if (!Number.isFinite(priceQuote) || priceQuote <= 0) return;

        this.accumulatedPrices.push(priceQuote);

        if (this.accumulatedPrices.length > this.maxHistoryLookback) {
            this.accumulatedPrices.shift();
        }

        const currentCount = this.accumulatedPrices.length;
        const result: ScannerResult = scanMarket(this.accumulatedPrices);

        if (currentCount < this.maxHistoryLookback) {
            this.activeUiCallback({
                marketState: 'INSUFFICIENT_DATA',
                liveTicks: currentCount,
                confidenceGate: 'WAIT',
                progressPercentage: Math.floor((currentCount / this.maxHistoryLookback) * 100),
                rawScannerResult: result
            });
        } else {
            this.activeUiCallback({
                marketState: result?.analysis?.state || 'UP/DOWN/RANGE', 
                liveTicks: currentCount,
                confidenceGate: result?.winnerConfirmed ? 'READY' : 'WAIT',
                progressPercentage: 100,
                rawScannerResult: result
            });
        }
    }

    public stopLiveScanning() {
        if (this.disconnectSocketListener) {
            this.printLog("Stopping tick streams safely.");
            this.disconnectSocketListener();
            this.disconnectSocketListener = null;
        }
    }
}
