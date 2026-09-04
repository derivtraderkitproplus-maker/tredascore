// FloatingAI.tsx - PART 1: Draggable Sphere State Initialization & Drag Math Handlers

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

  // NEW INTERACTIVE STATE INITIALIZERS FOR THE SPHERE WIDGET
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [shouldDisplaySphere, setShouldDisplaySphere] = useState<boolean>(true);
  const [spherePosition, setSpherePosition] = useState({ x: window.innerWidth - 76, y: window.innerHeight - 150 });

  // Draggable mechanical ref parameters
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const widgetNodeRef = useRef<HTMLDivElement>(null);

  // Instantiates persistent core engine layers to preserve calculations cross-renders
  const logicEngine = useMemo(() => new ScannerLogicEngine(), []);
  const networkBridge = useMemo(() => new DerivScannerBridge(derivContext), [derivContext]);

  // Dedicated layout buffer memory to lock card sorting orders when parameters expand
  const [frozenDisplayList, setFrozenDisplayList] = useState<EvaluationFrame[]>([]);

  // Supported synthetic index ticker keys matching your global asset engine registry
  const trackingSymbols = useMemo(() => ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'], []);

  // NEW TOUCH/MOUSE DRAG EVENT HANDLERS
  const initiateDragTracking = (clientX: number, clientY: number) => {
    isDragging.current = false; // Assume a clean tap first
    dragStart.current = { x: clientX - spherePosition.x, y: clientY - spherePosition.y };
  };

  const executeDragMovement = (clientX: number, clientY: number) => {
    isDragging.current = true; // Movement confirmed, switch to active drag state
    
    // Bounds clamping: prevents the neon sphere from sliding completely off mobile screen edges
    const maxBoundaryX = window.innerWidth - 64;
    const maxBoundaryY = window.innerHeight - 64;
    
    const constrainedX = Math.min(maxBoundaryX, Math.max(16, clientX - dragStart.current.x));
    const constrainedY = Math.min(maxBoundaryY, Math.max(16, clientY - dragStart.current.y));
    
    setSpherePosition({ x: constrainedX, y: constrainedY });
  };

  const terminateDragTracking = () => {
    // If the touch sequence finished without dragging, treat it as a click and open the scanner modal
    if (!isDragging.current) {
      setIsModalOpen(true);
    }
    isDragging.current = false;
  };

  // 1. AUTO-HIDE OBSERVER PIPELINE: Hides the sphere completely when your dashboard panels load
  useEffect(() => {
    const inspectDashboardPanels = () => {
      const screenText = document.body.innerText;
      const isDashboardActive = screenText.includes('Contracts lost') || 
                                 screenText.includes('Contracts won') || 
                                 screenText.includes('Total stake') ||
                                 screenText.includes('Total payout');

      if (isDashboardActive) {
        setShouldDisplaySphere(false);
      } else {
        setShouldDisplaySphere(true);
      }
    };

    inspectDashboardPanels();
    const dynamicObserver = new MutationObserver(inspectDashboardPanels);
    dynamicObserver.observe(document.body, { childList: true, subtree: true });

    return () => dynamicObserver.disconnect();
  }, []);

  // Secure alignment variables if user changes screen orientation
  useEffect(() => {
    const recalibrateLayout = () => {
      setSpherePosition({ x: window.innerWidth - 76, y: window.innerHeight - 150 });
    };
    window.addEventListener('resize', recalibrateLayout);
    return () => window.removeEventListener('resize', recalibrateLayout);
  }, []);
// FloatingAI.tsx - PART 2 (B): Draggable Pink Sphere Core Widget Template

  // Render logic blocks dynamically targeting the toggle open switch states
  if (!isModalOpen) {
    if (!shouldDisplaySphere) return null;
    return (
      <>
        {/* SCOPED INJECTED WIDGET ANIMATIONS AND GLOW STYLES */}
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
          style={{ left: spherePosition.x + "px", top: spherePosition.y + "px" }}
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
// FloatingAI.tsx - PART 2 (C): Full-Screen Modal Containers & Header Highlights Banner

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
            type="button"
            className="scanner-close-x-btn"
            onClick={() => {
              if (typeof onCloseScanner === 'function') onCloseScanner();
              setIsModalOpen(false); // Snap back to floating pink widget mode cleanly
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


      <div className="strategy-scroll-list">
        {visualDisplayList.map((item, index) => {
          const isExpanded = activeTab === item.profile.id;
          const currentStatus = item.metrics.status || item.profile.tier || 'LOW';
          const assetDisplayLabel = item.profile.targetSymbol.replace('R_', 'Volatility ');
          const contractDisplayLabel = item.profile.contractType.replace(/_/g, ' ');

          // Dynamic structural fallback pulling directly from strategy configuration records
          const rowSettings = customStrategySettings[item.profile.id] || { 
            stake: (item.profile.runtimeSettings?.defaultStake || 3.00).toString(), 
            stopLoss: (item.profile.runtimeSettings?.stopLossLimit || 4.00).toString(), 
            takeProfit: (item.profile.runtimeSettings?.takeProfitLimit || 8.00).toString() 
          };

          return (
            <div key={item.profile.id} className={"strategy-card-node " + (isExpanded ? 'card-node--frozen' : '')}>
              <div className="card-summary" onClick={() => setActiveTab(isExpanded ? null : item.profile.id)}>
                <div className="rank-badge">#{index + 1}</div>
                <div className="meta-details">
                  <h4>{item.profile.name}</h4>
                  <div className="strategy-tags-row">
                    <span className={"asset-tag symbol-" + item.profile.targetSymbol.toLowerCase()}>
                      {assetDisplayLabel}
                    </span>
                    <span className="contract-tag">
                      {contractDisplayLabel}
                    </span>
                    <span className="engine-tag">
                      {item.profile.coreEngine}
                    </span>
                  </div>
                  <p>Score {item.metrics.scannerScore}% &nbsp; Confidence {item.metrics.finalConfidence}%</p>
                </div>
                <div className="badge-column">
                  <span className={"tier-badge " + currentStatus.toLowerCase()}>{currentStatus}</span>
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

                  <div className="action-buttons-wrapper">
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
