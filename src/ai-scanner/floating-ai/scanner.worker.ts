// src/ai-scanner/scanner.worker.ts - UPGRADED INFRASTRUCTURE FRAME
import { ScannerLogicEngine } from './scannerLogic.ts'; // ✅ Explicitly include file extension if your bundler strictly enforces it

const backgroundProcessorEngine = new ScannerLogicEngine();

self.onmessage = (messageEvent: MessageEvent) => {
  const { action, symbol, price } = messageEvent.data;

  if (action === 'INFLOW_TICK') {
    if (!symbol || price === undefined) return; // Prevent parsing errors from crashing the isolate thread
    
    backgroundProcessorEngine.injectTick(symbol, price);
    const calculatedFrames = backgroundProcessorEngine.runScannerPipeline();
    
    self.postMessage({
      action: 'SCANNER_BATCH_READY',
      payload: calculatedFrames
    });
  }
};
