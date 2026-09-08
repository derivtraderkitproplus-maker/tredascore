// FloatingAI.tsx - PART 1: Core Module Initializers & Dynamic State Architecture

import React, { useEffect, useState, useMemo } from 'react';
import { STRATEGY_PROFILES } from '../strategies';
import { ScannerLogicEngine } from './scannerLogic';
import './FloatingAI.css';

interface FloatingAIProps {
  derivContext?: any;
  onCloseScanner?: () => void;
}

export const FloatingAI: React.FC<FloatingAIProps> = ({ derivContext = {}, onCloseScanner }) => {
  // Live snapshot state directly processing metrics without multi-file path splits
  const [rawPipelineData, setRawPipelineData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  
  // Isolate custom user param sizing updates explicitly by system profile ID
  const [customStrategySettings, setCustomStrategySettings] = useState<Record<string, { stake: string; stopLoss: string; takeProfit: string }>>({});

  // INPUT FOCUS PROTECTION TRACKER: Freezes visual re-sorting rows while user types parameters
  const [isTypingFocused, setIsTypingFocused] = useState<boolean>(false);

  // Dedicated visual layout memory array to preserve row rows when tabs pop open
  const [frozenDisplayList, setFrozenDisplayList] = useState<any[]>([]);

  // Supported asset index tracker arrays matching your strategy registries uniformly
  const trackingSymbols = useMemo(() => ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'], []);
// FloatingAI.tsx - PART 2: Lifecycles, Direct API Subscriptions & Seeder Fallbacks

  useEffect(() => {
    setRawPipelineData([]);
    setFrozenDisplayList([]);

    // 1. INSTANTIATE LOGIC CORE DIRECTLY IN MAIN THREAD MATRIX CONTEXT
    const coreLogicEngine = new ScannerLogicEngine();
    const globalWin = window as any;

    const initialPriceMappings: Record<string, number> = {
      'R_10': 45.10, 'R_25': 192.40, 'R_50': 310.85, 'R_75': 525.60, 'R_100': 845.20
    };

    trackingSymbols.forEach(symbol => {
      let baselinePrice = initialPriceMappings[symbol] || 500.00;
      for (let i = 0; i < 115; i++) {
        baselinePrice += (Math.random() - 0.5) * (symbol === 'R_100' ? 0.85 : 0.25);
        coreLogicEngine.injectTick(symbol, baselinePrice);
      }
    });

    let liveStreamSubscription: any = null;

    // 2. LIVE INTERCEPT: Subscribe straight to the exposed platform socket channels
    if (globalWin.api_base?.api && typeof globalWin.api_base.api.onMessage === 'function') {
      console.log("🔌 [LIVE SCANNER] Hooked natively to global api_base stream provider.");
      
      liveStreamSubscription = globalWin.api_base.api.onMessage().subscribe((res: any) => {
        try {
          if (res && res.msg_type === 'tick' && res.tick) {
            const { symbol, quote } = res.tick;
            
            let cleanedSymbol = symbol;
            if (symbol.includes('1HZ10V')) cleanedSymbol = 'R_10';
            if (symbol.includes('1HZ25V')) cleanedSymbol = 'R_25';
            if (symbol.includes('1HZ50V')) cleanedSymbol = 'R_50';
            if (symbol.includes('1HZ75V')) cleanedSymbol = 'R_75';
            if (symbol.includes('1HZ100V')) cleanedSymbol = 'R_100';

            if (trackingSymbols.includes(cleanedSymbol)) {
              const numericSpotPrice = parseFloat(quote);
              
              // Pipe real broker index shifts straight into your technical indicators
              coreLogicEngine.injectTick(cleanedSymbol, numericSpotPrice);

              if (!activeTab && !isTypingFocused) {
                const liveCalculatedFrame = coreLogicEngine.runScannerPipeline();
                setRawPipelineData(liveCalculatedFrame);
              }
            }
          }
        } catch (e) {
          console.error("Live streaming processing exception:", e);
        }
      });
    }

    // 3. SECURE SYSTEM TICK TIMER FALLBACK
    const backupTickTimer = setInterval(() => {
      if (activeTab || isTypingFocused) return;
      
      trackingSymbols.forEach(symbol => {
        const currentPrice = initialPriceMappings[symbol] || 500.00;
        const tickNoise = (Math.random() - 0.5) * (symbol === 'R_100' ? 1.40 : 0.45);
        const updatedPrice = parseFloat((currentPrice + tickNoise).toFixed(2));
        
        initialPriceMappings[symbol] = updatedPrice;
        coreLogicEngine.injectTick(symbol, updatedPrice);
      });

      const updatedSnapshots = coreLogicEngine.runScannerPipeline();
      setRawPipelineData(updatedSnapshots);
    }, 1000);

    return () => {
      clearInterval(backupTickTimer);
      if (liveStreamSubscription && typeof liveStreamSubscription.unsubscribe === 'function') {
        liveStreamSubscription.unsubscribe();
      }
    };
  }, [activeTab, isTypingFocused, trackingSymbols]);
// FloatingAI.tsx - PART 3: Fallback Array Filters, Summaries, & Injection Handlers

  // Handle baseline sorting actions linking directly to the isolated status markers
  const liveSortedProfiles = useMemo(() => {
    if (rawPipelineData.length === 0) return [];
    return [...rawPipelineData].sort((a, b) => {
      const weightA = a.tierOverride === 'HIGH' ? 2 : (a.tierOverride === 'MEDIUM' ? 1 : 0);
      const weightB = b.tierOverride === 'HIGH' ? 2 : (b.tierOverride === 'MEDIUM' ? 1 : 0);
      if (weightB !== weightA) return weightB - weightA;
      return b.finalConfidence - a.finalConfidence;
    });
  }, [rawPipelineData]);

  // Lock configuration visual layers before card drawers expand to stabilize layout rows
  useEffect(() => {
    if (!activeTab && liveSortedProfiles.length > 0) {
      setFrozenDisplayList(liveSortedProfiles);
    }
  }, [liveSortedProfiles, activeTab]);

  // Master visual display list: Merges real data streams or falls back to clean registry footprints smoothly
  const visualDisplayList = useMemo(() => {
    if (activeTab && frozenDisplayList.length > 0) return frozenDisplayList;
    if (liveSortedProfiles.length > 0) return liveSortedProfiles;

    return STRATEGY_PROFILES.map(profile => ({
      profileId: profile.id,
      ticksLoaded: 0,
      marketState: 'INITIALIZING...',
      direction: 'FLAT',
      scannerScore: 50,
      marketCompatibility: 50,
      finalConfidence: 50,
      tierOverride: profile.tier,
      status: profile.tier,
      liveAccuracyPercentage: 50
    }));
  }, [liveSortedProfiles, frozenDisplayList, activeTab]);

  // 🎯 RECTIFIED GLOBAL BANNER AGGREGATOR: Fixed array index selector to extract accurate parameters cleanly
  const globalSummary = useMemo(() => {
    if (visualDisplayList && visualDisplayList.length > 0) {
      const firstItem = visualDisplayList[0];
      const match = STRATEGY_PROFILES.find(p => p.id === firstItem.profileId);
      return {
        winnerName: match ? match.name : 'SCANNING...',
        direction: firstItem.direction || 'FLAT',
        finalConfidence: firstItem.finalConfidence || 0
      };
    }
    return { winnerName: 'SCANNING...', direction: 'FLAT', finalConfidence: 0 };
  }, [visualDisplayList]);

  // Load configuration settings isolated explicitly by profile ID into Blockly via direct global reference shortcuts
  const handleLoadBot = (targetDirection: string, resultItem: any) => {
    const strategyId = resultItem.profileId;
    const targetProfile = STRATEGY_PROFILES.find(p => p.id === strategyId);
    if (!targetProfile) return;

    // MICRO TESTING SHIELD: Initialize defaults to protected $0.35 base stake sizes
    const currentSettings = customStrategySettings[strategyId] || { stake: "0.35", stopLoss: "4.00", takeProfit: "8.00" };
    const sanitizedDirection = !targetDirection || targetDirection === 'FLAT' ? 'DOWN' : targetDirection;

    const globalWin = window as any;
    if (globalWin.tredaBridgeInstance) {
      globalWin.tredaBridgeInstance.injectDataToBlockly({
        direction: sanitizedDirection,
        stake: parseFloat(currentSettings.stake) || 0.35,
        stopLoss: parseFloat(currentSettings.stopLoss) || 4.00,
        takeProfit: parseFloat(currentSettings.takeProfit) || 8.00,
        contractType: targetProfile.contractType,   
        targetSymbol: targetProfile.targetSymbol    
      });
    }

    if (typeof onCloseScanner === 'function') onCloseScanner();
  };

  const updateSettingsValue = (strategyId: string, inputField: 'stake' | 'stopLoss' | 'takeProfit', val: string) => {
    setCustomStrategySettings(prev => ({
      ...prev,
      [strategyId]: {
        ...(prev[strategyId] || { stake: '0.35', stopLoss: '4.00', takeProfit: '8.00' }),
        [inputField]: val
      }
    }));
  };
// FloatingAI.tsx - PART 4: Markup Header, Global Banner, & Strategy Card Node Loop

  return (
    <div className="ai-strategy-scanner">
      {/* 🌐 A. SCANNER PANEL CONTEXT HEADER BAR */}
      <div className="scanner-header">
        <div className="header-title-block" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <h3>AI Multi-Asset Scanner</h3>
          <div className="scanner-subheader-text" style={{ margin: '2px 0 0 0' }}>
            {activeTab ? "🔒 Metrics Locked for Editing Parameters" : "Balanced strategies rank below. Tap card to edit."}
          </div>
        </div>
        <div className="header-controls-block" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="profile-counter">8/8</span>
          <button className="scanner-close-x-btn" onClick={() => onCloseScanner?.()}>✕</button>
        </div>
      </div>

      {/* 🌐 B. METRICS SUMMARY HIGHLIGHT BANNER */}
      <div className="metrics-banner-grid">
        <div className="metric-box"><label>GLOBAL WINNER</label><div className="val">{globalSummary.winnerName}</div></div>
        <div className="metric-box"><label>DIRECTION</label><div className="val highlight-yellow">{globalSummary.direction}</div></div>
        <div className="metric-box"><label>CONFIDENCE</label><div className="val">{globalSummary.finalConfidence}%</div></div>
      </div>

      {/* 🌐 C. DYNAMIC STRATEGY CARD SCROLL LIST GRID */}
      <div className="strategy-scroll-list">
        {visualDisplayList.map((item, index) => {
          const isExpanded = activeTab === item.profileId;
          const currentStatus = item.tierOverride || 'LOW';
          const match = STRATEGY_PROFILES.find(p => p.id === item.profileId);
          
          const strategyNameLabel = match ? match.name : 'Unknown System';
          const assetDisplayLabel = match ? match.targetSymbol.replace('R_', 'Volatility ') : 'Asset';
          const contractDisplayLabel = match ? match.contractType.replace(/_/g, ' ') : 'Contract';
          const isHighestConfidence = item.finalConfidence >= 90;

          const rowSettings = customStrategySettings[item.profileId] || { stake: "0.35", stopLoss: "4.00", takeProfit: "8.00" };

          return (
            <div key={item.profileId} className={`strategy-card-node ${isExpanded ? 'card-node--frozen' : ''} ${isHighestConfidence ? 'treda-active-high-signal-flash' : ''}`}>
              {/* Card Summary Title Bar Block */}
              <div className="card-summary" onClick={() => setActiveTab(isExpanded ? null : item.profileId)}>
                <div className="rank-badge">#{index + 1}</div>
                <div className="meta-details">
                  <h4>{strategyNameLabel}</h4>
                  <div className="strategy-tags-row" style={{ display: 'flex', gap: '6px', margin: '4px 0', flexWrap: 'wrap' }}>
                    <span className={`asset-tag symbol-${match?.targetSymbol.toLowerCase()}`} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#2a3243', color: '#00e676', fontWeight: 'bold' }}>{assetDisplayLabel}</span>
                    <span className="contract-tag" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#374151', color: '#e0e0e0' }}>{contractDisplayLabel}</span>
                  </div>
                  <p>Score {item.scannerScore}% &nbsp; Confidence {item.finalConfidence}%</p>
                </div>
                <div className="badge-column"><span className={`tier-badge ${currentStatus.toLowerCase()}`}>{currentStatus}</span></div>
                <div className="arrow-toggle">{isExpanded ? '▲' : '▼'}</div>
              </div>

              {/* Card Expanded Custom Param Inputs Drawer */}
              {isExpanded && (
                <div className="card-expanded-drawer">
                  <div className="ai-input-parameter-grid">
                    <div className="input-cell">
                      <label>STAKE (USD)</label>
                      <input type="number" value={rowSettings.stake} placeholder="0.35" onChange={(e) => updateSettingsValue(item.profileId, 'stake', e.target.value)} onFocus={() => setIsTypingFocused(true)} onBlur={() => setIsTypingFocused(false)} />
                    </div>
                    <div className="input-cell">
                      <label>STOP LOSS</label>
                      <input type="number" value={rowSettings.stopLoss} placeholder="4.00" onChange={(e) => updateSettingsValue(item.profileId, 'stopLoss', e.target.value)} onFocus={() => setIsTypingFocused(true)} onBlur={() => setIsTypingFocused(false)} />
                    </div>
                    <div className="input-cell">
                      <label>TAKE PROFIT</label>
                      <input type="number" value={rowSettings.takeProfit} placeholder="8.00" onChange={(e) => updateSettingsValue(item.profileId, 'takeProfit', e.target.value)} onFocus={() => setIsTypingFocused(true)} onBlur={() => setIsTypingFocused(false)} />
                    </div>
                  </div>

                  {/* Network Feeds Status Matrix Labels */}
                  <div className="live-metrics-data-row">
                    <div className="data-cell"><div className="lbl">LIVE MARKET</div><div className="txt-bold">{item.marketState}</div></div>
                    <div className="data-cell"><div className="lbl">DIRECTION</div><div className="txt-bold highlight-yellow">{item.direction}</div></div>
                    <div className="data-cell"><div className="lbl">TARGET ASSET</div><div className="txt-bold highlight-purple">{assetDisplayLabel}</div></div>
                  </div>

                  {/* Operational Launch Options Buttons */}
                  <div className="action-buttons-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                    <button className="inner-drawer-load-btn" onClick={() => handleLoadBot(item.direction, item)}>📥 LOAD STRATEGY PARAMETERS</button>
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

export default FloatingAI;
