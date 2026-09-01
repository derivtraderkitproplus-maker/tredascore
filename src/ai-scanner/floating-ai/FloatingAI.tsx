// FloatingAI.tsx (Updated Sorting & Display Logic Segment)

  // 1. Live real-time sorting matrix calculation
  const sortedProfiles = useMemo(() => {
    if (rawPipelineData.length === 0) return [];
    // Enforces descending rank sorting by subtracting final confidence values
    return [...rawPipelineData].sort((a, b) => b.metrics.finalConfidence - a.metrics.finalConfidence);
  }, [rawPipelineData]);

  // 2. FIXED: Fallback array prioritizes live sorted profiles first, only using placeholders if data length is zero
  const visualDisplayList = useMemo(() => {
    if (sortedProfiles.length > 0) return sortedProfiles;
    
    // Default fallback placeholder map when application first mounts or loops load
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

  // 3. FIXED: Global headers accurately reflect the highest configuration value at array position [0]
  const globalSummary = useMemo(() => {
    if (sortedProfiles.length === 0) {
      return { marketState: 'INSUFFICIENT_DATA', direction: 'FLAT', finalConfidence: 0 };
    }
    // Grabs index 0 which is guaranteed to be the highest confidence after sorting executes
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
                {/* FIXED: Dynamic card positioning indicator tracking active layout rankings */}
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
                      <div className="txt-bold">{item.metrics.finalConfidence}%</div>
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
