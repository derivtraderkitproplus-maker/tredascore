// FloatingAI.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { DerivScannerBridge } from './scannerBridge';
import { ScannerLogicEngine, EvaluationFrame } from './scannerLogic';
import { STRATEGY_PROFILES } from './strategies';
import './FloatingAI.css';

interface FloatingAIProps {
  derivContext?: any;
  selectedMarket?: string;
}

export const FloatingAI: React.FC<FloatingAIProps> = ({ derivContext = {}, selectedMarket = '1HZ100V' }) => {
  const [rawPipelineData, setRawPipelineData] = useState<EvaluationFrame[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const logicEngine = useMemo(() => new ScannerLogicEngine(), []);
  const networkBridge = useMemo(() => new DerivScannerBridge(derivContext), [derivContext]);

  useEffect(() => {
    if (!selectedMarket) return;
    logicEngine.setMarket(selectedMarket);
    setRawPipelineData([]);

    let throttleTimeout: any = null;

    networkBridge.initPipeline([selectedMarket], (symbol, price) => {
      logicEngine.injectTick(symbol, price);
      
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          const frameAnalysis = logicEngine.runScannerPipeline();
          setRawPipelineData(frameAnalysis);
          throttleTimeout = null;
        }, 100);
      }
    });

    return () => {
      if (throttleTimeout) clearTimeout(throttleTimeout);
      networkBridge.closePipeline();
    };
  }, [selectedMarket, logicEngine, networkBridge]);

  const sortedProfiles = useMemo(() => {
    if (rawPipelineData.length === 0) return [];
    return [...rawPipelineData].sort((a, b) => b.metrics.finalConfidence - a.metrics.finalConfidence);
  }, [rawPipelineData]);

  const visualDisplayList = useMemo(() => {
    if (sortedProfiles.length > 0) return sortedProfiles;
    return STRATEGY_PROFILES.map(profile => ({
      profile,
      metrics: {
        profileId: profile.id,
        ticksLoaded: 0,
        marketState: 'INSUFFICIENT_DATA',
        direction: 'FLAT',
        scannerScore: 0,
        marketCompatibility: 0,
        finalConfidence: 0
      }
    }));
  }, [sortedProfiles]);

  // FIXED: Explicit boundary check to target index 0 of your live sorted results array safely
  const globalSummary = useMemo(() => {
    if (sortedProfiles.length === 0 || !sortedProfiles[0]) {
      return { marketState: 'INSUFFICIENT_DATA', direction: 'FLAT', finalConfidence: 0 };
    }
    return sortedProfiles[0].metrics;
  }, [sortedProfiles]);

  return (
    <div className="ai-strategy-scanner">
      <div className="scanner-header">
        <h3>AI Strategy Scanner</h3>
        <span className="profile-counter">30/30</span>
      </div>

      <div className="scanner-subheader-text">
        30 profiles ranked via real-time WebSocket ticks.
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

      <p className="notice-subtext">
        Waiting for enough ticks. Keep the scanner open to let historical lookback snapshots fill.
      </p>

      <div className="strategy-scroll-list">
        {visualDisplayList.map((item, index) => {
          const isExpanded = activeTab === item.profile.id;
          return (
            <div key={item.profile.id} className="strategy-card-node">
              <div 
                className="card-summary" 
                onClick={() => setActiveTab(isExpanded ? null : item.profile.id)}
              >
                <div className="rank-badge">#{index + 1}</div>
                <div className="meta-details">
                  <h4>{item.profile.name}</h4>
                  <p>Score {item.metrics.scannerScore}% &nbsp; Confidence {item.metrics.finalConfidence}%</p>
                </div>
                <span className={`tier-badge ${item.profile.tier.toLowerCase()}`}>
                  {item.profile.tier}
                </span>
                <span className="arrow-toggle">{isExpanded ? '▲' : '▼'}</span>
              </div>

              {isExpanded && (
                <div className="card-expanded-drawer">
                  <p className="desc">{item.profile.description}</p>
                  
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
                      <div className="lbl">CONFIDENCE</div>
                      <div className="txt-bold">...</div>
                    </div>
                  </div>

                  <div className="live-metrics-data-row spec-margin">
                    <div className="data-cell">
                      <div className="lbl">LIVE TICKS</div>
                      <div className="txt-bold">{item.metrics.ticksLoaded}/100</div>
                    </div>
                    <div className="data-cell">
                      <div className="lbl">REQUIRED</div>
                      <div className="txt-bold">{item.profile.confidenceGate}%</div>
                    </div>
                    <div className="data-cell">
                      <div className="lbl">CONFIDENCE GATE</div>
                      <div className="txt-bold highlight-purple">
                        {item.metrics.ticksLoaded >= 100 ? 'RUN' : 'WAIT'}
                      </div>
                    </div>
                  </div>

                  <div className="progress-bar-container">
                    <div className="bar-labels">
                      <span>Scanner Score</span>
                      <span>{item.metrics.scannerScore}%</span>
                    </div>
                    <div className="base-track">
                      <div className="fill" style={{ width: `${item.metrics.scannerScore}%` }}></div>
                    </div>
                  </div>

                  <div className="progress-bar-container">
                    <div className="bar-labels">
                      <span>Market Compatibility</span>
                      <span>{item.metrics.marketCompatibility}%</span>
                    </div>
                    <div className="base-track">
                      <div className="fill" style={{ width: `${item.metrics.marketCompatibility}%` }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <button className="scan-again-btn" onClick={() => setRawPipelineData([])}>
        ↺ Scan Again
      </button>
    </div>
  );
};

export default FloatingAI;
