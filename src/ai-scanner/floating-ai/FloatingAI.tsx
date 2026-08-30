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

import { api_base } from '@/external/bot-skeleton/services/api/api-base';

import './FloatingAI.css';

/*
 * ============================================================
 * TYPES & CONSTANTS
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

const MAX_TICKS_PER_SYMBOL = 100;
const MIN_TICKS_FOR_LIVE_SCANNER = 20;
const LIVE_TICK_RETRY_MS = 1000;

/*
 * ============================================================
 * MAIN COMPONENT HOOK INTERFACES
 * ============================================================
 */
export const FloatingAI = () => {
    const { quick_strategy } = useStore();

    const [isOpen, setIsOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scannerResults, setScannerResults] = useState<ScannerResult[]>([]);
    const [loadingStrategyId, setLoadingStrategyId] = useState<string | null>(null);
    const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(null);

    const [dragPos, setDragPos] = useState<DragPosition | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const dragPointerIdRef = useRef<number | null>(null);
    const dragStartPointerRef = useRef<DragPosition>({ x: 0, y: 0 });
    const dragStartPositionRef = useRef<DragPosition>({ x: 0, y: 0 });
    const hasMovedRef = useRef(false);
    const suppressClickRef = useRef(false);

    const tickBuffersRef = useRef<Record<string, number[]>>({});
    const lastTickTimeRef = useRef<Record<string, number>>({});
    const invalidTickCountRef = useRef(0);
    const tickUnsubscribersRef = useRef<Array<() => void>>([]);
    const subscribedSymbolsRef = useRef<Set<string>>(new Set());
    const tickRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = useRef(true);
    const scanInProgressRef = useRef(false);
    const scanGenerationRef = useRef(0);

    const [marketAnalysis, setMarketAnalysis] = useState<MarketAnalysis>(() =>
        analyzeMarket([])
    );

    const [stakeValues, setStakeValues] = useState<Record<string, string>>({});
    const [targetValues, setTargetValues] = useState<Record<string, string>>({});

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
        try { button.setPointerCapture(event.pointerId); } catch { /* ignore fallback */ }
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
            try { if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId); } catch { /* ignore catch */ }
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
        if (isOpen) {
            closeScanner();
        } else {
            setIsOpen(true);
            startLiveEvaluation();
        }
    };

    const getStrategySymbols = useCallback(() => {
        return Array.from(new Set(AI_STRATEGIES.map(s => s.symbol).filter(sym => typeof sym === 'string' && sym.trim().length > 0)));
    }, []);

    const ensureTickBuffer = useCallback((symbol: string) => {
        if (!tickBuffersRef.current[symbol]) tickBuffersRef.current[symbol] = [];
        return tickBuffersRef.current[symbol];
    }, []);

    const calculateProfileScore = (strategy: AIStrategy): number => {
        let score = 70;
        if (strategy.risk === 'LOW') score += 8;
        else if (strategy.risk === 'MEDIUM') score += 5;
        else score += 2;
        if (strategy.profit > 0 && strategy.loss > 0) {
            score += (strategy.profit / strategy.loss) >= 1 ? 5 : 2;
        }
        if (strategy.duration <= 1) score += 4;
        if (['D_ALEMBERT', 'OSCARS_GRIND', 'STRATEGY_1_3_2_6', 'REVERSE_D_ALEMBERT', 'REVERSE_MARTINGALE'].includes(strategy.engine)) score += 3;
        return Math.min(99, Math.max(50, score));
    };

    const calculateFinalScannerScore = (strategy: AIStrategy, analysis: MarketAnalysis) => {
        const profileScore = calculateProfileScore(strategy);
        const marketCompatibility = calculateMarketCompatibility(strategy, analysis);
        if (analysis.state === 'INSUFFICIENT_DATA') {
            return { scannerScore: 0, marketCompatibility: 0, confidenceQualified: false };
        }
        const confidenceQualified = analysis.confidence >= strategy.marketProfile.minimumConfidence;
        let finalScore = profileScore * 0.4 + marketCompatibility * 0.6;
        if (!confidenceQualified) finalScore *= 0.65;
        return {
            scannerScore: Math.round(Math.min(99, Math.max(0, finalScore))),
            marketCompatibility: Math.round(Math.min(100, Math.max(0, marketCompatibility))),
            confidenceQualified,
        };
    };
    /*
     * ============================================================
     * LIVE STRATEGY EVALUATION RUNTIME ENGINE (REACTIVE WEBSOCKET)
     * ============================================================
     * Swaps out the old 1-second interval loop entirely.
     */
    const evaluateAllStrategiesLive = useCallback(() => {
        if (!isMountedRef.current) return;

        const results = AI_STRATEGIES.map(strategy => {
            const liveTicks = tickBuffersRef.current[strategy.symbol] || [];
            const analysis = analyzeMarket(liveTicks);
            const scores = calculateFinalScannerScore(strategy, analysis);

            return {
                ...strategy,
                scannerScore: scores.scannerScore,
                marketCompatibility: scores.marketCompatibility,
                rank: 0,
                marketState: analysis.state,
                marketDirection: analysis.direction,
                marketConfidence: analysis.confidence,
                confidenceQualified: scores.confidenceQualified,
                liveTickCount: liveTicks.length,
            };
        });

        const hasUsableLiveData = results.some(
            r => r.liveTickCount >= MIN_TICKS_FOR_LIVE_SCANNER && r.marketState !== 'INSUFFICIENT_DATA'
        );

        results.sort((a, b) => {
            if (hasUsableLiveData && a.confidenceQualified !== b.confidenceQualified) return a.confidenceQualified ? -1 : 1;
            if (b.scannerScore !== a.scannerScore) return b.scannerScore - a.scannerScore;
            if (b.marketCompatibility !== a.marketCompatibility) return b.marketCompatibility - a.marketCompatibility;
            if (b.marketConfidence !== a.marketConfidence) return b.marketConfidence - a.marketConfidence;
            return a.name.localeCompare(b.name);
        });

        const rankedResults = results.map((strategy, index) => ({ ...strategy, rank: index + 1 }));

        if (rankedResults.length > 0) {
            setMarketAnalysis(analyzeMarket(tickBuffersRef.current[rankedResults[0].symbol] || []));
        } else {
            setMarketAnalysis(analyzeMarket([]));
        }

        setStakeValues(prev => {
            const n = { ...prev };
            rankedResults.forEach(s => { if (n[s.id] === undefined) n[s.id] = String(s.stake); });
            return n;
        });

        setTargetValues(prev => {
            const n = { ...prev };
            rankedResults.forEach(s => { if (n[s.id] === undefined) n[s.id] = String(s.profit); });
            return n;
        });

        if (hasUsableLiveData) {
            setScannerResults(rankedResults);
            setExpandedStrategyId(curr => curr ?? rankedResults[0]?.id ?? null);
        } else {
            const seed = AI_STRATEGIES.map((s, idx) => ({
                ...s, scannerScore: 0, marketCompatibility: 0, rank: idx + 1,
                marketState: 'INSUFFICIENT_DATA' as const, marketDirection: 'FLAT' as const, marketConfidence: 0,
                confidenceQualified: false, liveTickCount: tickBuffersRef.current[s.symbol]?.length || 0,
            }));
            setScannerResults(seed);
            setExpandedStrategyId(curr => curr ?? seed[0]?.id ?? null);
        }
    }, []);
    const subscribeToLiveTicks = useCallback(() => {
        if (!isMountedRef.current) return;
        const symbols = getStrategySymbols();
        if (symbols.length === 0 || !api_base.api) {
            if (tickRetryTimerRef.current === null) {
                tickRetryTimerRef.current = setTimeout(() => {
                    tickRetryTimerRef.current = null;
                    if (isMountedRef.current) subscribeToLiveTicks();
                }, LIVE_TICK_RETRY_MS);
            }
            return;
        }

        if (tickRetryTimerRef.current !== null) {
            clearTimeout(tickRetryTimerRef.current);
            tickRetryTimerRef.current = null;
        }

        symbols.forEach(symbol => {
            if (subscribedSymbolsRef.current.has(symbol)) return;
            ensureTickBuffer(symbol);
            try {
                const unsubscribe = api_base.subscribeToTicks(symbol, tick => {
                    if (!isMountedRef.current) return;
                    if (!tick || tick.symbol !== symbol || !Number.isFinite(tick.quote)) return;

                    tickBuffersRef.current[symbol] = [...(tickBuffersRef.current[symbol] || []), tick.quote].slice(-MAX_TICKS_PER_SYMBOL);
                    lastTickTimeRef.current[symbol] = Date.now();

                    // ⚡ THE EDIT: Execute calculation algorithms reactively on live tick packet events!
                    if (scanInProgressRef.current) evaluateAllStrategiesLive();
                });
                subscribedSymbolsRef.current.add(symbol);
                if (typeof unsubscribe === 'function') tickUnsubscribersRef.current.push(unsubscribe);
            } catch (err) {
                console.error(`[AI] Socket Subscription Error on ${symbol}:`, err);
            }
        });
    }, [ensureTickBuffer, getStrategySymbols, evaluateAllStrategiesLive]);

    const cleanupLiveTickBridge = useCallback(() => {
        if (tickRetryTimerRef.current !== null) { clearTimeout(tickRetryTimerRef.current); tickRetryTimerRef.current = null; }
        tickUnsubscribersRef.current.forEach(u => { try { u(); } catch {} });
        tickUnsubscribersRef.current = [];
        subscribedSymbolsRef.current.clear();
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        subscribeToLiveTicks();
        return () => {
            isMountedRef.current = false;
            scanGenerationRef.current += 1;
            scanInProgressRef.current = false;
            cleanupLiveTickBridge();
        };
    }, [cleanupLiveTickBridge, subscribeToLiveTicks]);
    const startLiveEvaluation = async () => {
        if (scanInProgressRef.current) return;
        scanInProgressRef.current = true;
        setIsScanning(true);
        setScannerResults([]);
        setExpandedStrategyId(null);
        subscribeToLiveTicks();
        evaluateAllStrategiesLive();
        setIsScanning(false);
    };

    const updateStake = (id: string, val: string) => {
        if (!/^\d*\.?\d*$/.test(val)) return;
        setStakeValues(p => ({ ...p, [id]: val }));
    };

    const updateTarget = (id: string, val: string) => {
        if (!/^\d*\.?\d*$/.test(val)) return;
        setTargetValues(p => ({ ...p, [id]: val }));
    };

    const toggleStrategyCard = (id: string) => {
        setExpandedStrategyId(curr => curr === id ? null : id);
    };

    const loadStrategy = async (strategy: ScannerResult) => {
        if (loadingStrategyId !== null) return;
        const eStake = parseFloat(stakeValues[strategy.id] ?? '');
        const eTarget = parseFloat(targetValues[strategy.id] ?? '');
        if (!Number.isFinite(eStake) || eStake <= 0 || !Number.isFinite(eTarget) || eTarget <= 0) return;
        if (strategy.marketState === 'INSUFFICIENT_DATA' || strategy.liveTickCount < MIN_TICKS_FOR_LIVE_SCANNER) return;

        setLoadingStrategyId(strategy.id);
        try {
            quick_strategy.setSelectedStrategy(strategy.engine);
            await quick_strategy.onSubmit({
                symbol: strategy.symbol, tradetype: strategy.tradetype, type: strategy.type, stake: eStake,
                durationtype: strategy.durationtype, duration: strategy.duration, profit: eTarget,
                loss: strategy.loss, size: strategy.size, unit: strategy.unit, action: 'LOAD',
            });
            if (isMountedRef.current) {
                setIsOpen(false); scanInProgressRef.current = false; setScannerResults([]);
                setStakeValues({}); setTargetValues({}); setExpandedStrategyId(null);
                setMarketAnalysis(analyzeMarket([]));
            }
        } catch (err) {
            console.error('[AI] Deployment Transaction Failure:', err);
        } finally {
            if (isMountedRef.current) setLoadingStrategyId(null);
        }
    };

    const closeScanner = () => {
        scanGenerationRef.current += 1; scanInProgressRef.current = false; setIsScanning(false);
        setIsOpen(false); setScannerResults([]); setLoadingStrategyId(null); setStakeValues({});
        setTargetValues({}); setExpandedStrategyId(null); setMarketAnalysis(analyzeMarket([]));
    };
    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className={`floating-ai-button ${isOpen ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
                style={dragPos ? { left: `${dragPos.x}px`, top: `${dragPos.y}px` } : undefined}
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel}
                onClick={handleButtonClick} aria-label="Open AI Scanner"
            >
                <span className="ai-ring ring-one" />
                <span className="ai-ring ring-two" />
                <span className="ai-ring ring-three" />
                <span className="ai-core">✦</span>
            </button>

            {isOpen && (
                <div className="floating-ai-panel">
                    <div className="floating-ai-header">
                        <div>
                            <span className="ai-status-dot" style={{
                                background: scanInProgressRef.current ? '#22c55e' : '#ef4444',
                                boxShadow: scanInProgressRef.current ? '0 0 13px #22c55e' : '0 0 13px #ef4444'
                            }} />
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
                                    <p>Scan all <strong>{AI_STRATEGIES.length}</strong> strategy profiles reactively against live WebSocket ticks.</p>
                                </div>
                                <div className="strategy-count"><strong>{AI_STRATEGIES.length}</strong><span>AI strategies available</span></div>
                                <button type="button" className="scan-button" onClick={startLiveEvaluation}>✦ Scan {AI_STRATEGIES.length} Strategies</button>
                            </>
                        )}

                        {isScanning && (
                            <div className="ai-scanning-state">
                                <div className="scanner-loader"><span /><span /><span /></div>
                                <h3>Connecting Socket Wire...</h3>
                                <div className="scanning-progress"><div className="scanning-progress-bar" style={{ width: '25%' }} /></div>
                            </div>
                        )}

                        {scannerResults.length > 0 && !isScanning && (
                            <>
                                <div className="scanner-heading">
                                    <div><h3>Scanner Results</h3><p>{scannerResults.length} profiles ranked via real-time WebSocket ticks.</p></div>
                                    <div className="result-count">{scannerResults.length}/{AI_STRATEGIES.length}</div>
                                </div>

                                <div className="scanner-market-status">
                                    <div><span>Market State</span><strong>{marketAnalysis.state}</strong></div>
                                    <div><span>Direction</span><strong className={`direction-${marketAnalysis.direction.toLowerCase()}`}>{marketAnalysis.direction}</strong></div>
                                    <div><span>Confidence</span><strong>{marketAnalysis.confidence}%</strong></div>
                                </div>

                                {marketAnalysis.state === 'INSUFFICIENT_DATA' && (
                                    <div className="scanner-data-notice">Waiting for ticks. Keep the panel open to let lookback snapshots fill.</div>
                                )}
                                <div className="strategy-list">
                                    {scannerResults.map(strategy => {
                                        const isExpanded = expandedStrategyId === strategy.id;
                                        const strategyLiveTicksCount = tickBuffersRef.current[strategy.symbol]?.length || 0;
                                        const isConfidenceQualified = strategy.marketConfidence >= strategy.marketProfile.minimumConfidence;

                                        return (
                                            <div key={strategy.id} className={`strategy-card ${strategy.rank === 1 ? 'top-strategy' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
                                                <button type="button" className="strategy-card-header" onClick={() => toggleStrategyCard(strategy.id)} aria-expanded={isExpanded} aria-controls={`strategy-details-${strategy.id}`}>
                                                    <div className="strategy-card-summary">
                                                        <div className={`strategy-rank ${strategy.rank === 1 ? 'rank-one' : ''}`}>#{strategy.rank}</div>
                                                        <div className="strategy-summary-main">
                                                            <div className="strategy-summary-title-row">
                                                                <div className="strategy-name">{strategy.name}</div>
                                                                <div className={`risk-badge risk-${strategy.risk.toLowerCase()}`}>{strategy.risk}</div>
                                                            </div>
                                                            <div className="strategy-summary-meta">
                                                                <span>Score <strong>{strategy.scannerScore}%</strong></span>
                                                                <span>Confidence <strong>{strategy.marketConfidence}%</strong></span>
                                                            </div>
                                                        </div>
                                                        {strategy.rank === 1 && isConfidenceQualified && strategy.marketState !== 'INSUFFICIENT_DATA' && <div className="best-badge">BEST MATCH</div>}
                                                        <span className={`strategy-expand-icon ${isExpanded ? 'open' : ''}`} aria-hidden="true">›</span>
                                                    </div>
                                                </button>

                                                <div id={`strategy-details-${strategy.id}`} className={`strategy-card-body ${isExpanded ? 'visible' : ''}`} aria-hidden={!isExpanded}>
                                                    <div className="strategy-card-body-inner">
                                                        <div className="strategy-description">{strategy.description}</div>
                                                        <div className="strategy-market-live">
                                                            <div><span>Live Market</span><strong>{strategy.marketState}</strong></div>
                                                            <div><span>Direction</span><strong className={`direction-${strategy.marketDirection.toLowerCase()}`}>{strategy.marketDirection}</strong></div>
                                                            <div><span>Confidence</span><strong>{strategy.marketConfidence}%</strong></div>
                                                        </div>
                                                        <div className="strategy-market-live">
                                                            <div><span>Live Ticks</span><strong>{strategyLiveTicksCount}/{MAX_TICKS_PER_SYMBOL}</strong></div>
                                                            <div><span>Required</span><strong>{strategy.marketProfile.minimumConfidence}%</strong></div>
                                                            <div><span>Confidence Gate</span><strong style={{ color: isConfidenceQualified ? '#22c55e' : '#eab308' }}>{isConfidenceQualified ? 'PASS' : 'WAIT'}</strong></div>
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
                                                            <div className="strategy-detail"><span>Market</span><strong>{strategy.symbol}</strong></div>
                                                            <div className="strategy-detail"><span>Direction</span><strong>{strategy.type || 'Default'}</strong></div>
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
                                <button type="button" className="rescan-button" onClick={startLiveEvaluation} disabled={loadingStrategyId !== null}>↻ Force Model Recalculation</button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default FloatingAI;
