// ============================================================
// AI SCANNER LIVE WEBSOCKET CONNECTOR BRIDGE (POPUP ALERT DEBUGGER)
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
        // Immediate visual alert confirming the code exists and class was constructed
        alert("🟢 ScannerBridge constructor initialized successfully on your phone!");
    }

    public startLiveScanning(assetSymbol: string = '1HZ100V') {
        this.stopLiveScanning();
        this.accumulatedPrices = [];
        this.trackedAsset = assetSymbol;

        alert(`🚀 Scanning triggered for asset: ${assetSymbol}`);

        this.activeUiCallback({
            marketState: 'INSUFFICIENT_DATA',
            liveTicks: 0,
            confidenceGate: 'WAIT',
            progressPercentage: 0,
            rawScannerResult: null
        });

        try {
            if (!api_base) {
                alert("❌ ERROR: api_base is undefined or missing completely!");
                return;
            }

            if (typeof api_base.subscribeToTicks !== 'function') {
                alert("❌ ERROR: api_base exists, but subscribeToTicks function is missing!");
                return;
            }

            alert("📡 Calling api_base.subscribeToTicks now...");

            this.disconnectSocketListener = api_base.subscribeToTicks(
                this.trackedAsset, 
                (incomingTick: { symbol: string; quote: number; epoch: number }) => {
                    alert(`🔴 TICK DETECTED! Price: ${incomingTick.quote}`);
                    this.processIncomingSocketTick(incomingTick.quote);
                }
            );

        } catch (error: any) {
            alert(`❌ CRITICAL SYSTEM EXCEPTION: ${error?.message || error}`);
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

        this.activeUiCallback({
            marketState: currentCount < this.maxHistoryLookback ? 'INSUFFICIENT_DATA' : (result?.analysis?.state || 'UP/DOWN/RANGE'),
            liveTicks: currentCount,
            confidenceGate: result?.winnerConfirmed ? 'READY' : 'WAIT',
            progressPercentage: Math.min(100, Math.floor((currentCount / this.maxHistoryLookback) * 100)),
            rawScannerResult: result
        });
    }

    public stopLiveScanning() {
        if (this.disconnectSocketListener) {
            this.disconnectSocketListener();
            this.disconnectSocketListener = null;
        }
    }
}
