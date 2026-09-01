// FloatingAI.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { DerivScannerBridge } from './scannerBridge';
import { ScannerLogicEngine, EvaluationFrame } from './scannerLogic';
import { STRATEGY_PROFILES } from './strategies';
import './FloatingAI.css';

interface FloatingAIProps {
  derivContext?: any;
  selectedMarket?: string;
  onCloseScanner?: () => void; // FIXED: Added interface handler mapping property
}

export const FloatingAI: React.FC<FloatingAIProps> = ({ derivContext = {}, selectedMarket = '1HZ100V', onCloseScanner }) => {
  const [rawPipelineData, setRawPipelineData] = useState<EvaluationFrame[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // USER INPUT PARAMETERS
  const [stake, setStake] = useState<string>('1000');
  const [stopLoss, setStopLoss] = useState<string>('500');
  const [takeProfit, setTakeProfit] = useState<string>('1500');

  const logicEngine = useMemo(() => new ScannerLogicEngine(), []);
  const networkBridge = useMemo(() => new DerivScannerBridge(derivContext), [derivContext]);

  // Persistent ranking memory caches configuration layout trees
  const [frozenDisplayList, setFrozenDisplayList] = useState<EvaluationFrame[]>([]);

  useEffect(() => {
    if (!selectedMarket) return;
    logicEngine.setMarket(selectedMarket);
    setRawPipelineData([]);
    setFrozenDisplayList([]);

    let mockPrice = 845.20;
    const targetSymbol = selectedMarket === 'R_100' ? '1HZ100V' : selectedMarket;
    
    for (let i = 0; i < 115; i++) {
      const noise = (Math.random() - 0.5) * 0.45;
      mockPrice += noise;
      logicEngine.injectTick(targetSymbol, mockPrice);
    }
    
    const initialFrame = logicEngine.runScannerPipeline();
    setRawPipelineData(initialFrame);

    const liveSimulationInterval = setInterval(() => {
      // FIXED RULE: Freeze all interior calculation data logic blocks completely if a user opens a card drawer
      if (activeTab) return;

      const noise = (Math.random() - 0.5) * 0.60;
      mockPrice += noise;
      
      logicEngine.injectTick(targetSymbol, mockPrice);
      const updatedFrame = logicEngine.runScannerPipeline();
      setRawPipelineData(updatedFrame);
    }, 1000);

    networkBridge.initPipeline([selectedMarket], (symbol, price) => {
      if (activeTab) return; // Disables network state pollution inside opened editor fields
      logicEngine.injectTick(symbol, price);
      const frameAnalysis = logicEngine.runScannerPipeline();
      setRawPipelineData(frameAnalysis);
    });

    return () => {
      clearInterval(liveSimulationInterval);
      networkBridge.closePipeline();
    };
  }, [selectedMarket, logicEngine, networkBridge, activeTab]);

  // Handle baseline sorting actions
  const liveSortedProfiles = useMemo(() => {
    if (rawPipelineData.length === 0) return [];
    return [...rawPipelineData].sort((a, b) => b.metrics.finalConfidence - a.metrics.finalConfidence);
  }, [rawPipelineData]);

  // Cache configuration layers before drawers expand
  useEffect(() => {
    if (!activeTab && liveSortedProfiles.length > 0) {
      setFrozenDisplayList(liveSortedProfiles);
    }
  }, [liveSortedProfiles, activeTab]);

  // Isolated matrix display layer rules
  const visualDisplayList = useMemo(() => {
    if (activeTab && frozenDisplayList.length > 0) {
      // FIXED LOCK: Freezes both position AND text parameters (scores, metrics, confidence) entirely
      return frozenDisplayList;
    }
    
    if (liveSortedProfiles.length > 0) return liveSortedProfiles;

    return STRATEGY_PROFILES.map(profile => ({
      profile,
      metrics: {
        profileId: profile.id,
        ticksLoaded: 0,
        marketState: 'INSUFFICIENT_DATA',
        direction: 'FLAT',
        scannerScore: 0,
        marketCompatibility: 0,
        finalConfidence: 0,
        tierOverride: profile.tier
      }
    }));
  }, [liveSortedProfiles, frozenDisplayList, activeTab]);

  const globalSummary = useMemo(() => {
    const sourceList = activeTab ? frozenDisplayList : liveSortedProfiles;
    if (sourceList.length === 0) {
      return { marketState: 'INSUFFICIENT_DATA', direction: 'FLAT', finalConfidence: 0 };
    }
    return sourceList[0].metrics;
  }, [liveSortedProfiles, frozenDisplayList, activeTab]);

  const handleLoadBot = (targetDirection: string) => {
    networkBridge.injectDataToBlockly({
      direction: targetDirection,
      stake: parseFloat(stake) || 0,
      stopLoss: parseFloat(stopLoss) || 0,
      takeProfit: parseFloat(takeProfit) || 0
    });

    // FIXED: Closes panel modal window instantly after workspace synchronization processes
    if (typeof onCloseScanner === 'function') {
      onCloseScanner();
    }
  };

  const handleResetMetrics = () => {
    setActiveTab(null);
    setRawPipelineData([]);
    setFrozenDisplayList([]);
    let basePrice = 845.20;
    const targetSymbol = selectedMarket === 'R_100' ? '1HZ100V' : selectedMarket;
    for (let i = 0; i < 115; i++) {
      const noise = (Math.random() - 0.5) * 0.45;
      basePrice += noise;
      logicEngine.injectTick(targetSymbol, basePrice);
    }
    const resetFrame = logicEngine.runScannerPipeline();
    setRawPipelineData(resetFrame);
  };

  return (
    <div className="ai-strategy-scanner">
      <div className="scanner-header">
        <h3>AI Strategy Scanner</h3>
        <span className="profile-counter">30/30</span>
      </div>

      <div className="scanner-subheader-text">
        {activeTab ? "🔒 Metrics Locked for Editing Parameters" : "High-confidence profiles rank on top. Tap to lock & edit."}
      </div>

      <div className="metrics-banner-grid">
        <div className="metric-box">
          <label>MARKET STATE</label>
          <div className="val">{globalSummary.marketState}</div>
        </div>
        <div className="metric-box">
          <label>DIRECTION</label>
          <div className="val highlight-yellow">{globalSummary.direction}</div>
        </div>
        <div className="metric-box">
          <label>CONFIDENCE</label>
          <div className="val">{globalSummary.finalConfidence}%</div>
        </div>
      </div>

      <div className="strategy-scroll-list">
        {visualDisplayList.map((item, index) => {
          const isExpanded = activeTab === item.profile.id;
          const currentTier = item.metrics.tierOverride || item.profile.tier;
          
          return (
            <div key={item.profile.id} className={`strategy-card-node ${isExpanded ? 'card-node--frozen' : ''}`}>
              <div 
                className="card-summary" 
                onClick={() => setActiveTab(isExpanded ? null : item.profile.id)}
              >
                <div className="rank-badge">#{index + 1}</div>
                <div className="meta-details">
                  <h4>{item.profile.name}</h4>
                  <p>Score {item.metrics.scannerScore}% &nbsp; Confidence {item.metrics.finalConfidence}%</p>
                </div>
                <span className={`tier-badge ${currentTier.toLowerCase()}`}>
                  {currentTier}
                </span>
                <span className="arrow-toggle">{isExpanded ? '▲' : '▼'}</span>
              </div>

              {isExpanded && (
                <div className="card-expanded-drawer">
                  <p className="desc">{item.profile.description}</p>
                  
                  <div className="ai-input-parameter-grid">
                    <div className="input-cell">
                      <label>STAKE (USD)</label>
                      <input type="number" value={stake} onChange={(e) => setStake(e.target.value)} />
                    </div>
                    <div className="input-cell">
                      <label>STOP LOSS</label>
                      <input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
                    </div>
                    <div className="input-cell">
                      <label>TAKE PROFIT</label>
                      <input type="number" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} />
                    </div>
                  </div>

                  <div className="live-metrics-data-row">
                    <div className="data-cell">
                      <div className="lbl">LIVE MARKET</div>
                      <div className="txt-bold">{item.metrics.marketState}</div>
                    </div>
                    <div className="data-cell">
                      <div className="lbl">DIRECTION</div>
                      <div className="txt-bold highlight-yellow">{item.metrics.direction}</div>
                    </div>
                    <div className="data-cell">
                      <div className="lbl">STATUS</div>
                      <div className="txt-bold highlight-purple">READY</div>
                    </div>
                  </div>

                  <button 
                    className="inner-drawer-load-btn"
                    onClick={() => handleLoadBot(item.metrics.direction)}
                  >
                    📥 Load Strategy Parameters
                  </button>
                </div>
              )}
            </div>
          );
          
        })}
      </div>
      
      <button className="scan-again-btn" onClick={handleResetMetrics}>
        ↺ Unfreeze & Refresh Ticks
      </button>
    </div>
  );
};

export default FloatingAI;
