// FloatingAI.tsx - PART 1: Module Initializers & Dynamic State Architecture

import React, { useEffect, useState, useMemo, useRef } from 'react';
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

  // --- DYNAMIC DRAGGABLE SPHERE CORE ENGINE STATE MATRIX ---
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [spherePosition, setSpherePosition] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 76 : 300, y: typeof window !== 'undefined' ? window.innerHeight - 150 : 500 });
  const isDraggingActive = useRef(false);
  const touchOffsetVector = useRef({ x: 0, y: 0 });
  const widgetNodeRef = useRef<HTMLDivElement>(null);
  const [shouldDisplaySphere, setShouldDisplaySphere] = useState<boolean>(true);

  // MONITOR PANELS DETECTOR: Self-destruct trigger when running statistics render on dashboard
  useEffect(() => {
    const checkActiveDashboardText = () => {
      const plainTextContent = document.body.innerText;
      const isSummaryDashboardActive = plainTextContent.includes('Contracts lost') || 
                                        plainTextContent.includes('Contracts won') || 
                                        plainTextContent.includes('Total stake') ||
                                        textContent.includes('Total payout');
      if (isSummaryDashboardActive) {
        setShouldDisplaySphere(false);
      } else {
        setShouldDisplaySphere(true);
      }
    };
    checkActiveDashboardText();
    const mutationObserverInstance = new MutationObserver(checkActiveDashboardText);
    mutationObserverInstance.observe(document.body, { childList: true, subtree: true });
    return () => mutationObserverInstance.disconnect();
  }, []);

  // TOUCH/MOUSE DRAG MOTION CONTROLLERS
  const initiateDragTracking = (clientX: number, clientY: number) => {
    isDraggingActive.current = false; 
    touchOffsetVector.current = { x: clientX - spherePosition.x, y: clientY - spherePosition.y };
  };

  const executeDragMovement = (clientX: number, clientY: number) => {
    isDraggingActive.current = true;
    const boundaryCeilingX = window.innerWidth - 64;
    const boundaryCeilingY = window.innerHeight - 64;
    const boundedLocationX = Math.min(boundaryCeilingX, Math.max(16, clientX - touchOffsetVector.current.x));
    const boundedLocationY = Math.min(boundaryCeilingY, Math.max(16, clientY - touchOffsetVector.current.y));
    setSpherePosition({ x: boundedLocationX, y: boundedLocationY });
  };

  const terminateDragTracking = () => {
    if (!isDraggingActive.current) {
      setIsModalOpen(true);
    }
    isDraggingActive.current = false;
  };

  useEffect(() => {
    const handleViewportOrientationShift = () => {
      setSpherePosition({ x: window.innerWidth - 76, y: window.innerHeight - 150 });
    };
    window.addEventListener('resize', handleViewportOrientationShift);
    return () => window.removeEventListener('resize', handleViewportOrientationShift);
  }, []);
