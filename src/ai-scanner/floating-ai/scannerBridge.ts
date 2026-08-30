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
    private maxHistoryLookback: number = 100; // Matches Required Ticks 100/100 threshold
    private activeUiCallback: UIUpdateCallback;
    private trackedAsset: string = '1HZ100V';

    constructor(onUpdateSignal: UIUpdateCallback) {
        this.activeUiCallback = onUpdateSignal;
    }

    /**
     * Initializes scanner operations and mounts to the centralized websocket pipe
     */
    public startLiveScanning(assetSymbol: string = '1HZ100V') {
        // Clear previous runtime allocations safely
        this.stopLiveScanning();
        this.accumulatedPrices = [];
        this.trackedAsset = assetSymbol;

        // Initialize state markers to loading phase explicitly
        this.activeUiCallback({
            marketState: 'INSUFFICIENT_DATA',
            liveTicks: 0,
            confidenceGate: 'WAIT',
            progressPercentage: 0,
            rawScannerResult: null
        });

        try {
            // Hook directly into the central API runtime tick channel
            const subscriptionId = api_base.subscribeToTicks(
                this.trackedAsset, 
                (incomingTick: { symbol: string; quote: number; epoch: number }) => {
                    // Safety check to ensure stream matches target workspace asset
                    if (incomingTick && incomingTick.symbol === this.trackedAsset) {
                        this.processIncomingSocketTick(incomingTick.quote);
                    }
                }
            );

            // Set up standardized dynamic function wrapper to destroy subscription cleanly
            this.disconnectSocketListener = () => {
                if (typeof api_base.unsubscribeFromTicks === 'function') {
                    api_base.unsubscribeFromTicks(this.trackedAsset, subscriptionId);
                } else if (typeof subscriptionId === 'function') {
                    (subscriptionId as () => void)();
                }
            };
        } catch (error) {
            console.error('AI Scanner unable to mount background stream context:', error);
        }
    }

    /**
     * Extracts and validates numeric variables out of the raw stream objects
     */
    private processIncomingSocketTick(priceQuote: number) {
        if (priceQuote === undefined || priceQuote === null || !Number.isFinite(priceQuote) || priceQuote <= 0) return;

        this.accumulatedPrices.push(priceQuote);

        // Limit the memory array size to prevent browser/rendering delays
        if (this.accumulatedPrices.length > this.maxHistoryLookback) {
            this.accumulatedPrices.shift();
        }

        const currentCount = this.accumulatedPrices.length;

        // Execute scan calculation algorithms down the logical framework pipelines
        const result: ScannerResult = scanMarket(this.accumulatedPrices);

        if (currentCount < this.maxHistoryLookback) {
            // Loading Phase: Still building the array lookback window buffer
            this.activeUiCallback({
                marketState: 'INSUFFICIENT_DATA',
                liveTicks: currentCount,
                confidenceGate: 'WAIT',
                progressPercentage: Math.floor((currentCount / this.maxHistoryLookback) * 100),
                rawScannerResult: result
            });
        } else {
            // Execution Phase: Array buffer full, scanner results are fully ready
            this.activeUiCallback({
                marketState: result?.analysis?.state || 'UP/DOWN/RANGE', 
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
                console.warn('Silent teardown error handling socket clear:', cleanupError);
            }
            this.disconnectSocketListener = null;
        }
    }
}
