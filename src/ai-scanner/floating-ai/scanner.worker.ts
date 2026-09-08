// src/ai-scanner/scanner.worker.ts - COMPILATION SAFE BACKGROUND CHUNK FILE
import { ScannerLogicEngine } from './scannerLogic'; // ✅ FIXED: Removed the restricted '.ts' extension string completely!

const backgroundProcessorEngine = new ScannerLogicEngine();

self.onmessage = (messageEvent: MessageEvent) => {
  const { action, symbol, price } = messageEvent.data;

  if (action === 'INFLOW_TICK') {
    if (!symbol || price === undefined) return; // Prevent parsing errors from crashing the thread channel
    
    backgroundProcessorEngine.injectTick(symbol, price);
    const calculatedFrames = backgroundProcessorEngine.runScannerPipeline();
    
    self.postMessage({
      action: 'SCANNER_BATCH_READY',
      payload: calculatedFrames
    });
  }
};
