// FloatingAI.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { DerivScannerBridge } from './scannerBridge';
import { ScannerLogicEngine } from './scannerLogic';
import './FloatingAI.css';

interface Props {
  derivContext: any; // Context passed down from Bot Builder main shell
  selectedMarket?: string;
}

export const FloatingAI: React.FC<Props> = ({ derivContext, selectedMarket = 'R_100' }) => {
  const [rawPipelineData, setRawPipelineData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Instantiate scanning engines inside component persistent memory
  const logicEngine = useMemo(() => new ScannerLogicEngine(), []);
  const networkBridge = useMemo(() => new DerivScannerBridge(derivContext), [derivContext]);

  useEffect(() => {
    logicEngine.setMarket(selectedMarket);

    // Bootstrap real-time subscriptions
    networkBridge.initPipeline([selectedMarket], (symbol, price) => {
      logicEngine.injectTick(symbol, price);
      
      // Update pipeline matrices inside component lifecycle on every tick emission
      const frameAnalysis = logicEngine.runScannerPipeline();
      setRawPipelineData(frameAnalysis);
    });

    return () => {
      networkBridge.closePipeline();
    };
  }, [selectedMarket, logicEngine, networkBridge]);

  // CRITICAL STEP: Priority Array Matrix sorting from high confidence downwards
  const sortedProfiles = useMemo(() => {
    return [...rawPipelineData].sort((a, b) => b.metrics.finalConfidence - a.metrics.finalConfidence);
  }, [rawPipelineData]);

  // Aggregate high level overview cards metrics
  const coreAggregate = sortedProfiles[0] || null;

  return (
    <div className="ai-strategy-scanner">
      <div className="scanner-header">
        <h3>🟢 AI Strategy Scanner</h3>
        <span className="profile-counter">{sortedProfiles.length}/30 Profiles Loaded</span>
      </div>

      {/* High Level Metrics Cards Bar */}
      <div className="metrics-banner-grid">
        <div className="metric-box">
          <label>MARKET STATE</label>
          <div className="val">{coreAggregate?.metrics.marketState || 'LOADING'}</div>
        </div>
        <div className="metric-box">
          <label>DIRECTION</label>
          <div className="val highlight-yellow">{coreAggregate?.metrics.direction || 'FLAT'}</div>
        </div>
        <div className="metric-box">
          <label>CONFIDENCE</label>
          <div className="val">{coreAggregate?.metrics.finalConfidence || 0}%</div>
        </div>
      </div>

      <p className="notice-subtext">
        Waiting for enough ticks. Keep the scanner open to let historical lookback snapshots fill.
      </p>

      {/* Dynamic Scannable Scroll Container Pipeline */}
      <div className="strategy-scroll-list">
        {sortedProfiles.map((item, index) => {
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
                  <p>Score: {item.metrics.scannerScore}% | Confidence: {item.metrics.finalConfidence}%</p>
                </div>
                <span className={`tier-badge ${item.profile.tier.toLowerCase()}`}>
                  {item.profile.tier}
                </span>
              </div>

              {/* Accordion view showing deeper layout details when clicked */}
              {isExpanded && (
                <div className="card-expanded-drawer">
                  <p className="desc">{item.profile.description}</p>
                  <div className="inner-metrics-grid">
                    <div>Live Ticks: <span>{item.metrics.ticksLoaded}/{item.profile.requiredTicks}</span></div>
                    <div>Required Gate: <span>{item.profile.confidenceGate}%</span></div>
                    <div>Gate Status: <span className="highlight-gate">{item.metrics.finalConfidence >= item.profile.confidenceGate ? 'RUN' : 'WAIT'}</span></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
