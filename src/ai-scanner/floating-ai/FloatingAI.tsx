// ============================================================
// AI SCANNER USER INTERFACE PANEL
// Location: src/ai-scanner/floating-ai/FloatingAl.tsx
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { ScannerBridge } from './scannerBridge';
import { AI_STRATEGIES, AIStrategy } from './strategies';
import { ScannerResult, StrategyCompatibility } from './scannerLogic';
import './FloatingAl.css';

export const FloatingAl: React.FC = () => {
    // 1. Unified state reflecting your dashboard scanner parameters
    const [scannerState, setScannerState] = useState({
        marketState: 'INSUFFICIENT_DATA',
        liveTicks: 0,
        confidenceGate: 'WAIT',
        progressPercentage: 0,
        isScanningActive: false,
        bestStrategy: undefined as AIStrategy | undefined,
        strategyConfidence: 0,
        allRankings: [] as StrategyCompatibility[]
    });

    const bridgeEngineRef = useRef<ScannerBridge | null>(null);

    useEffect(() => {
        // 2. Instantiate the live connector bridge and route outputs into state hooks
        bridgeEngineRef.current = new ScannerBridge((streamUpdate) => {
            setScannerState((prevState) => ({
                ...prevState,
                marketState: streamUpdate.marketState,
                liveTicks: streamUpdate.liveTicks,
                confidenceGate: streamUpdate.confidenceGate,
                progressPercentage: streamUpdate.progressPercentage,
                bestStrategy: streamUpdate.rawScannerResult?.bestStrategy,
                strategyConfidence: streamUpdate.rawScannerResult?.strategyConfidence || 0,
                allRankings: streamUpdate.rawScannerResult?.rankedStrategies || []
            }));
        });

        // 3. Automated teardown execution when the component panel drops out of view
        return () => {
            bridgeEngineRef.current?.stopLiveScanning();
        };
    }, []);

    const toggleScannerExecution = () => {
        if (scannerState.isScanningActive) {
            bridgeEngineRef.current?.stopLiveScanning();
            setScannerState((prev) => ({
                ...prev,
                isScanningActive: false,
                marketState: 'INSUFFICIENT_DATA',
                liveTicks: 0,
                confidenceGate: 'WAIT',
                progressPercentage: 0,
                bestStrategy: undefined,
                strategyConfidence: 0,
                allRankings: []
            }));
        } else {
            setScannerState((prev) => ({ ...prev, isScanningActive: true }));
            // Dispatches live socket stream allocations to Volatility 100 (1s) Index configuration code
            bridgeEngineRef.current?.startLiveScanning('1HZ100V');
        }
    };

    return (
        <div className="floating-ai-scanner-dashboard">
            {/* Header Status Tracking Banner */}
            <div className="scanner-header-row">
                <h4>✦ AI Strategy Scanner</h4>
                <div className={`status-badge mode-${scannerState.confidenceGate.toLowerCase()}`}>
                    Gate: {scannerState.confidenceGate}
                </div>
            </div>

            {/* Ingress Statistics Layout Panel */}
            <div className="metrics-grid-container">
                <div className="metric-card">
                    <span className="label">Market Condition:</span>
                    <span className="value high-contrast-text">{scannerState.marketState}</span>
                </div>
                <div className="metric-card">
                    <span className="label">Buffer Capacity:</span>
                    <span className="value">{scannerState.liveTicks} / 100 Ticks</span>
                </div>
            </div>

            {/* Dynamic Visual Loading Progress bar Track */}
            <div className="progress-bar-track-wrapper">
                <div 
                    className="progress-fill-indicator" 
                    style={{ width: `${scannerState.progressPercentage}%` }}
                />
            </div>

            {/* Winning Signal Status Display Cards */}
            {scannerState.bestStrategy ? (
                <div className="winning-strategy-alert-banner">
                    <div className="alert-title">🔥 OPTIMAL STRATEGY IDENTIFIED</div>
                    <div className="strategy-name-title">{scannerState.bestStrategy.name}</div>
                    <div className="confidence-score-badge">
                        Scanner Confidence: {scannerState.strategyConfidence}%
                    </div>
                </div>
            ) : (
                <div className="waiting-placeholder-message-card">
                    {scannerState.isScanningActive 
                        ? "Analyzing tick history profiles matrix... Evaluating 30 configurations..." 
                        : "Initialize scan execution to open WebSocket pipes."}
                </div>
            )}

            {/* Operational Action Button CTA */}
            <button 
                className={`scan-toggle-action-btn ${scannerState.isScanningActive ? 'active-running' : ''}`}
                onClick={toggleScannerExecution}
            >
                {scannerState.isScanningActive ? '🛑 Terminate Active Scan' : '⚡ Scan 30 Strategies'}
            </button>
        </div>
    );
};

export default FloatingAl;
