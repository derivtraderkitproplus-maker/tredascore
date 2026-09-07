// FloatingAI.tsx - PART 1: Module Initializers & Dynamic State Architecture

import React, { useEffect, useState, useMemo } from 'react';
import { DerivScannerBridge } from './scannerBridge';
import { ScannerLogicEngine, EvaluationFrame } from './scannerLogic';
import { STRATEGY_PROFILES } from './strategies';
import './FloatingAI.css';

interface FloatingAIProps {
  derivContext?: any;
  onCloseScanner?: () => void;
}

export const FloatingAI: React.FC<FloatingAIProps> = ({ derivContext = {}, onCloseScanner }) => {
  const [rawPipelineData, setRawPipelineData] = useState<EvaluationFrame[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Maintain a singular dynamic map object to isolate user adjustments strictly by profile ID
  const [customStrategySettings, setCustomStrategySettings] = useState<Record<string, { stake: string; stopLoss: string; takeProfit: string }>>({});

  // INPUT FOCUS TRACKER - Freezes data streaming calculation frames mid-keystroke to stop visual jumping
  const [isTypingFocused, setIsTypingFocused] = useState<boolean>(false);

  // Instantiates persistent core engine layers to preserve calculations cross-renders
  const logicEngine = useMemo(() => new ScannerLogicEngine(), []);
  const networkBridge = useMemo(() => new DerivScannerBridge(derivContext), [derivContext]);

  // Dedicated layout buffer memory to lock card sorting orders when parameters expand
  const [frozenDisplayList, setFrozenDisplayList] = useState<EvaluationFrame[]>([]);

  // Supported synthetic index ticker keys matching your global asset engine registry
  const trackingSymbols = useMemo(() => ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'], []);
// FloatingAI.tsx - PART 2: Lifecycles, Tick Pre-Seeding Arrays, & Global Layout Aggregators

  // Synchronize component input editing focus states down to the calculation core logic instance
  useEffect(() => {
    const shouldFreezeBackend = activeTab !== null || isTypingFocused;
    logicEngine.setEditingState(shouldFreezeBackend);
  }, [activeTab, isTypingFocused, logicEngine]);

  useEffect(() => {
    setRawPipelineData([]);
    setFrozenDisplayList([]);

    // 1. DYNAMIC PRE-SEED GENERATION LAYER: Hydrate array buffers to satisfy indicator thresholds
    trackingSymbols.forEach(symbol => {
      let baseMockPrice = 845.20;
      if (symbol === 'R_10') baseMockPrice = 45.10;
      if (symbol === 'R_25') baseMockPrice = 192.40;
      if (symbol === 'R_50') baseMockPrice = 310.85;
      if (symbol === 'R_75') baseMockPrice = 525.60;
      
      for (let i = 0; i < 115; i++) {
        const noise = (Math.random() - 0.5) * 0.45;
        baseMockPrice += noise;
        logicEngine.injectTick(symbol, baseMockPrice);
      }
    });
    
    const initialFrame = logicEngine.runScannerPipeline();
    setRawPipelineData(initialFrame);

    // 2. BACKGROUND TICK MONITOR PIPELINE: Simulates active tracking shifts sequentially
    const liveSimulationInterval = setInterval(() => {
      trackingSymbols.forEach(symbol => {
        const currentNoiseBase = 0.60;
        const noise = (Math.random() - 0.5) * currentNoiseBase;
        
        const previousTicks = (logicEngine as any).tickRegistry[symbol] || [845.20];
        const lastPrice = previousTicks[previousTicks.length - 1];
        
        logicEngine.injectTick(symbol, lastPrice + noise);
      });

      // Maintain rendering loop integrity if fields are actively receiving user edits
      if (activeTab || isTypingFocused) return;

      const updatedFrame = logicEngine.runScannerPipeline();
      setRawPipelineData(updatedFrame);
    }, 1000);

    // 3. MULTIPLEXING NETWORK LISTENER PIPELINE
    networkBridge.initPipeline(trackingSymbols, (symbol, price) => {
      logicEngine.injectTick(symbol, price);
      
      if (activeTab || isTypingFocused) return; 
      const frameAnalysis = logicEngine.runScannerPipeline();
      setRawPipelineData(frameAnalysis);
    });

    return () => {
      clearInterval(liveSimulationInterval);
      networkBridge.closePipeline();
    };
  }, [logicEngine, networkBridge, activeTab, isTypingFocused, trackingSymbols]);

  // Handle baseline sorting actions linking directly to the isolated status markers
  const liveSortedProfiles = useMemo(() => {
    if (rawPipelineData.length === 0) return [];
    return [...rawPipelineData].sort((a, b) => {
      const rankWeightA = a.metrics.status === 'HIGH' ? 2 : (a.metrics.status === 'MEDIUM' ? 1 : 0);
      const rankWeightB = b.metrics.status === 'HIGH' ? 2 : (b.metrics.status === 'MEDIUM' ? 1 : 0);
      
      if (rankWeightB !== rankWeightA) return rankWeightB - rankWeightA;
      return b.metrics.finalConfidence - a.metrics.finalConfidence;
    });
  }, [rawPipelineData]);

  // Cache configuration layers before drawers expand to keep user text views from shifting
  useEffect(() => {
    if (!activeTab && liveSortedProfiles.length > 0) {
      setFrozenDisplayList(liveSortedProfiles);
    }
  }, [liveSortedProfiles, activeTab]);

  // Isolated matrix display layer rules
  const visualDisplayList = useMemo(() => {
    if (activeTab && frozenDisplayList.length > 0) {
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
        status: 'LOW',
        tierOverride: (profile as any).tier
      }
    }));
  }, [liveSortedProfiles, frozenDisplayList, activeTab]);

  // 🎯 RECTIFIED GLOBAL BANNER AGGREGATOR: Extracts the actual winner name string 
  // instead of technical state descriptions to fix the blank layout block display bug!
  const globalSummary = useMemo(() => {
    if (visualDisplayList && visualDisplayList.length > 0 && visualDisplayList[0]?.profile) {
      return {
        winnerName: visualDisplayList[0].profile.name,
        direction: visualDisplayList[0].metrics.direction,
        finalConfidence: visualDisplayList[0].metrics.finalConfidence
      };
    }
    return { winnerName: 'SCANNING...', direction: 'FLAT', finalConfidence: 0 };
  }, [visualDisplayList]);
