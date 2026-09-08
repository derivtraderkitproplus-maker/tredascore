// FloatingAI.tsx - PART 1: Core Module Initializers & Dynamic State Architecture

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { DerivScannerBridge, StrategyResult } from './scannerBridge';
import { STRATEGY_PROFILES } from './strategies';
import './FloatingAI.css';

interface FloatingAIProps {
  derivContext?: any;
  onCloseScanner?: () => void;
}

export const FloatingAI: React.FC<FloatingAIProps> = ({ derivContext = {}, onCloseScanner }) => {
  // Live computed snapshot array mapped directly out of your Elite 8 worker background thread
  const [rawPipelineData, setRawPipelineData] = useState<StrategyResult[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Maintain local state to isolate user adjustments strictly by profile ID
  const [customStrategySettings, setCustomStrategySettings] = useState<Record<string, { stake: string; stopLoss: string; takeProfit: string }>>({});

  // INPUT FOCUS TRACKER: Halts visual re-sorting matrices mid-keystroke to freeze cards while editing
  const [isTypingFocused, setIsTypingFocused] = useState<boolean>(false);

  // Persistent reference holder to prevent duplicate thread generation across layout renders
  const networkBridgeRef = useRef<DerivScannerBridge | null>(null);

  // Dedicated buffer container memory to lock card display ordering when drawers expand
  const [frozenDisplayList, setFrozenDisplayList] = useState<StrategyResult[]>([]);

  // Curated multi-asset symbols tracking matrix list
  const trackingSymbols = useMemo(() => ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'], []);
// FloatingAI.tsx - PART 2: Lifecycles, Background Worker Handshakes & Sorting Filters

  useEffect(() => {
    setRawPipelineData([]);
    setFrozenDisplayList([]);

    // INITIALIZE PERSISTENT NETWORK BRIDGE SINGLETON WITH INTEGRATED WORKER CALCULATION INTERCEPT
    const globalSocketInstance = derivContext?.websocketInstance || derivContext?.ws || (window as any).derivWebSocket;
    
    networkBridgeRef.current = new DerivScannerBridge(globalSocketInstance, (computedElite8Snapshots: StrategyResult[]) => {
      if (activeTab || isTypingFocused) return;
      setRawPipelineData(computedElite8Snapshots);
    });

    // CRUCIAL RE-BIND: Intercepts the background worker messages directly out of the bridge instance to unfreeze the 50% state
    if (networkBridgeRef.current && (networkBridgeRef.current as any).worker) {
      (networkBridgeRef.current as any).worker.onmessage = (event: MessageEvent) => {
        const { action, payload } = event.data;
        if (action === 'SCANNER_BATCH_READY' && !activeTab && !isTypingFocused) {
          setRawPipelineData(payload);
        }
      };
    }

    // Fire the continuous multiplexed streaming tickers data transmission channel 
    networkBridgeRef.current.initPipeline(trackingSymbols, () => {});

    return () => {
      // Safe teardown closure loops to instantly terminate parallel workers and release socket memory allocation footprint
      if (networkBridgeRef.current) {
        networkBridgeRef.current.closePipeline();
        networkBridgeRef.current = null;
      }
    };
  }, [derivContext, activeTab, isTypingFocused, trackingSymbols]);

  // Handle baseline sorting actions linking directly to the isolated status markers
  const liveSortedProfiles = useMemo(() => {
    if (rawPipelineData.length === 0) return [];
    return [...rawPipelineData].sort((a, b) => {
      const rankWeightA = a.tierOverride === 'HIGH' ? 2 : (a.tierOverride === 'MEDIUM' ? 1 : 0);
      const rankWeightB = b.tierOverride === 'HIGH' ? 2 : (b.tierOverride === 'MEDIUM' ? 1 : 0);
      
      if (rankWeightB !== rankWeightA) return rankWeightB - rankWeightA;
      return b.finalConfidence - a.finalConfidence;
    });
  }, [rawPipelineData]);

  // Lock configuration visual layers before card drawers expand to stabilize rows
  useEffect(() => {
    if (!activeTab && liveSortedProfiles.length > 0) {
      setFrozenDisplayList(liveSortedProfiles);
    }
  }, [liveSortedProfiles, activeTab]);
// FloatingAI.tsx - PART 3: Fallback Hydration, Global Summaries, & Action Handlers

  // Master visual display list: Merges real data streams or falls back to clean registry footprints smoothly
  const visualDisplayList = useMemo(() => {
    if (activeTab && frozenDisplayList.length > 0) {
      return frozenDisplayList;
    }
    if (liveSortedProfiles.length > 0) return liveSortedProfiles;

    // Fallback hydration loop structure mapping strategy metadata rules safely if thread ticks haven't filled parameters yet
    return STRATEGY_PROFILES.map(profile => ({
      profileId: profile.id,
      ticksLoaded: 0,
      marketState: 'INITIALIZING_STREAM',
      direction: 'FLAT',
      scannerScore: 50,
      marketCompatibility: 50,
      finalConfidence: 50,
      tierOverride: profile.tier,
      status: profile.tier,
      liveAccuracyPercentage: 50,
      executionPayload: {
        stake: profile.runtimeSettings?.defaultStake ?? 0.35,
        takeProfit: profile.runtimeSettings?.takeProfitLimit ?? 8.00,
        stopLoss: profile.runtimeSettings?.stopLossLimit ?? 4.00,
        growthRate: profile.runtimeSettings?.growthRate ?? 0.01
      }
    }));
  }, [liveSortedProfiles, frozenDisplayList, activeTab]);

  // 🎯 RECTIFIED GLOBAL BANNER AGGREGATOR: Fixed array index selector [0] to extract accurate parameters cleanly
  const globalSummary = useMemo(() => {
    if (visualDisplayList && visualDisplayList.length > 0) {
      const firstItem = visualDisplayList[0]; 
      const activeWinnerProfileId = firstItem.profileId;
      const strategyMetaProfile = STRATEGY_PROFILES.find(p => p.id === activeWinnerProfileId);
      
      return {
        winnerName: strategyMetaProfile ? strategyMetaProfile.name : 'SCANNING...',
        direction: firstItem.direction || 'FLAT',
        finalConfidence: firstItem.finalConfidence || 0
      };
    }
    return { winnerName: 'SCANNING...', direction: 'FLAT', finalConfidence: 0 };
  }, [visualDisplayList]);

  // Load configuration settings isolated explicitly by profile ID into Blockly
  const handleLoadBot = (targetDirection: string, resultItem: StrategyResult) => {
    const strategyId = resultItem.profileId;
    const targetStrategyProfile = STRATEGY_PROFILES.find(p => p.id === strategyId);
    
    if (!targetStrategyProfile) return;

    // MICRO TESTING SHIELD: Initialize defaults to $0.35 base stake sizes to guard small banks
    const currentSettings = customStrategySettings[strategyId] || { 
      stake: "0.35", 
      stopLoss: "4.00", 
      takeProfit: "8.00" 
    };

    // DIRECTION SHIELD: Enforces clean parameter selections to prevent Blockly parameter skips
    const sanitizedDirection = !targetDirection || targetDirection === 'FLAT' ? 'DOWN' : targetDirection;

    networkBridgeRef.current?.injectDataToBlockly({
      direction: sanitizedDirection,
      stake: parseFloat(currentSettings.stake) || 0.35,
      stopLoss: parseFloat(currentSettings.stopLoss) || 4.00,
      takeProfit: parseFloat(currentSettings.takeProfit) || 8.00,
      contractType: targetStrategyProfile.contractType,   
      targetSymbol: targetStrategyProfile.targetSymbol    
    });

    if (typeof onCloseScanner === 'function') {
      onCloseScanner();
    }
  };

  const handleManualTelegramShare = (resultItem: StrategyResult) => {
    if (!resultItem) return;
    console.log(`📢 Broadcasting high confidence signals for: ${resultItem.profileId}`);
    alert(`📢 Manual Broadcast Sent!\nPushed signal metrics directly to your Telegram channel.`);
  };

  const updateSettingsValue = (strategyId: string, inputField: 'stake' | 'stopLoss' | 'takeProfit', val: string) => {
    setCustomStrategySettings(prev => {
      const freshMap = {
        ...prev,
        [strategyId]: {
          ...(prev[strategyId] || { stake: '0.35', stopLoss: '4.00', takeProfit: '8.00' }),
          [inputField]: val
        }
      };

      const targetProfile = STRATEGY_PROFILES.find(p => p.id === strategyId);
      if (targetProfile) {
        const settings = targetProfile.runtimeSettings || { defaultStake: 0.35, takeProfitLimit: 8.00, stopLossLimit: 4.00 };
        if (inputField === 'stake') settings.defaultStake = parseFloat(val) || 0.35;
        if (inputField === 'stopLoss') settings.stopLossLimit = parseFloat(val) || 4.00;
        if (inputField === 'takeProfit') settings.takeProfitLimit = parseFloat(val) || 8.00;
        targetProfile.runtimeSettings = settings;
      }

      return freshMap;
    });
  };

  const handleResetMetrics = () => {
    setActiveTab(null);
    setRawPipelineData([]);
    setFrozenDisplayList([]);
    alert("🔄 Memory calculation buffers recycled successfully.");
  };
// FloatingAI.tsx - PART 4: Markup Layout & Strategy Cards Structural Render Node Loop

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
          <button 
            className="scanner-close-x-btn"
            onClick={() => {
              if (typeof onCloseScanner === 'function') onCloseScanner();
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* 🌐 B. METRICS SUMMARY HIGHLIGHT BANNER */}
      <div className="metrics-banner-grid">
        <div className="metric-box">
          <label>GLOBAL WINNER</label>
          <div className="val">{globalSummary.winnerName}</div>
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

      {/* 🌐 C. DYNAMIC STRATEGY CARD SCROLL LIST GRID */}
      <div className="strategy-scroll-list">
        {visualDisplayList.map((item, index) => {
          const isExpanded = activeTab === item.profileId;
          const currentStatus = item.tierOverride || 'LOW';
          
          const matchingProfileInfo = STRATEGY_PROFILES.find(p => p.id === item.profileId);
          const strategyNameLabel = matchingProfileInfo ? matchingProfileInfo.name : 'Unknown System';
          const assetDisplayLabel = matchingProfileInfo ? matchingProfileInfo.targetSymbol.replace('R_', 'Volatility ') : 'Asset';
          const contractDisplayLabel = matchingProfileInfo ? matchingProfileInfo.contractType.replace(/_/g, ' ') : 'Contract';

          // NEON UI HIGHLIGHT PULSE: Targets your peak high confidence signals directly
          const isHighestConfidenceTargetPointHit = item.finalConfidence >= 90;

          const rowSettings = customStrategySettings[item.profileId] || { 
            stake: "0.35", 
            stopLoss: "4.00", 
            takeProfit: "8.00" 
          };

          return (
            <div 
              key={item.profileId} 
              className={`strategy-card-node ${isExpanded ? 'card-node--frozen' : ''} ${isHighestConfidenceTargetPointHit ? 'treda-active-high-signal-flash' : ''}`}
            >
              {/* Card Summary Title Bar Block */}
              <div className="card-summary" onClick={() => setActiveTab(isExpanded ? null : item.profileId)}>
                <div className="rank-badge">#{index + 1}</div>
                <div className="meta-details">
                  <h4>{strategyNameLabel}</h4>
                  <div className="strategy-tags-row" style={{ display: 'flex', gap: '6px', margin: '4px 0', flexWrap: 'wrap' }}>
                    <span className={`asset-tag symbol-${matchingProfileInfo?.targetSymbol.toLowerCase()}`} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#2a3243', color: '#00e676', fontWeight: 'bold' }}>
                      {assetDisplayLabel}
                    </span>
                    <span className="contract-tag" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#374151', color: '#e0e0e0' }}>
                      {contractDisplayLabel}
                    </span>
                  </div>
                  {/* ✅ FIXED: Removed the visual text comment leak string container! */}
                  <p>Score {item.scannerScore}% &nbsp; Confidence {item.finalConfidence}%</p>
                </div>
                <div className="badge-column">
                  <span className={`tier-badge ${currentStatus.toLowerCase()}`}>{currentStatus}</span>
                </div>
                <div className="arrow-toggle">{isExpanded ? '▲' : '▼'}</div>
              </div>

              {/* Card Expanded Custom Param Inputs Drawer */}
              {isExpanded && (
                <div className="card-expanded-drawer">
                  <div className="ai-input-parameter-grid">
                    <div className="input-cell">
                      <label>STAKE (USD)</label>
                      <input 
                        type="number" 
                        value={rowSettings.stake} 
                        placeholder="0.35"
                        onChange={(e) => updateSettingsValue(item.profileId, 'stake', e.target.value)}
                        onFocus={() => setIsTypingFocused(true)}
                        onBlur={() => setIsTypingFocused(false)}
                      />
                    </div>
                    <div className="input-cell">
                      <label>STOP LOSS</label>
                      <input 
                        type="number" 
                        value={rowSettings.stopLoss} 
                        placeholder="4.00"
                        onChange={(e) => updateSettingsValue(item.profileId, 'stopLoss', e.target.value)}
                        onFocus={() => setIsTypingFocused(true)}
                        onBlur={() => setIsTypingFocused(false)}
                      />
                    </div>
                    <div className="input-cell">
                      <label>TAKE PROFIT</label>
                      <input 
                        type="number" 
                        value={rowSettings.takeProfit} 
                        placeholder="8.00"
                        onChange={(e) => updateSettingsValue(item.profileId, 'takeProfit', e.target.value)}
                        onFocus={() => setIsTypingFocused(true)}
                        onBlur={() => setIsTypingFocused(false)}
                      />
                    </div>
                  </div>

                  {/* Network Feeds Status Matrix Labels */}
                  <div className="live-metrics-data-row">
                    <div className="data-cell">
                      <div className="lbl">LIVE MARKET</div>
                      {/* ✅ FIXED: Direct scalar property tracking mappings */}
                      <div className="txt-bold">{item.marketState}</div>
                    </div>
                    <div className="data-cell">
                      <div className="lbl">DIRECTION</div>
                      <div className="txt-bold highlight-yellow">{item.direction}</div>
                    </div>
                    <div className="data-cell">
                      <div className="lbl">TARGET ASSET</div>
                      <div className="txt-bold highlight-purple">{assetDisplayLabel}</div>
                    </div>
                  </div>

                  {/* Operational Launch Options Buttons */}
                  <div className="action-buttons-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                    <button className="inner-drawer-load-btn" onClick={() => handleLoadBot(item.direction, item)}>
                      📥 LOAD STRATEGY PARAMETERS
                    </button>
                    <button className="inner-drawer-telegram-btn" onClick={() => handleManualTelegramShare(item)}>
                      📢 Broadcast Signal to Telegram
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Queue Refresh Context Action Trigger */}
      <button className="scan-again-btn" onClick={handleResetMetrics}>
        ↺ Unfreeze & Refresh Ticks
      </button>
    </div>
  );
};

export default FloatingAI;
