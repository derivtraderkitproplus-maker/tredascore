// @ts-nocheck
import { processIncomingTick } from './scannerLogic';

let scannerSocket: WebSocket | null = null;
let keepAlivePing: ReturnType<typeof setInterval> | null = null;

/**
 * The Easiest Method: Opens a direct, isolated background connection 
 * strictly for the AI Scanner logic pipeline.
 */
export const startIsolatedScannerFeed = (symbol: string, onUiUpdate: () => void) => {
    // 1. Clean up any existing connection to prevent ghost loops
    stopIsolatedScannerFeed();

    // 2. Open a dedicated data tunnel using Deriv's public endpoint
    // Using production App ID 1098 (Default public app id) or swap with your custom one
    const derivAppId = localStorage.getItem('app_id') || '1098'; 
    scannerSocket = new WebSocket(`wss://://derivws.com{derivAppId}`);

    scannerSocket.onopen = () => {
        console.log(`[AI Scanner Socket] Connected. Requesting data for ${symbol}...`);

        // 3. Request historical ticks instantly to clear the "INSUFFICIENT_DATA" gate
        scannerSocket?.send(JSON.stringify({
            ticks_history: symbol,
            adjust_start_time: 1,
            count: 100,
            end: 'latest',
            style: 'ticks'
        }));

        // 4. Subscribe to the continuous live streaming ticks feed
        scannerSocket?.send(JSON.stringify({
            ticks: symbol,
            subscribe: 1
        }));

        // Keep-alive heartbeat loop to make sure connection never drops in the background
        keepAlivePing = setInterval(() => {
            if (scannerSocket?.readyState === WebSocket.OPEN) {
                scannerSocket.send(JSON.stringify({ ping: 1 }));
            }
        }, 30000);
    };

    scannerSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            // Handle Historical Snapshot Backfill Packets
            if (data?.msg_type === 'history' && data?.history?.times) {
                data.history.times.forEach((time: number, idx: number) => {
                    processIncomingTick({
                        epoch: time,
                        quote: Number(data.history.prices[idx])
                    });
                });
                onUiUpdate(); // Force UI update out of loading state instantly
            }

            // Handle Real-Time Live Stream Price Ticks
            if (data?.msg_type === 'tick' && data?.tick?.symbol === symbol) {
                processIncomingTick({
                    epoch: data.tick.epoch,
                    quote: data.tick.quote
                });
                onUiUpdate(); // Repaint UI counters on every single tick change
            }
        } catch (error) {
            console.error("[AI Scanner Data Error] Parsing failed:", error);
        }
    };

    scannerSocket.onerror = (err) => console.error("[AI Scanner Socket] Error:", err);
    scannerSocket.onclose = () => console.log("[AI Scanner Socket] Feed closed cleanly.");
};

/**
 * Shuts down the background network tunnel cleanly when the UI panel closes
 */
export const stopIsolatedScannerFeed = () => {
    if (keepAlivePing) {
        clearInterval(keepAlivePing);
        keepAlivePing = null;
    }
    if (scannerSocket) {
        scannerSocket.close();
        scannerSocket = null;
    }
};
