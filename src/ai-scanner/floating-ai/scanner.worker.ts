// scanner.worker.ts - Background Computation Isolate Frame
import { ScannerLogicEngine } from './scannerLogic';

const backgroundProcessorEngine = new ScannerLogicEngine();

self.onmessage = (messageEvent: MessageEvent) => {
  const { action, symbol, price } = messageEvent.data;

  if (action === 'INFLOW_TICK') {
    // 1. Process incoming tick metrics safely in the background thread isolate
    backgroundProcessorEngine.injectTick(symbol, price);
    
    // 2. Compute all strategies and indicators away from the main thread loop
    const calculatedFrames = backgroundProcessorEngine.runScannerPipeline();
    
    // 3. Post the structural batch arrays back to the bridge line instantly
    self.postMessage({
      action: 'SCANNER_BATCH_READY',
      payload: calculatedFrames
    });
  }
};
