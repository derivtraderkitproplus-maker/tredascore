// scannerLogic.ts
import { STRATEGY_PROFILES, evaluateStrategy, StrategyResult, StrategyProfile } from './strategies';

export class ScannerLogicEngine {
  // Key: Symbol name, Value: Circular numeric array of historical quotes
  private tickRegistry: Record<string, number[]> = {};
  private activeSymbol: string = 'R_100'; // Default: Volatility 100 Index

  public injectTick(symbol: string, price: number) {
    if (!this.tickRegistry[symbol]) {
      this.tickRegistry[symbol] = [];
    }
    
    this.tickRegistry[symbol].push(price);

    // Limit lookback array safely to prevent browser memory fatigue
    if (this.tickRegistry[symbol].length > 150) {
      this.tickRegistry[symbol].shift();
    }
  }

  public setMarket(symbol: string) {
    this.activeSymbol = symbol;
  }

  public runScannerPipeline(): Array<{ profile: StrategyProfile; metrics: StrategyResult }> {
    const currentTicks = this.tickRegistry[this.activeSymbol] || [];

    return STRATEGY_PROFILES.map(profile => {
      const metrics = evaluateStrategy(profile, currentTicks);
      return { profile, metrics };
    });
  }
}
