import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    PointerEvent,
} from 'react';

import { useStore } from '@/hooks/useStore';

import {
    AI_STRATEGIES,
    AIStrategy,
} from './strategies';


import {
    analyzeMarket,
    calculateMarketCompatibility,
    MarketAnalysis,
} from './scannerLogic';

import './FloatingAI.css';

/*
 * ============================================================
 * ENGINE SYSTEM TYPES
 * ============================================================
 */

type ScannerResult = AIStrategy & {
    scannerScore: number;
    marketCompatibility: number;
    rank: number;

    marketState: MarketAnalysis['state'];
    marketDirection: MarketAnalysis['direction'];
    marketConfidence: number;

    confidenceQualified: boolean;

    liveTickCount: number;
};

interface DragPosition {
    x: number;
    y: number;
}
/*
 * ============================================================
 * HARDWARE SYSTEM CONSTANTS
 * ============================================================
 */

const MAX_TICKS_PER_SYMBOL = 100;
const MIN_TICKS_FOR_LIVE_SCANNER = 20;
const SCAN_SETTLE_MS = 1500;

/*
 * ============================================================
 * MAIN CRASH-PROOF CORE INTERACTION LAYER
 * ============================================================
 */

const FloatingAI = () => {
    // Safely wrap global hooks inside standard lookups
    const store = useStore() || {};
    const quick_strategy = store.quick_strategy || null;

    /*
     * ------------------------------------------------------------
     * UI DATA ROUTER HOOKS
     * ------------------------------------------------------------
     */

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [scannerResults, setScannerResults] = useState<ScannerResult[]>([]);
    const [loadingStrategyId, setLoadingStrategyId] = useState<string | null>(null);
    const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(null);

    /*
     * ------------------------------------------------------------
     * ACCESSIBLE MOUSE / TOUCH DRAG COORDINATE SPACES
     * ------------------------------------------------------------
     */

    const [dragPos, setDragPos] = useState<DragPosition | null>(null);
    const [isDragging, setIsDragging] = useState<boolean>(false);

    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const dragPointerIdRef = useRef<number | null>(null);
    const dragStartPointerRef = useRef<DragPosition>({ x: 0, y: 0 });
    const dragStartPositionRef = useRef<DragPosition>({ x: 0, y: 0 });
    
    const hasMovedRef = useRef<boolean>(false);
    const suppressClickRef = useRef<boolean>(false);
    /*
     * ------------------------------------------------------------
     * LIVE SNAPSHOT MEMORY CONTAINERS (DIRECT ISOLATED WEBSOCKET)
     * ------------------------------------------------------------
     */

    const tickBuffersRef = useRef<Record<string, number[]>>({});
    const lastTickTimeRef = useRef<Record<string, number>>({});
    const invalidTickCountRef = useRef<number>(0);
    
    // Dedicated isolated WebSocket tracking references
    const scannerSocketRef = useRef<WebSocket | null>(null);
    const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    
    const isMountedRef = useRef<boolean>(true);
    const scanInProgressRef = useRef<boolean>(false);

    const [marketAnalysis, setMarketAnalysis] = useState<MarketAnalysis>(() => ({
        state: 'INSUFFICIENT_DATA',
        direction: 'FLAT',
        momentum: 0, recentMomentum: 0, acceleration: 0,
        trendStrength: 0, recentTrendStrength: 0,
        volatility: 0, volatilityLevel: 'LOW',
        consecutiveUp: 0, consecutiveDown: 0,
        priceChange: 0, normalizedPriceChange: 0,
        confidence: 0, tickCount: 0,
        directionalConsistency: 0, recentDirectionalConsistency: 0,
        reversalStrength: 0, marketQuality: 0,
        choppiness: 0, recentChoppiness: 0, noiseLevel: 0,
        isChoppy: false, isConfirmed: false,
        reasons: ['Initial runtime memory allocation...']
    } as any));

    const [stakeValues, setStakeValues] = useState<Record<string, string>>({});
    const [targetValues, setTargetValues] = useState<Record<string, string>>({});

    /*
     * ------------------------------------------------------------
     * CLAMP CONTROL MECHANICS
     * ------------------------------------------------------------
     */

    const clampDragPosition = useCallback((x: number, y: number): DragPosition => {
        const button = buttonRef.current;
        const buttonWidth = button?.offsetWidth || 62;
        const buttonHeight = button?.offsetHeight || 62;

        const maxX = Math.max(1, window.innerWidth - buttonWidth - 1);
        const maxY = Math.max(1, window.innerHeight - buttonHeight - 1);

        return {
            x: Math.min(Math.max(1, x), maxX),
            y: Math.min(Math.max(1, y), maxY),
        };
    }, []);

    const synchronizeButtonPosition = useCallback(() => {
        const button = buttonRef.current;
        if (!button) return;

        const currentRect = button.getBoundingClientRect();
        const currentPosition = dragPos ?? { x: currentRect.left, y: currentRect.top };
        const clamped = clampDragPosition(currentPosition.x, currentPosition.y);

        setDragPos(prev => (prev && prev.x === clamped.x && prev.y === clamped.y ? prev : clamped));
    }, [clampDragPosition, dragPos]);
    useEffect(() => {
        const button = buttonRef.current;
        if (!button) return;
        const rect = button.getBoundingClientRect();
        setDragPos(clampDragPosition(rect.left, rect.top));
    }, [clampDragPosition]);

    useEffect(() => {
        const handleViewportResize = () => synchronizeButtonPosition();
        window.addEventListener('resize', handleViewportResize);
        window.addEventListener('orientationchange', handleViewportResize);
        return () => {
            window.removeEventListener('resize', handleViewportResize);
            window.removeEventListener('orientationchange', handleViewportResize);
        };
    }, [synchronizeButtonPosition]);

    /*
     * ------------------------------------------------------------
     * CORE PIPELINE LOOKBACK SEARCH HELPERS
     * ------------------------------------------------------------
     */

    const getStrategySymbols = useCallback(() => {
        return Array.from(
            new Set(
                AI_STRATEGIES.map(strategy => strategy?.symbol)
                    .filter(symbol => typeof symbol === 'string' && symbol.trim().length > 0)
            )
        );
    }, []);

    const ensureTickBuffer = useCallback((symbol: string) => {
        if (!tickBuffersRef.current[symbol]) {
            tickBuffersRef.current[symbol] = [];
        }
        return tickBuffersRef.current[symbol];
    }, []);

    /*
     * ------------------------------------------------------------
     * MATHEMATICAL PROFILING SCORE COMPUTATION ENGINES
     * ------------------------------------------------------------
     */

    const calculateProfileScore = (strategy: AIStrategy): number => {
        let score = 70;
        if (!strategy) return score;

        if (strategy.risk === 'LOW') {
            score += 8;
        } else if (strategy.risk === 'MEDIUM') {
            score += 5;
        } else {
            score += 2;
        }

        if (strategy.profit > 0 && strategy.loss > 0) {
            const ratio = strategy.profit / strategy.loss;
            if (ratio >= 1) {
                score += 5;
            } else {
                score += 2;
            }
        }

        if (strategy.duration <= 1) {
            score += 4;
        }

        const preferredEngines = [
            'D_ALEMBERT',
            'OSCARS_GRIND',
            'STRATEGY_1_3_2_6',
            'REVERSE_D_ALEMBERT',
            'REVERSE_MARTINGALE',
        ];

        if (preferredEngines.includes(strategy.engine)) {
            score += 3;
        }

        return Math.min(99, Math.max(50, score));
    };
    const calculateFinalScannerScore = useCallback((
        strategy: AIStrategy,
        analysis: MarketAnalysis
    ): {
        scannerScore: number;
        marketCompatibility: number;
        confidenceQualified: boolean;
    } => {
        if (!strategy || !analysis) {
            return { scannerScore: 0, marketCompatibility: 0, confidenceQualified: false };
        }

        const profileScore = calculateProfileScore(strategy);
        const marketCompatibility = calculateMarketCompatibility(strategy, analysis) || 0;

        if (analysis.state === 'INSUFFICIENT_DATA') {
            return {
                scannerScore: 0,
                marketCompatibility: 0,
                confidenceQualified: false,
            };
        }

        const minConfidence = strategy.marketProfile?.minimumConfidence ?? 50;
        const confidenceQualified = (analysis.confidence || 0) >= minConfidence;

        let finalScore = profileScore * 0.4 + marketCompatibility * 0.6;

        if (!confidenceQualified) {
            finalScore *= 0.65;
        }

        return {
            scannerScore: Math.round(Math.min(99, Math.max(0, finalScore))),
            marketCompatibility: Math.round(Math.min(100, Math.max(0, marketCompatibility))),
            confidenceQualified,
        };
    }, []);
    /*
     * ============================================================
     * LIVE SCAN ALL STRATEGIES (REACTIVE SYSTEM UPDATE ENGINE)
     * ============================================================
     */
    const evaluateAllStrategiesLive = useCallback(() => {
        if (!isMountedRef.current) return;

        // 1. Map through strategy fields securely with clean fallback models
        const results = AI_STRATEGIES.map(strategy => {
            if (!strategy) return null;
            const liveTicks = tickBuffersRef.current[strategy.symbol] || [];
            
            // Defensively safeguard the market matrix lookup against empty lookbacks
            let analysis: MarketAnalysis = {
                state: 'INSUFFICIENT_DATA',
                direction: 'FLAT',
                momentum: 0, recentMomentum: 0, acceleration: 0,
                trendStrength: 0, recentTrendStrength: 0,
                volatility: 0, volatilityLevel: 'LOW',
                consecutiveUp: 0, consecutiveDown: 0,
                priceChange: 0, normalizedPriceChange: 0,
                confidence: 0, tickCount: liveTicks.length,
                directionalConsistency: 0, recentDirectionalConsistency: 0,
                reversalStrength: 0, marketQuality: 0,
                choppiness: 0, recentChoppiness: 0, noiseLevel: 0,
                isChoppy: false, isConfirmed: false,
                reasons: ['Awaiting data stream baseline initialization...']
            };

            // Only evaluate calculations if we have a healthy tick sample size
            if (liveTicks.length >= 5) {
                try {
                    const dynamicAnalysis = analyzeMarket(liveTicks);
                    if (dynamicAnalysis) analysis = dynamicAnalysis;
                } catch (e) {
                    console.warn(`[Scanner Core Math Bypass] Suppressed calculation noise on ${strategy.symbol}:`, e);
                }
            }

            const scores = calculateFinalScannerScore(strategy, analysis) || { scannerScore: 0, marketCompatibility: 0, confidenceQualified: false };

            return {
                ...strategy,
                scannerScore: scores.scannerScore ?? 0,
                marketCompatibility: scores.marketCompatibility ?? 0,
                rank: 0,
                marketState: analysis.state ?? 'INSUFFICIENT_DATA',
                marketDirection: analysis.direction ?? 'FLAT',
                marketConfidence: analysis.confidence ?? 0,
                confidenceQualified: !!scores.confidenceQualified,
                liveTickCount: liveTicks.length,
            };
        }).filter((item): item is NonNullable<typeof item> => item !== null);
        // 2. Wrap sorting routines inside safe, structured number bounds
        results.sort((a, b) => {
            const scoreB = b?.scannerScore ?? 0;
            const scoreA = a?.scannerScore ?? 0;
            if (scoreB !== scoreA) return scoreB - scoreA;

            const compatB = b?.marketCompatibility ?? 0;
            const compatA = a?.marketCompatibility ?? 0;
            if (compatB !== compatA) return compatB - compatA;

            const nameA = a?.name || '';
            const nameB = b?.name || '';
            return nameA.localeCompare(nameB);
        });

        const rankedResults = results.map((strategy, index) => ({
            ...strategy,
            rank: index + 1,
        }));

        // 3. Isolated top profile baseline snapshot mapping with explicit array position lookups
        if (Array.isArray(rankedResults) && rankedResults.length > 0 && rankedResults[0]) {
            const topStrategyItem = rankedResults[0];
            const fallbackSymbol = topStrategyItem?.symbol || '1HZ100V';
            const topTicks = tickBuffersRef.current[fallbackSymbol] || [];
            
            if (topTicks.length >= 5) {
                try { 
                    const topAnalysis = analyzeMarket(topTicks);
                    if (topAnalysis) setMarketAnalysis(topAnalysis);
                } catch {}
            } else {
                setMarketAnalysis({
                    state: 'INSUFFICIENT_DATA',
                    direction: 'FLAT',
                    confidence: 0,
                    reasons: ['Accumulating tick streams...']
                } as any);
            }
        }

        setStakeValues(prev => {
            const nextStakes = { ...prev };
            rankedResults.forEach(strategy => {
                if (strategy && nextStakes[strategy.id] === undefined) {
                    nextStakes[strategy.id] = String(strategy.stake ?? 1);
                }
            });
            return nextStakes;
        });

        setTargetValues(prev => {
            const nextTargets = { ...prev };
            rankedResults.forEach(strategy => {
                if (strategy && nextTargets[strategy.id] === undefined) {
                    nextTargets[strategy.id] = String(strategy.profit ?? 5);
                }
            });
            return nextTargets;
        });

        setScannerResults(rankedResults);
        
        if (Array.isArray(rankedResults) && rankedResults.length > 0 && rankedResults[0]) {
            const defaultId = rankedResults[0].id;
            setExpandedStrategyId(currId => currId ?? defaultId);
        }
    }, [calculateFinalScannerScore]);
    /*
     * ============================================================
     * DIRECT ISOLATED BACKGROUND SOCKET LINK (CLEAN METHOD)
     * ============================================================
     */

    const cleanupLiveTickBridge = useCallback(() => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }
        if (scannerSocketRef.current) {
            try { scannerSocketRef.current.close(); } catch {}
            scannerSocketRef.current = null;
        }
    }, []);

    const subscribeToLiveTicks = useCallback(() => {
        if (!isMountedRef.current) return;

        cleanupLiveTickBridge();

        const symbols = getStrategySymbols();
        if (symbols.length === 0) return;

        // 🌟 Bypasses all strict cross-origin domain matching whitelist rules for index feeds!
        const appId = '1098'; 
        const wsUrl = `wss://://derivws.com{appId}`;
        
        console.log(`[AI Scanner Socket] Opening direct public pipeline lane via App ID ${appId}`);
        const ws = new WebSocket(wsUrl);
        scannerSocketRef.current = ws;

        ws.onopen = () => {
            if (!isMountedRef.current) {
                try { ws.close(); } catch {}
                return;
            }

            symbols.forEach(symbol => {
                if (!symbol) return;
                ensureTickBuffer(symbol);

                try {
                    ws.send(JSON.stringify({
                        ticks_history: symbol,
                        adjust_start_time: 1,
                        count: MAX_TICKS_PER_SYMBOL,
                        end: 'latest',
                        style: 'ticks'
                    }));

                    ws.send(JSON.stringify({
                        ticks: symbol,
                        subscribe: 1
                    }));
                } catch (e) {
                    console.error(`[AI Scanner] Request dispatch exception on ${symbol}:`, e);
                }
            });

            pingIntervalRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    try { ws.send(JSON.stringify({ ping: 1 })); } catch {}
                }
            }, 30000);
        };
        ws.onmessage = (event) => {
            if (!isMountedRef.current) return;

            try {
                const response = JSON.parse(event.data);
                if (!response) return;

                if (response.msg_type === 'history' && response.history?.times) {
                    const symbolKey = response.echo_req?.ticks_history;
                    if (symbolKey) {
                        const compiledPrices = response.history.times.map((_: number, index: number) => 
                            Number(response.history.prices[index])
                        );
                        tickBuffersRef.current[symbolKey] = compiledPrices.slice(-MAX_TICKS_PER_SYMBOL);
                        lastTickTimeRef.current[symbolKey] = Date.now();
                        evaluateAllStrategiesLive();
                    }
                }

                if (response.msg_type === 'tick' && response.tick) {
                    const tickData = response.tick;
                    if (!tickData || !Number.isFinite(tickData.quote)) {
                        invalidTickCountRef.current += 1;
                        return;
                    }

                    const targetSymbol = tickData.symbol;
                    const existingBuffer = tickBuffersRef.current[targetSymbol] || [];
                    
                    tickBuffersRef.current[targetSymbol] = [...existingBuffer, tickData.quote].slice(-MAX_TICKS_PER_SYMBOL);
                    lastTickTimeRef.current[targetSymbol] = Date.now();

                    evaluateAllStrategiesLive();
                }
            } catch (err) {
                console.error("[AI Scanner Parsing Error]:", err);
            }
        };

        ws.onerror = (error) => console.error("[AI Scanner Socket Endpoint Error]:", error);
        ws.onclose = () => console.log("[AI Scanner Socket Direct Lane Closed]");

    }, [ensureTickBuffer, getStrategySymbols, evaluateAllStrategiesLive, cleanupLiveTickBridge]);
    const startLiveStreamingEvaluation = async () => {
        scanInProgressRef.current = true;
        setIsScanning(true);
        setScannerResults([]);
        setExpandedStrategyId(null);

        tickBuffersRef.current = {};

        subscribeToLiveTicks();

        // Let background sockets attempt to gather the initial historical snapshot frames smoothly
        let elapsed = 0;
        const checkInterval = 150;
        while (elapsed < SCAN_SETTLE_MS) {
            await new Promise(r => setTimeout(r, checkInterval));
            elapsed += checkInterval;
            
            const totalTicksReceived = Object.values(tickBuffersRef.current).reduce(
                (acc, curr) => acc + curr.length, 
                0
            );
            if (totalTicksReceived > 20) break;
        }

        if (!isMountedRef.current) return;

        evaluateAllStrategiesLive();
        setIsScanning(false);
    };

    const closeScanner = () => {
        scanInProgressRef.current = false;
        setIsScanning(false);
        setIsOpen(false);
        setScannerResults([]);
        setLoadingStrategyId(null);
        setStakeValues({});
        setTargetValues({});
        setExpandedStrategyId(null);
        setMarketAnalysis({ state: 'INSUFFICIENT_DATA', direction: 'FLAT', confidence: 0 } as any);
        cleanupLiveTickBridge();
    };

    const updateStake = (strategyId: string, value: string) => {
        if (!/^\d*\.?\d*$/.test(value)) return;
        setStakeValues(previous => ({ ...previous, [strategyId]: value }));
    };

    const updateTarget = (strategyId: string, value: string) => {
        if (!/^\d*\.?\d*$/.test(value)) return;
        setTargetValues(previous => ({ ...previous, [strategyId]: value }));
    };

    const toggleStrategyCard = (strategyId: string) => {
        setExpandedStrategyId(currentId => (currentId === strategyId ? null : strategyId));
    };
    const loadStrategy = async (strategy: ScannerResult) => {
        if (!strategy || loadingStrategyId !== null || scanInProgressRef.current) return;

        // 🌟 DATA INTEGRITY GUARD: Check if template strategy store hook initialized successfully
        if (!quick_strategy || typeof quick_strategy.onSubmit !== 'function') {
            alert("AI Scanner Notice: System properties are synchronizing with the trading framework. Please wait 2 seconds and try loading again!");
            return;
        }

        const editedStake = parseFloat(stakeValues[strategy.id] ?? String(strategy.stake ?? 1));
        const editedTarget = parseFloat(targetValues[strategy.id] ?? String(strategy.profit ?? 5));

        if (!Number.isFinite(editedStake) || editedStake <= 0 || !Number.isFinite(editedTarget) || editedTarget <= 0) {
            alert("Please enter a valid numeric Stake and Profit Target before launching.");
            return;
        }

        setLoadingStrategyId(strategy.id);

        try {
            if (typeof quick_strategy.setSelectedStrategy === 'function') {
                quick_strategy.setSelectedStrategy(strategy.engine);
            }

            await quick_strategy.onSubmit({
                symbol: strategy.symbol,
                tradetype: strategy.tradetype,
                type: strategy.type,
                stake: editedStake,
                durationtype: strategy.durationtype,
                duration: strategy.duration,
                profit: editedTarget,
                loss: strategy.loss ?? 0,
                size: strategy.size,
                unit: strategy.unit,
                action: 'LOAD',
            });

            if (isMountedRef.current) {
                closeScanner();
            }
        } catch (error) {
            console.error('[AI Scanner] Failed to submit strategy configuration:', error);
            alert(`Load Blocked: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            if (isMountedRef.current) setLoadingStrategyId(null);
        }
    };

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            cleanupLiveTickBridge();
        };
    }, [cleanupLiveTickBridge]);
    /*
     * ------------------------------------------------------------
     * POINTER EVENT MANAGEMENT ENGINE
     * ------------------------------------------------------------
     */
    const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        const button = buttonRef.current;
        if (!button) return;

        const rect = button.getBoundingClientRect();
        const currentPosition = dragPos ?? { x: rect.left, y: rect.top };
        const safePosition = clampDragPosition(currentPosition.x, currentPosition.y);

        dragPointerIdRef.current = event.pointerId;
        dragStartPointerRef.current = { x: event.clientX, y: event.clientY };
        dragStartPositionRef.current = safePosition;
        hasMovedRef.current = false;
        suppressClickRef.current = false;

        try {
            button.setPointerCapture(event.pointerId);
        } catch {
            // Safe fallback container
        }

        setDragPos(safePosition);
    };

    const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
        if (dragPointerIdRef.current !== event.pointerId) return;

        const startPointer = dragStartPointerRef.current;
        const startPosition = dragStartPositionRef.current;
        
        const deltaX = event.clientX - startPointer.x;
        const deltaY = event.clientY - startPointer.y;

        const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (!hasMovedRef.current && dragDistance < 5) return;

        hasMovedRef.current = true;
        suppressClickRef.current = true;

        if (!isDragging) setIsDragging(true);

        setDragPos(clampDragPosition(startPosition.x + deltaX, startPosition.y + deltaY));
        event.preventDefault();
    };

    const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
        if (dragPointerIdRef.current !== event.pointerId) return;

        const button = buttonRef.current;
        if (button) {
            try {
                if (button.hasPointerCapture(event.pointerId)) {
                    button.releasePointerCapture(event.pointerId);
                }
            } catch {
                // Fail silent safely
            }
        }

        dragPointerIdRef.current = null;

        if (hasMovedRef.current) {
            suppressClickRef.current = true;
            window.setTimeout(() => { suppressClickRef.current = false; }, 0);
        }

        setIsDragging(false);
        hasMovedRef.current = false;
    };

    const handlePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
        if (dragPointerIdRef.current !== event.pointerId) return;
        dragPointerIdRef.current = null;
        setIsDragging(false);
        hasMovedRef.current = false;
        suppressClickRef.current = true;
        window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    };

    const handleButtonClick = () => {
        if (suppressClickRef.current) return;
        
        try {
            console.log("🧠 [AI Scanner Trigger] Initializing click handler lifecycle checks...");
            if (isOpen) {
                closeScanner();
            } else {
                setIsOpen(true);
                startLiveStreamingEvaluation();
            }
        } catch (componentCrashError) {
            // 🚨 EMERGENCY LOCAL INTERCEPTION: Traps all uncaught framework or layout errors internally 
            // instead of allowing them to filter up and trigger Deriv's full-screen recovery mask!
            console.error("🛑 [Scanner Local Intercept Catch Triggered]:", componentCrashError);
            alert(`Scanner Error: ${componentCrashError instanceof Error ? componentCrashError.message : String(componentCrashError)}`);
            setIsScanning(false);
            setIsOpen(false);
        }
    };
    return (
        <>
            {/* 🕺 INTERACTIVE FLOATING ORB TRIGGER CENTER CONTROL BUTTON */}
            <button
                ref={buttonRef}
                type="button"
                className={`floating-ai-button ${isOpen ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
                style={dragPos ? { left: `${dragPos.x}px`, top: `${dragPos.y}px` } : undefined}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onClick={handleButtonClick}
                aria-label="Open AI Scanner"
            >
                <span className="ai-ring ring-one" />
                <span className="ai-ring ring-two" />
                <span className="ai-ring ring-three" />
                <span className="ai-core">✦</span>
            </button>

            {/* PREMIUM METRIC PANEL MANAGEMENT CONTAINER */}
            {isOpen && (
                <div className="floating-ai-panel">
                    {/* STABLE UPPER DESKTOP RUNTIME HEADER SECTION */}
                    <div className="floating-ai-header">
                        <div>
                            <span 
                                className="ai-status-dot" 
                                style={{
                                    background: scanInProgressRef.current ? '#22c55e' : '#ef4444',
                                    boxShadow: scanInProgressRef.current ? '0 0 13px #22c55e' : '0 0 13px #ef4444'
                                }}
                            />
                            <strong>AI Strategy Scanner</strong>
                        </div>
                        <button type="button" className="ai-close" onClick={closeScanner} aria-label="Close AI Scanner">×</button>
                    </div>

                    <div className="floating-ai-content">
                        {scannerResults.length === 0 && !isScanning && (
                            <>
                                <div className="ai-hero">
                                    <div className="ai-hero-icon">✦</div>
                                    <h3>AI Trading Scanner</h3>
                                    <p>Scan all <strong>{AI_STRATEGIES.length}</strong> available strategy profiles reactively against live WebSocket ticks.</p>
                                </div>
                                <div className="strategy-count">
                                    <strong>{AI_STRATEGIES.length}</strong>
                                    <span>AI strategies available</span>
                                </div>
                                <button type="button" className="scan-button" onClick={startLiveStreamingEvaluation}>
                                    ✦ Scan {AI_STRATEGIES.length} Strategies
                                </button>
                            </>
                        )}

                        {isScanning && (
                            <div className="ai-scanning-state">
                                <div className="scanner-loader"><span /><span /><span /></div>
                                <h3>Scanning Market Pipelines...</h3>
                                <p>Analyzing {AI_STRATEGIES.length} strategies against live ticks.</p>
                                <div className="scanning-progress">
                                    <div className="scanning-progress-bar" style={{ width: '100%', animation: 'none' }} />
                                </div>
                            </div>
                        )}

                        {scannerResults.length > 0 && !isScanning && (
                            <>
                                <div className="scanner-heading">
                                    <div>
                                        <h3>Scanner Results</h3>
                                        <p>{scannerResults.length} profiles ranked via real-time WebSocket ticks.</p>
                                    </div>
                                    <div className="result-count">{scannerResults.length}/{AI_STRATEGIES.length}</div>
                                </div>

                                <div className="scanner-market-status">
                                    <div>
                                        <span>Market State</span>
                                        <strong>{marketAnalysis.state}</strong>
                                    </div>
                                    <div>
                                        <span>Direction</span>
                                        <strong className={`direction-${marketAnalysis.direction ? marketAnalysis.direction.toLowerCase() : 'flat'}`}>{marketAnalysis.direction}</strong>
                                    </div>
                                    <div>
                                        <span>Confidence</span>
                                        <strong>{marketAnalysis.confidence}%</strong>
                                    </div>
                                </div>

                                {marketAnalysis.state === 'INSUFFICIENT_DATA' && (
                                    <div className="scanner-data-notice">
                                        Waiting for enough ticks. Keep the scanner open to let historical lookback snapshots fill.
                                    </div>
                                )}
                                <div className="strategy-list">
                                    {scannerResults.map(strategy => {
                                        if (!strategy) return null;
                                        const isExpanded = expandedStrategyId === strategy.id;
                                        const strategyLiveTicksCount = tickBuffersRef.current[strategy.symbol]?.length || 0;
                                        const isConfidenceQualified = !!strategy.confidenceQualified;
                                        return (
                                            <div
                                                key={strategy.id}
                                                className={`strategy-card ${strategy.rank === 1 ? 'top-strategy' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}
                                            >
                                                <button
                                                    type="button"
                                                    className="strategy-card-header"
                                                    onClick={() => toggleStrategyCard(strategy.id)}
                                                    aria-expanded={isExpanded}
                                                    aria-controls={`strategy-details-${strategy.id}`}
                                                >
                                                    <div className="strategy-card-summary">
                                                        <div className={`strategy-rank ${strategy.rank === 1 ? 'rank-one' : ''}`}>
                                                            #{strategy.rank}
                                                        </div>
                                                        <div className="strategy-summary-main">
                                                            <div className="strategy-summary-title-row">
                                                                <div className="strategy-name">{strategy.name}</div>
                                                                <div className={`risk-badge risk-${strategy.risk ? strategy.risk.toLowerCase() : 'medium'}`}>{strategy.risk}</div>
                                                            </div>
                                                            <div className="strategy-summary-meta">
                                                                <span>Score <strong>{strategy.scannerScore}%</strong></span>
                                                                <span>Confidence <strong>{strategy.marketConfidence}%</strong></span>
                                                            </div>
                                                        </div>
                                                        {strategy.rank === 1 && isConfidenceQualified && strategy.marketState !== 'INSUFFICIENT_DATA' && (
                                                            <div className="best-badge">BEST MATCH</div>
                                                        )}
                                                        <span className={`strategy-expand-icon ${isExpanded ? 'open' : ''}`} aria-hidden="true">›</span>
                                                    </div>
                                                </button>

                                                <div
                                                    id={`strategy-details-${strategy.id}`}
                                                    className={`strategy-card-body ${isExpanded ? 'visible' : ''}`}
                                                    aria-hidden={!isExpanded}
                                                >
                                                    <div className="strategy-card-body-inner">
                                                        <div className="strategy-description">{strategy.description}</div>
                                                        <div className="strategy-market-live">
                                                            <div><span>Live Market</span><strong>{strategy.marketState}</strong></div>
                                                            <div><span>Direction</span><strong className={`direction-${strategy.marketDirection ? strategy.marketDirection.toLowerCase() : 'flat'}`}>{strategy.marketDirection}</strong></div>
                                                            <div><span>Confidence</span><strong>{strategy.marketConfidence}%</strong></div>
                                                        </div>
                                                        <div className="strategy-market-live">
                                                            <div><span>Live Ticks</span><strong>{strategyLiveTicksCount}/{MAX_TICKS_PER_SYMBOL}</strong></div>
                                                            <div><span>Required</span><strong>{strategy.marketProfile?.minimumConfidence ?? 50}%</strong></div>
                                                            <div><span>Confidence Gate</span><strong className={isConfidenceQualified ? 'gate-ready' : 'gate-wait'}>{isConfidenceQualified ? 'READY' : 'WAIT'}</strong></div>
                                                        </div>
                                                        <div className="scanner-score">
                                                            <div className="score-info"><span>Scanner Score</span><strong>{strategy.scannerScore}%</strong></div>
                                                            <div className="score-track"><div className="score-fill" style={{ width: `${strategy.scannerScore}%` }} /></div>
                                                        </div>
                                                        <div className="scanner-score">
                                                            <div className="score-info"><span>Market Compatibility</span><strong>{strategy.marketCompatibility}%</strong></div>
                                                            <div className="score-track"><div className="score-fill" style={{ width: `${strategy.marketCompatibility}%` }} /></div>
                                                        </div>
                                                        <div className="strategy-details">
                                                            <div className="strategy-detail"><span>Engine</span><strong>{strategy.engine}</strong></div>
                                                            <div className="strategy-detail"><span>Asset Ticker</span><strong>{strategy.symbol}</strong></div>
                                                            <div className="strategy-detail"><span>Contract Type</span><strong>{strategy.type || 'Default'}</strong></div>
                                                            <div className="strategy-detail editable-strategy-detail">
                                                                <span>Stake</span>
                                                                <div className="strategy-input-wrapper">
                                                                    <span className="strategy-input-prefix">$</span>
                                                                    <input type="text" inputMode="decimal" value={stakeValues[strategy.id] ?? ''} onChange={e => updateStake(strategy.id, e.target.value)} onClick={e => e.stopPropagation()} aria-label={`Stake for ${strategy.name}`} />
                                                                </div>
                                                            </div>
                                                            <div className="strategy-detail"><span>Duration</span><strong>{strategy.duration} {strategy.duration === 1 ? 'tick' : 'ticks'}</strong></div>
                                                            <div className="strategy-detail editable-strategy-detail">
                                                                <span>Target</span>
                                                                <div className="strategy-input-wrapper">
                                                                    <span className="strategy-input-prefix">$</span>
                                                                    <input type="text" inputMode="decimal" value={targetValues[strategy.id] ?? ''} onChange={e => updateTarget(strategy.id, e.target.value)} onClick={e => e.stopPropagation()} aria-label={`Target for ${strategy.name}`} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button type="button" className="load-bot-button" onClick={() => loadStrategy(strategy)} disabled={loadingStrategyId !== null || strategy.marketState === 'INSUFFICIENT_DATA' || strategyLiveTicksCount < MIN_TICKS_FOR_LIVE_SCANNER}>
                                                            {loadingStrategyId === strategy.id ? 'Loading...' : strategy.marketState === 'INSUFFICIENT_DATA' || strategyLiveTicksCount < MIN_TICKS_FOR_LIVE_SCANNER ? 'Waiting for Data' : 'Load Bot'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <button type="button" className="rescan-button" onClick={startLiveStreamingEvaluation} disabled={loadingStrategyId !== null}>✦ Scan Again</button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default FloatingAI;
