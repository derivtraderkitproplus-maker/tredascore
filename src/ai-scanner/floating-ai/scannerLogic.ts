// scannerLogic.ts
import { STRATEGY_PROFILES, evaluateStrategy, StrategyResult, StrategyProfile } from './strategies';

export interface EvaluationFrame {
  profile: StrategyProfile;
  metrics: StrategyResult;
}

export class ScannerLogicEngine {
  private tickRegistry: Record<string, number[]> = {};
  private activeSymbol: string = 'R_100';

  public injectTick(symbol: string, price: number): void {
    if (!this.tickRegistry[symbol]) {
      this.tickRegistry[symbol] = [];
    }
    
    this.tickRegistry[symbol].push(price);

    if (this.tickRegistry[symbol].length > 120) {
      this.tickRegistry[symbol].shift();
    }
  }

  public setMarket(symbol: string): void {
    this.activeSymbol = symbol;
  }

  public runScannerPipeline(): EvaluationFrame[] {
    const currentTicks = this.tickRegistry[this.activeSymbol] || [];
    
    return STRATEGY_PROFILES.map(profile => {
      const metrics = evaluateStrategy(profile, currentTicks);
      return { profile, metrics };
    });
  }
}