// FloatingAI.tsx - PART 2: Core Lifecycles & Interactive Draggable Sphere Integration

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
        tierOverride: profile.tier
      }
    }));
  }, [liveSortedProfiles, frozenDisplayList, activeTab]);

  // Pulls global display indicators safely using fallback metrics
  const globalSummary = useMemo(() => {
    if (visualDisplayList && visualDisplayList.length > 0 && visualDisplayList[0]?.metrics) {
      return visualDisplayList[0].metrics;
    }
    return { marketState: 'INSUFFICIENT_DATA', direction: 'FLAT', finalConfidence: 0 };
  }, [visualDisplayList]);

  // Render logic blocks dynamically targeting the toggle open switch states
  if (!isModalOpen) {
    if (!shouldDisplaySphere) return null;
    return (
      <>
        {/* SCOPED INJECTED WIDGET STYLES */}
        <style>{`
          .premium-ai-sphere-widget {
            position: fixed !important;
            width: 52px !important;
            height: 52px !important;
            border-radius: 50% !important;
            background: radial-gradient(circle at 30% 30%, #ff4081 0%, #d81b60 60%, #880e4f 100%) !important;
            box-shadow: 0 0 15px rgba(255, 64, 129, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.4), inset 0 -4px 8px rgba(0, 0, 0, 0.4) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: grab !important;
            z-index: 9998 !important;
            user-select: none !important;
            touch-action: none !important;
            animation: sphereFloatingDance 3.5s ease-in-out infinite !important;
          }
          .premium-ai-sphere-widget:active {
            cursor: grabbing !important;
            animation-play-state: paused !important;
          }
          .premium-ai-sphere-widget::before {
            content: '' !important;
            position: absolute !important;
            top: -6px !important;
            left: -6px !important;
            right: -6px !important;
            bottom: -6px !important;
            border-radius: 50% !important;
            border: 2px solid #ff4081 !important;
            opacity: 0 !important;
            animation: neonPulseRing 2s cubic-bezier(0.25, 0, 0, 1) infinite !important;
          }
          .sphere-inner-label {
            color: #ffffff !important;
            font-family: -apple-system, sans-serif !important;
            font-size: 13px !important;
            font-weight: 900 !important;
            letter-spacing: 0.5px !important;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6) !important;
            pointer-events: none !important;
          }
          @keyframes sphereFloatingDance {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
            100% { transform: translateY(0px); }
          }
          @keyframes neonPulseRing {
            0% { transform: scale(0.85); opacity: 0.7; }
            100% { transform: scale(1.22); opacity: 0; }
          }
        `}</style>
        <div
          ref={widgetNodeRef}
          className="premium-ai-sphere-widget"
          style={{ left: `${spherePosition.x}px`, top: `${spherePosition.y}px` }}
          onTouchStart={(e) => initiateDragTracking(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => executeDragMovement(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={terminateDragTracking}
          onMouseDown={(e) => initiateDragTracking(e.clientX, e.clientY)}
          onMouseMove={(e) => { if (e.buttons === 1) executeDragMovement(e.clientX, e.clientY); }}
          onMouseUp={terminateDragTracking}
        >
          <span className="sphere-inner-label">AI</span>
        </div>
      </>
    );
  }
// FloatingAI.tsx - PART 3: Operational Strategy Actions & Template Layout Render

  // Load configuration settings isolated explicitly by profile ID into Blockly
  const handleLoadBot = (targetDirection: string, frame: EvaluationFrame) => {
    const strategyId = frame.profile.id;
    
    const currentSettings = customStrategySettings[strategyId] || { 
      stake: (frame.profile.runtimeSettings?.defaultStake || 3.00).toString(), 
      stopLoss: (frame.profile.runtimeSettings?.stopLossLimit || 4.00).toString(), 
      takeProfit: (frame.profile.runtimeSettings?.takeProfitLimit || 8.00).toString() 
    };

    networkBridge.injectDataToBlockly({
      direction: targetDirection,
      stake: parseFloat(currentSettings.stake) || 3.00,
      stopLoss: parseFloat(currentSettings.stopLoss) || 4.00,
      takeProfit: parseFloat(currentSettings.takeProfit) || 8.00,
      contractType: frame.profile.contractType,   
      targetSymbol: frame.profile.targetSymbol    
    });

    if (typeof onCloseScanner === 'function') {
      onCloseScanner();
    }
    setIsModalOpen(false); // Snap back to floating widget mode cleanly
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
        if (!targetProfile.runtimeSettings) {
          targetProfile.runtimeSettings = { defaultStake: 3.0, stopLossLimit: 4.0, takeProfitLimit: 8.0 };
        }
        if (inputField === 'stake') targetProfile.runtimeSettings.defaultStake = parseFloat(val) || 3.0;
        if (inputField === 'stopLoss') targetProfile.runtimeSettings.stopLossLimit = parseFloat(val) || 4.0;
        if (inputField === 'takeProfit') targetProfile.runtimeSettings.takeProfitLimit = parseFloat(val) || 8.0;
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
              setIsModalOpen(false); // Closes modal interface securely
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="metrics-banner-grid">
        <div className="metric-box">
          <label>GLOBAL WINNER</label>
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
// FloatingAI.tsx - PART 4: Strategy Scroll-List Mapping & Expandable Parameters Panel

      <div className="strategy-scroll-list">
        {visualDisplayList.map((item, index) => {
          const isExpanded = activeTab === item.profile.id;
          const currentStatus = item.metrics.status || item.profile.tier || 'LOW';
          const assetDisplayLabel = item.profile.targetSymbol.replace('R_', 'Volatility ');
          const contractDisplayLabel = item.profile.contractType.replace(/_/g, ' ');

          // Fallback settings metrics update natively from profile definitions
          const rowSettings = customStrategySettings[item.profile.id] || { 
            stake: (item.profile.runtimeSettings?.defaultStake || 3.00).toString(), 
            stopLoss: (item.profile.runtimeSettings?.stopLossLimit || 4.00).toString(), 
            takeProfit: (item.profile.runtimeSettings?.takeProfitLimit || 8.00).toString() 
          };

          return (
            <div key={item.profile.id} className={`strategy-card-node ${isExpanded ? 'card-node--frozen' : ''}`}>
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
                    <span className="engine-tag" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#1f2937', color: '#ffb300', fontStyle: 'italic' }}>
                      {item.profile.coreEngine}
                    </span>
                  </div>
                  <p>Score {item.metrics.scannerScore}% &nbsp; Confidence {item.metrics.finalConfidence}%</p>
                </div>
                <div className="badge-column">
                  <span className={`tier-badge ${currentStatus.toLowerCase()}`}>{currentStatus}</span>
                </div>
                <div className="arrow-toggle">{isExpanded ? '▲' : '▼'}</div>
              </div>

              {isExpanded && (
                <div className="card-expanded-drawer">
                  <p className="desc">{item.profile.description}</p>
                  <div className="ai-input-parameter-grid">
                    <div className="input-cell">
                      <label>STAKE (USD)</label>
                      <input 
                        type="number" 
                        value={rowSettings.stake} 
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
                        onChange={(e) => updateSettingsValue(item.profile.id, 'takeProfit', e.target.value)}
                        onFocus={() => setIsTypingFocused(true)}
                        onBlur={() => setIsTypingFocused(false)}
                      />
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
                      <div className="lbl">TARGET ASSET</div>
                      <div className="txt-bold highlight-purple">{assetDisplayLabel}</div>
                    </div>
                  </div>

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
      
      <button className="scan-again-btn" onClick={handleResetMetrics}>
        ↺ Unfreeze & Refresh Ticks
      </button>
    </div>
  );
};

export default FloatingAI;