// FloatingAI.tsx - PART 3: Operational Action Routers & Base Markup Layouts

  // Load configuration settings isolated explicitly by profile ID into Blockly
  const handleLoadBot = (targetDirection: string, frame: EvaluationFrame) => {
    const strategyId = frame.profile.id;
    
    const currentSettings = customStrategySettings[strategyId] || { 
      stake: "3.00", 
      stopLoss: "4.00", 
      takeProfit: "8.00" 
    };

    // 🎯 RECTIFIED DIRECTION SHIELD: If background noise sets direction to FLAT,
    // this automatically enforces a clean DOWN parameter choice to prevent Blockly parameter skips!
    const sanitizedDirection = !targetDirection || targetDirection === 'FLAT' ? 'DOWN' : targetDirection;

    networkBridge.injectDataToBlockly({
      direction: sanitizedDirection,
      stake: parseFloat(currentSettings.stake) || 3.00,
      stopLoss: parseFloat(currentSettings.stopLoss) || 4.00,
      takeProfit: parseFloat(currentSettings.takeProfit) || 8.00,
      contractType: frame.profile.contractType,   
      targetSymbol: frame.profile.targetSymbol    
    });

    if (typeof onCloseScanner === 'function') {
      onCloseScanner();
    }
  };

  const handleManualTelegramShare = (frame: EvaluationFrame) => {
    if (!frame) return;
    logicEngine.forceManualTelegramBroadcast(frame);
    alert(`📢 Manual Broadcast Sent!\nPushed ${frame.profile.name} directly to your channel.`);
  };

  const updateSettingsValue = (strategyId: string, inputField: 'stake' | 'stopLoss' | 'takeProfit', val: string) => {
    setCustomStrategySettings(prev => {
      const freshMap = {
        ...prev,
        [strategyId]: {
          ...(prev[strategyId] || { stake: '3.00', stopLoss: '4.00', takeProfit: '8.00' }),
          [inputField]: val
        }
      };

      const targetProfile = STRATEGY_PROFILES.find(p => p.id === strategyId);
      if (targetProfile) {
        const settings = targetProfile.runtimeSettings || {};
        if (inputField === 'stake') settings.multiplier = parseFloat(val) || 3.0;
        targetProfile.runtimeSettings = settings;
      }

      return freshMap;
    });
  };

  const handleResetMetrics = () => {
    setActiveTab(null);
    setRawPipelineData([]);
    setFrozenDisplayList([]);
    
    trackingSymbols.forEach(symbol => {
      let basePrice = 845.20;
      for (let i = 0; i < 115; i++) {
        const noise = (Math.random() - 0.5) * 0.45;
        basePrice += noise;
        logicEngine.injectTick(symbol, basePrice);
      }
    });

    const resetFrame = logicEngine.runScannerPipeline();
    setRawPipelineData(resetFrame);
  };

  return (
    <div className="ai-strategy-scanner">
      {/* Upper Context Header Bar */}
      <div className="scanner-header">
        <div className="header-title-block" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <h3>AI Multi-Asset Scanner</h3>
          <div className="scanner-subheader-text" style={{ margin: '2px 0 0 0' }}>
            {activeTab ? "🔒 Metrics Locked for Editing Parameters" : "Balanced strategies rank below. Tap card to edit."}
          </div>
        </div>
        
        <div className="header-controls-block" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="profile-counter">30/30</span>
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

      {/* Synchronized Metrics Highlight Banner */}
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
// FloatingAI.tsx - PART 4: Dynamic Strategy Card Node Grid Mapping Loops

      <div className="strategy-scroll-list">
        {visualDisplayList.map((item, index) => {
          const isExpanded = activeTab === item.profile.id;
          const currentStatus = item.metrics.status || 'LOW';
          const assetDisplayLabel = item.profile.targetSymbol.replace('R_', 'Volatility ');
          const contractDisplayLabel = item.profile.contractType.replace(/_/g, ' ');

          // 🎯 NEON GREEN INTERACTION PULSE TRIGGER: 
          // Evaluates confidence calculations over raw Web Worker ticks to trigger the pulse flash!
          const isHighestConfidenceTargetPointHit = item.metrics?.finalConfidence >= 90;

          const rowSettings = customStrategySettings[item.profile.id] || { 
            stake: "3.00", 
            stopLoss: "4.00", 
            takeProfit: "8.00" 
          };

          return (
            <div 
              key={item.profile.id} 
              className={`strategy-card-node ${isExpanded ? 'card-node--frozen' : ''} ${isHighestConfidenceTargetPointHit ? 'treda-active-high-signal-flash' : ''}`}
            >
              {/* Collapsed Item Summary Row View */}
              <div className="card-summary" onClick={() => setActiveTab(isExpanded ? null : item.profile.id)}>
                <div className="rank-badge">#{index + 1}</div>
                <div className="meta-details">
                  <h4>{item.profile.name}</h4>
                  <div className="strategy-tags-row" style={{ display: 'flex', gap: '6px', margin: '4px 0', flexWrap: 'wrap' }}>
                    <span className={`asset-tag symbol-${item.profile.targetSymbol.toLowerCase()}`} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#2a3243', color: '#00e676', fontWeight: 'bold' }}>
                      {assetDisplayLabel}
                    </span>
                    <span className="contract-tag" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#374151', color: '#e0e0e0' }}>
                      {contractDisplayLabel}
                    </span>
                  </div>
                  <p>Score {item.metrics.scannerScore}% &nbsp; Confidence {item.metrics.finalConfidence}%</p>
                </div>
                <div className="badge-column">
                  <span className={`tier-badge ${currentStatus.toLowerCase()}`}>{currentStatus}</span>
                </div>
                <div className="arrow-toggle">{isExpanded ? '▲' : '▼'}</div>
              </div>

              {/* Expanded Component Input Configuration Drawer View */}
              {isExpanded && (
                <div className="card-expanded-drawer">
                  <div className="ai-input-parameter-grid">
                    <div className="input-cell">
                      <label>STAKE (USD)</label>
                      <input 
                        type="number" 
                        value={rowSettings.stake} 
                        placeholder="3.00"
                        onChange={(e) => updateSettingsValue(item.profile.id, 'stake', e.target.value)}
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
                        onChange={(e) => updateSettingsValue(item.profile.id, 'stopLoss', e.target.value)}
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
                        onChange={(e) => updateSettingsValue(item.profile.id, 'takeProfit', e.target.value)}
                        onFocus={() => setIsTypingFocused(true)}
                        onBlur={() => setIsTypingFocused(false)}
                      />
                    </div>
                  </div>

                  {/* Context Visual Check Labels */}
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
                      <div className="lbl">TARGET ASSET</div>
                      <div className="txt-bold highlight-purple">{assetDisplayLabel}</div>
                    </div>
                  </div>

                  {/* Core Action Trigger Injection Buttons */}
                  <div className="action-buttons-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                    <button className="inner-drawer-load-btn" onClick={() => handleLoadBot(item.metrics.direction, item)}>
                      📥 Load Strategy Parameters
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
      
      {/* Operational Reset Context Toggle Button */}
      <button className="scan-again-btn" onClick={handleResetMetrics}>
        ↺ Unfreeze & Refresh Ticks
      </button>
    </div>
  );
};

export default FloatingAI;
