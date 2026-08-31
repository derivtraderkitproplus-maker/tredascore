// ============================================================
// AI SCANNER LIVE WEBSOCKET CONNECTOR BRIDGE
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

    constructor(onUpdateSignal: UIUpdateCallback) {
        this.activeUiCallback = onUpdateSignal;
    }

    /**
     * Initializes scanner operations and mounts to the centralized websocket pipe
     */
    public startLiveScanning(assetSymbol: string = '1HZ100V') {
        this.stopLiveScanning();
        this.accumulatedPrices = [];
        this.trackedAsset = assetSymbol;

        // Immediately flash initial loading indicators
        this.activeUiCallback({
            marketState: 'INSUFFICIENT_DATA',
            liveTicks: 0,
            confidenceGate: 'WAIT',
            progressPercentage: 0,
            rawScannerResult: null
        });

        try {
            // Hook straight into the central framework socket pipeline handler
            this.disconnectSocketListener = api_base.subscribeToTicks(
                this.trackedAsset, 
                (incomingTick: { symbol: string; quote: number; epoch: number }) => {
                    if (incomingTick && incomingTick.symbol === this.trackedAsset) {
                        this.processIncomingSocketTick(incomingTick.quote);
                    }
                }
            );
        } catch (error) {
            console.error('[ScannerBridge] Unable to mount background layout connection stream context:', error);
        }
    }
    /**
     * Extracts and validates numeric variables out of the raw stream objects
     */
    private processIncomingSocketTick(priceQuote: number) {
        if (!Number.isFinite(priceQuote) || priceQuote <= 0) return;

        this.accumulatedPrices.push(priceQuote);

        // Keep local buffer from swelling up to preserve memory performance
        if (this.accumulatedPrices.length > this.maxHistoryLookback) {
            this.accumulatedPrices.shift();
        }

        const currentCount = this.accumulatedPrices.length;
        const result: ScannerResult = scanMarket(this.accumulatedPrices);

        if (currentCount < this.maxHistoryLookback) {
            // Loading State: Counting upward to target lookback threshold
            this.activeUiCallback({
                marketState: 'INSUFFICIENT_DATA',
                liveTicks: currentCount,
                confidenceGate: 'WAIT',
                progressPercentage: Math.floor((currentCount / this.maxHistoryLookback) * 100),
                rawScannerResult: result
            });
        } else {
            // Processing State: Buffer full, passing analytics calculations to UI view
            this.activeUiCallback({
                marketState: result?.analysis?.state || 'RANGE',
                liveTicks: currentCount,
                confidenceGate: result?.winnerConfirmed ? 'READY' : 'WAIT',
                progressPercentage: 100,
                rawScannerResult: result
            });
        }
    }

    /**
     * Cleans up listeners when closing the component layout workspace panels
     */
    public stopLiveScanning() {
        if (this.disconnectSocketListener) {
            try {
                this.disconnectSocketListener();
            } catch (cleanupError) {
                console.warn('[ScannerBridge] Safe cleanup warning handling socket clearing routine:', cleanupError);
            }
            this.disconnectSocketListener = null;
        }
    }
}
