import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    PointerEvent, // Added for type-safe dragging interactions
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
* TYPES
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

// Added explicitly to type-safe the boundary coordinates tracking structure
interface DragPosition {
    x: number;
    y: number;
}

/*
* ============================================================
* CONSTANTS
* ============================================================
*/

const MAX_TICKS_PER_SYMBOL = 100;

const MIN_TICKS_FOR_LIVE_SCANNER = 20;

const LIVE_TICK_RETRY_MS = 1000;

const SCAN_SETTLE_MS = 900;

/*
* ============================================================
* COMPONENT
* ============================================================
*/

const FloatingAI = () => {
    const { quick_strategy } = useStore();

    /*
     * ------------------------------------------------------------
     * UI STATE
     * ------------------------------------------------------------
     */

    const [isOpen, setIsOpen] = useState(false);

    const [isScanning, setIsScanning] =
        useState(false);

    const [scannerResults, setScannerResults] =
        useState<ScannerResult[]>([]);

    const [loadingStrategyId, setLoadingStrategyId] =
        useState<string | null>(null);

    /*
     * NEW:
     *
     * Controls which strategy card is expanded.
     *
     * Only one strategy is expanded at a time.
     */
    const [expandedStrategyId, setExpandedStrategyId] =
        useState<string | null>(null);

    /*
     * ------------------------------------------------------------
     * RUNTIME MARGIN BOUNDARY DRAG STATE
     * ------------------------------------------------------------
     */
    const [dragPos, setDragPos] = useState<DragPosition>({ x: 0, y: 0 });
    const buttonRef = useRef<HTMLDivElement | null>(null);
    const isDragging = useRef<boolean>(false);
    const dragStart = useRef<DragPosition>({ x: 0, y: 0 });

    /*
     * ------------------------------------------------------------
     * LIVE TICK STORAGE
     * ------------------------------------------------------------
     */

    const tickBuffersRef = useRef<
        Record<string, number[]>
    >({});

    const lastTickTimeRef = useRef<
        Record<string, number>
    >({});

    const invalidTickCountRef = useRef(0);

    /*
     * ------------------------------------------------------------
     * SUBSCRIPTION MANAGEMENT
     * ------------------------------------------------------------
     */

    const tickUnsubscribersRef = useRef<
        Array<() => void>
    >([]);

    const subscribedSymbolsRef = useRef<
        Set<string>
    >(new Set());

    const tickRetryTimerRef =
        useRef<ReturnType<typeof setTimeout> | null>(
            null
        );

    const isMountedRef = useRef(true);

    /*
     * ------------------------------------------------------------
     * SCAN CONTROL
     * ------------------------------------------------------------
     */

const scanInProgressRef = useRef(false);

const scanGenerationRef = useRef(0);

/*
 * ------------------------------------------------------------
 * MARKET ANALYSIS
 * ------------------------------------------------------------
 */

const [marketAnalysis, setMarketAnalysis] =
    useState<MarketAnalysis>(() =>
        analyzeMarket([])
    );

/*
 * ------------------------------------------------------------
 * EDITABLE VALUES
 * ------------------------------------------------------------
 */

const [stakeValues, setStakeValues] =
    useState<Record<string, string>>({});

const [targetValues, setTargetValues] =
    useState<Record<string, string>>({});

/*
 * ============================================================
 * SYMBOL COLLECTION
 * ============================================================
 */

const getStrategySymbols = useCallback(() => {
    return Array.from(
        new Set(
            AI_STRATEGIES
                .map(strategy => strategy.symbol)
                .filter(
                    symbol =>
                        typeof symbol === 'string' &&
                        symbol.trim().length > 0
                )
        )
    );
}, []);

/*
 * ============================================================
 * TICK BUFFER HELPER
 * ============================================================
 */

const ensureTickBuffer = useCallback(
    (symbol: string) => {
        if (!tickBuffersRef.current[symbol]) {
            tickBuffersRef.current[symbol] = [];
        }

        return tickBuffersRef.current[symbol];
    },
    []
);

/*
 * ============================================================
 * LIVE DERIV TICK BRIDGE
 * ============================================================
 */

const subscribeToLiveTicks = useCallback(() => {
    if (!isMountedRef.current) {
        return;
    }

    const symbols = getStrategySymbols();

    if (symbols.length === 0) {
        console.warn(
            '[AI Scanner] No valid strategy symbols found.'
        );

        return;
    }

    if (!api_base.api) {
        if (
            tickRetryTimerRef.current === null
        ) {
            tickRetryTimerRef.current =
                setTimeout(() => {
                    tickRetryTimerRef.current =
                        null;

                    if (
                        isMountedRef.current
                    ) {
                        subscribeToLiveTicks();
                    }
                }, LIVE_TICK_RETRY_MS);
        }

        return;
    }

    if (
        tickRetryTimerRef.current !== null
    ) {
        clearTimeout(
            tickRetryTimerRef.current
        );

        tickRetryTimerRef.current = null;
    }

    symbols.forEach(symbol => {
        if (
            subscribedSymbolsRef.current.has(
                symbol
            )
        ) {
            return;
        }

        ensureTickBuffer(symbol);

        try {
            const unsubscribe =
                api_base.subscribeToTicks(
                    symbol,
                    tick => {
                        if (
                            !isMountedRef.current
                        ) {
                            return;
                        }

                        if (
                            !tick ||
                            tick.symbol !== symbol ||
                            !Number.isFinite(
                                tick.quote
                            )
                        ) {
                            invalidTickCountRef.current +=
                                1;

                            console.warn(
                                '[AI Scanner] Invalid tick received:',
                                {
                                    expectedSymbol:
                                        symbol,
                                    tick,
                                }
                            );

                            return;
                        }

                        const currentTicks =
                            tickBuffersRef.current[
                                symbol
                            ] || [];

                        const updatedTicks = [
                            ...currentTicks,
                            tick.quote,
                        ];

                        tickBuffersRef.current[
                            symbol
                        ] =
                            updatedTicks.slice(
                                -MAX_TICKS_PER_SYMBOL
                            );

                        lastTickTimeRef.current[
                            symbol
                        ] = Date.now();

                        console.log(
                            '[AI Scanner] TICK RECEIVED:',
                            {
                                symbol,
                                quote: tick.quote,
                                epoch: tick.epoch,
                                count:
                                    tickBuffersRef.current[
                                        symbol
                                    ].length,
                            }
                        );
                    }
                );

            subscribedSymbolsRef.current.add(
                symbol
            );

            if (
                typeof unsubscribe ===
                'function'
            ) {
                tickUnsubscribersRef.current.push(
                    unsubscribe
                );
            }

            console.log(
                `[AI Scanner] Live ticks connected: ${symbol}`
            );
        } catch (error) {
            console.error(
                `[AI Scanner] Failed to subscribe to ${symbol}:`,
                error
            );
        }
    });
}, [
    ensureTickBuffer,
    getStrategySymbols,
]);

/*
 * ============================================================
 * CLEANUP LIVE TICK BRIDGE
 * ============================================================
 */

const cleanupLiveTickBridge =
    useCallback(() => {
        if (
            tickRetryTimerRef.current !== null
        ) {
            clearTimeout(
                tickRetryTimerRef.current
            );

            tickRetryTimerRef.current = null;
        }

        tickUnsubscribersRef.current.forEach(
            unsubscribe => {
                try {
                    unsubscribe();
                } catch (error) {
                    console.warn(
                        '[AI Scanner] Tick unsubscribe failed:',
                        error
                    );
                }
            }
        );

        tickUnsubscribersRef.current = [];

        subscribedSymbolsRef.current.clear();
    }, []);

/*
 * ============================================================
 * START LIVE TICK BRIDGE
 * ============================================================
 */

useEffect(() => {
    isMountedRef.current = true;

    subscribeToLiveTicks();

    return () => {
        isMountedRef.current = false;

        scanGenerationRef.current += 1;

        scanInProgressRef.current = false;

        cleanupLiveTickBridge();
    };
}, [
    cleanupLiveTickBridge,
    subscribeToLiveTicks,
]);

/*
 * ============================================================
 * PROFILE SCORE
 * ============================================================
 */

const calculateProfileScore = (
    strategy: AIStrategy
): number => {
    let score = 70;

    if (strategy.risk === 'LOW') {
        score += 8;
    } else if (
        strategy.risk === 'MEDIUM'
    ) {
        score += 5;
    } else {
        score += 2;
    }

    if (
        strategy.profit > 0 &&
        strategy.loss > 0
    ) {
        const ratio =
            strategy.profit /
            strategy.loss;

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

    if (
        preferredEngines.includes(
            strategy.engine
        )
    ) {
        score += 3;
    }

    return Math.min(
        99,
        Math.max(50, score)
    );
};

/*
 * ============================================================
 * FINAL SCANNER SCORE
 * ============================================================
 */

const calculateFinalScannerScore = (
    strategy: AIStrategy,
    analysis: MarketAnalysis
): {
    scannerScore: number;
    marketCompatibility: number;
    confidenceQualified: boolean;
} => {
    const profileScore =
        calculateProfileScore(strategy);

    const marketCompatibility =
        calculateMarketCompatibility(
            strategy,
            analysis
        );

    if (
        analysis.state ===
        'INSUFFICIENT_DATA'
    ) {
        return {
            scannerScore: 0,
            marketCompatibility: 0,
            confidenceQualified: false,
        };
    }

    const confidenceQualified =
        analysis.confidence >=
        strategy.marketProfile
            .minimumConfidence;

    let finalScore =
        profileScore * 0.4 +
        marketCompatibility * 0.6;

    if (!confidenceQualified) {
        finalScore *= 0.65;
    }

    return {
        scannerScore: Math.round(
            Math.min(
                99,
                Math.max(
                    0,
                    finalScore
                )
            )
        ),

        marketCompatibility:
            Math.round(
                Math.min(
                    100,
                    Math.max(
                        0,
                        marketCompatibility
                    )
                )
            ),

        confidenceQualified,
    };
};

/*
 * ============================================================
 * BUILD INITIAL EDITABLE VALUES
 * ============================================================
 */

const initializeEditableValues = (
    results: ScannerResult[]
) => {
    const initialStakeValues: Record<
        string,
        string
    > = {};

    const initialTargetValues: Record<
        string,
        string
    > = {};

    results.forEach(strategy => {
        initialStakeValues[
            strategy.id
        ] = String(strategy.stake);

        initialTargetValues[
            strategy.id
        ] = String(strategy.profit);
    });

    setStakeValues(
        initialStakeValues
    );

    setTargetValues(
        initialTargetValues
    );
};

/*
 * ============================================================
 * SCAN ALL STRATEGIES
 * ============================================================
 */

const scanAllStrategies = async () => {
    if (scanInProgressRef.current) {
        return;
    }

    scanInProgressRef.current = true;

    const currentScanGeneration =
        ++scanGenerationRef.current;

    setIsScanning(true);
    setScannerResults([]);

    /*
     * NEW:
     *
     * Start each scan with no expanded card.
     *
     * Once ranked results arrive, #1 is automatically
     * expanded below.
     */
    setExpandedStrategyId(null);

    try {
        subscribeToLiveTicks();

        await new Promise(resolve =>
            setTimeout(
                resolve,
                SCAN_SETTLE_MS
            )
        );

        if (
            !isMountedRef.current ||
            currentScanGeneration !==
                scanGenerationRef.current
        ) {
            return;
        }

        const runScannerIteration = () => {
            if (
                !isMountedRef.current ||
                currentScanGeneration !==
                    scanGenerationRef.current
            ) {
                return false;
            }

            const results =
                AI_STRATEGIES.map(
                    strategy => {
                        const liveTicks =
                            tickBuffersRef
                                .current[
                                strategy.symbol
                            ] || [];

                        const analysis =
                            analyzeMarket(
                                liveTicks
                            );

                        const scores =
                            calculateFinalScannerScore(
                                strategy,
                                analysis
                            );

                        return {
                            ...strategy,

                            scannerScore:
                                scores.scannerScore,

                            marketCompatibility:
                                scores.marketCompatibility,

                            rank: 0,

                            marketState:
                                analysis.state,

                            marketDirection:
                                analysis.direction,

                            marketConfidence:
                                analysis.confidence,

                            confidenceQualified:
                                scores.confidenceQualified,

                            liveTickCount:
                                liveTicks.length,
                        };
                    }
                );

            const hasUsableLiveData =
                results.some(
                    result =>
                        result.liveTickCount >=
                            MIN_TICKS_FOR_LIVE_SCANNER &&
                        result.marketState !==
                            'INSUFFICIENT_DATA'
                );

            results.sort((a, b) => {
                if (
                    hasUsableLiveData &&
                    a.confidenceQualified !==
                        b.confidenceQualified
                ) {
                    return a.confidenceQualified
                        ? -1
                        : 1;
                }

                if (
                    b.scannerScore !==
                    a.scannerScore
                ) {
                    return (
                        b.scannerScore -
                        a.scannerScore
                    );
                }

                if (
                    b.marketCompatibility !==
                    a.marketCompatibility
                ) {
                    return (
                        b.marketCompatibility -
                        a.marketCompatibility
                    );
                }

                if (
                    b.marketConfidence !==
                    a.marketConfidence
                ) {
                    return (
                        b.marketConfidence -
                        a.marketConfidence
                    );
                }

                return a.name.localeCompare(
                    b.name
                );
            });

            const rankedResults =
                results.map(
                    (
                        strategy,
                        index
                    ) => ({
                        ...strategy,
                        rank:
                            index + 1,
                    })
                );

            if (
                rankedResults.length >
                0
            ) {
                const topStrategy =
                    rankedResults[0];

                const topTicks =
                    tickBuffersRef
                        .current[
                        topStrategy.symbol
                    ] || [];

                const topAnalysis =
                    analyzeMarket(
                        topTicks
                    );

                setMarketAnalysis(
                    topAnalysis
                );
            } else {
                setMarketAnalysis(
                    analyzeMarket([])
                );
            }

            setStakeValues(
                prev => {
                    const nextStakes =
                        {
                            ...prev,
                        };

                    rankedResults.forEach(
                        strategy => {
                            if (
                                nextStakes[
                                    strategy.id
                                ] ===
                                undefined
                            ) {
                                nextStakes[
                                    strategy.id
                                ] =
                                    String(
                                        strategy.stake
                                    );
                            }
                        }
                    );

                    return nextStakes;
                }
            );

            setTargetValues(
                prev => {
                    const nextTargets =
                        {
                            ...prev,
                        };

                    rankedResults.forEach(
                        strategy => {
                            if (
                                nextTargets[
                                    strategy.id
                                ] ===
                                undefined
                            ) {
                                nextTargets[
                                    strategy.id
                                ] =
                                    String(
                                        strategy.profit
                                    );
                            }
                        }
                    );

                    return nextTargets;
                }
            );

            if (hasUsableLiveData) {
                setScannerResults(
                    rankedResults
                );

                /*
                 * NEW:
                 *
                 * Automatically open the first-ranked
                 * strategy when the first usable results
                 * arrive.
                 *
                 * We only do this if nothing is already
                 * expanded so user interaction is preserved.
                 */
                setExpandedStrategyId(
                    currentExpandedId =>
                        currentExpandedId ??
                        rankedResults[0]?.id ??
                        null
                );
            } else {
                const initialSeedingList =
                    AI_STRATEGIES.map(
                        (
                            strategy,
                            idx
                        ) => ({
                            ...strategy,

                            scannerScore:
                                0,

                            marketCompatibility:
                                0,

                            rank:
                                idx + 1,

                            marketState:
                                'INSUFFICIENT_DATA' as const,

                            marketDirection:
                                'FLAT' as const,

                            marketConfidence:
                                0,

                            confidenceQualified:
                                false,

                            liveTickCount:
                                tickBuffersRef
                                    .current[
                                    strategy
                                        .symbol
                                ]
                                    ?.length ||
                                0,
                        })
                    );

                setScannerResults(
                    initialSeedingList
                );

                /*
                 * Still expand #1 while the scanner is
                 * waiting for data.
                 */
                setExpandedStrategyId(
                    currentExpandedId =>
                        currentExpandedId ??
                        initialSeedingList[0]?.id ??
                        null
                );
            }

            return true;
        };

        runScannerIteration();

        const streamingIntervalId =
            setInterval(() => {
                const keepAlive =
                    runScannerIteration();

                if (!keepAlive) {
                    clearInterval(
                        streamingIntervalId
                    );
                }
            }, 1000);
    } catch (error) {
        console.error(
            '[AI Scanner] Core Evaluation Error:',
            error
        );
    } finally {
        if (
            isMountedRef.current &&
            currentScanGeneration ===
                scanGenerationRef.current
        ) {
            setIsScanning(false);
            scanInProgressRef.current =
                false;
        }
    }
};

/*
 * ============================================================
 * UPDATE STAKE
 * ============================================================
 */

const updateStake = (
    strategyId: string,
    value: string
) => {
    if (
        !/^\d*\.?\d*$/.test(value)
    ) {
        return;
    }

    setStakeValues(previous => ({
        ...previous,
        [strategyId]: value,
    }));
};

/*
 * ============================================================
 * UPDATE TARGET
 * ============================================================
 */

const updateTarget = (
    strategyId: string,
    value: string
) => {
    if (
        !/^\d*\.?\d*$/.test(value)
    ) {
        return;
    }

    setTargetValues(previous => ({
        ...previous,
        [strategyId]: value,
    }));
};

/*
 * ============================================================
 * TOGGLE STRATEGY CARD
 * ============================================================
 */

const toggleStrategyCard = (
    strategyId: string
) => {
    setExpandedStrategyId(
        currentId =>
            currentId === strategyId
                ? null
                : strategyId
    );
};

/*
 * ============================================================
 * LOAD SELECTED STRATEGY
 * ============================================================
 */

const loadStrategy = async (
    strategy: ScannerResult
) => {
    if (loadingStrategyId !== null) {
        return;
    }

    if (scanInProgressRef.current) {
        return;
    }

    const editedStake =
        parseFloat(
            stakeValues[strategy.id] ?? ''
        );

    const editedTarget =
        parseFloat(
            targetValues[strategy.id] ?? ''
        );

    if (
        !Number.isFinite(
            editedStake
        ) ||
        editedStake <= 0
    ) {
        console.error(
            '[AI Scanner] Invalid stake amount.'
        );

        return;
    }

    if (
        !Number.isFinite(
            editedTarget
        ) ||
        editedTarget <= 0
    ) {
        console.error(
            '[AI Scanner] Invalid target amount.'
        );

        return;
    }

    if (
        strategy.marketState ===
            'INSUFFICIENT_DATA' ||
        strategy.liveTickCount <
            MIN_TICKS_FOR_LIVE_SCANNER
    ) {
        console.warn(
            '[AI Scanner] Strategy cannot be loaded from an insufficient-data scan.'
        );

        return;
    }

    setLoadingStrategyId(
        strategy.id
    );

    try {
        quick_strategy.setSelectedStrategy(
            strategy.engine
        );

        await quick_strategy.onSubmit({
            symbol:
                strategy.symbol,

            tradetype:
                strategy.tradetype,

            type:
                strategy.type,

            stake:
                editedStake,

            durationtype:
                strategy.durationtype,

            duration:
                strategy.duration,

            profit:
                editedTarget,

            loss:
                strategy.loss,

            size:
                strategy.size,

            unit:
                strategy.unit,

            action:
                'LOAD',
        });

        if (
            isMountedRef.current
        ) {
            setIsOpen(false);

            setScannerResults([]);

            setStakeValues({});

            setTargetValues({});

            setExpandedStrategyId(null);

            setMarketAnalysis(
                analyzeMarket([])
            );
        }
    } catch (error) {
        console.error(
            '[AI Scanner] Failed to load AI strategy:',
            error
        );
    } finally {
        if (
            isMountedRef.current
        ) {
            setLoadingStrategyId(
                null
            );
        }
    }
};

/*
 * ============================================================
 * CLOSE SCANNER
 * ============================================================
 */

const closeScanner = () => {
    scanGenerationRef.current += 1;

    scanInProgressRef.current = false;

    setIsScanning(false);

    setIsOpen(false);

    setScannerResults([]);

    setLoadingStrategyId(null);

    setStakeValues({});

    setTargetValues({});

    setExpandedStrategyId(null);

    setMarketAnalysis(
        analyzeMarket([])
    );
};

/*
 * ============================================================
 * RENDER
 * ============================================================
 */

return (
    <>
        <button
            type="button"
            className={`floating-ai-button ${
                isOpen
                    ? 'active'
                    : ''
            }`}
            onClick={() => {
                if (isOpen) {
                    closeScanner();
                } else {
                    setIsOpen(true);

                    subscribeToLiveTicks();
                }
            }}
            aria-label="Open AI Scanner"
        >
            <span className="ai-ring ring-one" />

            <span className="ai-ring ring-two" />

            <span className="ai-ring ring-three" />

            <span className="ai-core">
                ✦
            </span>
        </button>

        {isOpen && (
            <div className="floating-ai-panel">

                <div className="floating-ai-header">
                    <div>
                        <span className="ai-status-dot" />

                        <strong>
                            AI Strategy Scanner
                        </strong>
                    </div>

                    <button
                        type="button"
                        className="ai-close"
                        onClick={
                            closeScanner
                        }
                        aria-label="Close AI Scanner"
                    >
                        ×
                    </button>
                </div>

                <div className="floating-ai-content">

                    {scannerResults.length ===
                        0 &&
                        !isScanning && (
                            <>
                                <div className="ai-hero">
                                    <div className="ai-hero-icon">
                                        ✦
                                    </div>

                                    <h3>
                                        AI Trading Scanner
                                    </h3>

                                    <p>
                                        Scan all{' '}
                                        <strong>
                                            {
                                                AI_STRATEGIES.length
                                            }
                                        </strong>{' '}
                                        available
                                        strategy
                                        profiles
                                        against
                                        live Deriv
                                        market
                                        ticks.
                                    </p>
                                </div>

                                <div className="strategy-count">
                                    <strong>
                                        {
                                            AI_STRATEGIES.length
                                        }
                                    </strong>

                                    <span>
                                        AI
                                        strategies
                                        available
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    className="scan-button"
                                    onClick={
                                        scanAllStrategies
                                    }
                                    disabled={
                                        isScanning
                                    }
                                >
                                    ✦ Scan{' '}
                                    {
                                        AI_STRATEGIES.length
                                    }{' '}
                                    Strategies
                                </button>
                            </>
                        )}

                    {isScanning && (
                        <div className="ai-scanning-state">
                            <div className="scanner-loader">
                                <span />
                                <span />
                                <span />
                            </div>

                            <h3>
                                Scanning
                                Strategies...
                            </h3>

                            <p>
                                Analyzing{' '}
                                {
                                    AI_STRATEGIES.length
                                }{' '}
                                strategies
                                against
                                live market
                                ticks.
                            </p>

                            <div className="scanning-progress">
                                <div className="scanning-progress-bar" />
                            </div>
                        </div>
                    )}

                    {scannerResults.length >
                        0 &&
                        !isScanning && (
                            <>
                                <div className="scanner-heading">
                                    <div>
                                        <h3>
                                            Scanner
                                            Results
                                        </h3>

                                        <p>
                                            {
                                                scannerResults.length
                                            }{' '}
                                            strategies
                                            ranked
                                            using
                                            live
                                            market
                                            data.
                                        </p>
                                    </div>

                                    <div className="result-count">
                                        {
                                            scannerResults.length
                                        }
                                        /
                                        {
                                            AI_STRATEGIES.length
                                        }
                                    </div>
                                </div>

                                <div className="scanner-market-status">
                                    <div>
                                        <span>
                                            Market
                                            State
                                        </span>

                                        <strong>
                                            {
                                                marketAnalysis.state
                                            }
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Direction
                                        </span>

                                        <strong>
                                            {
                                                marketAnalysis.direction
                                            }
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Confidence
                                        </span>

                                        <strong>
                                            {
                                                marketAnalysis.confidence
                                            }
                                            %
                                        </strong>
                                    </div>
                                </div>

                                {marketAnalysis.state ===
                                    'INSUFFICIENT_DATA' && (
                                    <div className="scanner-data-notice">
                                        Waiting
                                        for
                                        enough
                                        live
                                        ticks.
                                        Keep the
                                        scanner
                                        open and
                                        scan
                                        again
                                        once
                                        data has
                                        accumulated.
                                    </div>
                                )}

                                <div className="strategy-list">
                                    {scannerResults.map(
                                        strategy => {
                                            const isExpanded =
                                                expandedStrategyId ===
                                                strategy.id;

                                            return (
                                                <div
                                                    key={
                                                        strategy.id
                                                    }
                                                    className={`strategy-card ${
                                                        strategy.rank ===
                                                        1
                                                            ? 'top-strategy'
                                                            : ''
                                                    } ${
                                                        isExpanded
                                                            ? 'expanded'
                                                            : 'collapsed'
                                                    }`}
                                                >

                                                    <button
                                                        type="button"
                                                        className="strategy-card-header"
                                                        onClick={() =>
                                                            toggleStrategyCard(
                                                                strategy.id
                                                            )
                                                        }
                                                        aria-expanded={
                                                            isExpanded
                                                        }
                                                        aria-controls={`strategy-details-${strategy.id}`}
                                                    >
                                                        <div className="strategy-card-summary">

                                                            <div
                                                                className={`strategy-rank ${
                                                                    strategy.rank ===
                                                                    1
                                                                        ? 'rank-one'
                                                                        : ''
                                                                }`}
                                                            >
                                                                #
                                                                {
                                                                    strategy.rank
                                                                }
                                                            </div>

                                                            <div className="strategy-summary-main">
                                                                <div className="strategy-summary-title-row">

                                                                    <div className="strategy-name">
                                                                        {
                                                                            strategy.name
                                                                        }
                                                                    </div>

                                                                    <div
                                                                        className={`risk-badge risk-${strategy.risk.toLowerCase()}`}
                                                                    >
                                                                        {
                                                                            strategy.risk
                                                                        }
                                                                    </div>

                                                                </div>

                                                                <div className="strategy-summary-meta">
                                                                    <span>
                                                                        Score{' '}
                                                                        <strong>
                                                                            {
                                                                                strategy.scannerScore
                                                                            }
                                                                            %
                                                                        </strong>
                                                                    </span>

                                                                    <span>
                                                                        Confidence{' '}
                                                                        <strong>
                                                                            {
                                                                                strategy.marketConfidence
                                                                            }
                                                                            %
                                                                        </strong>
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {strategy.rank ===
                                                                1 &&
                                                                strategy.confidenceQualified &&
                                                                strategy.marketState !==
                                                                    'INSUFFICIENT_DATA' && (
                                                                <div className="best-badge">
                                                                    BEST
                                                                    MATCH
                                                                </div>
                                                            )}

                                                            <span
                                                                className={`strategy-expand-icon ${
                                                                    isExpanded
                                                                        ? 'open'
                                                                        : ''
                                                                }`}
                                                                aria-hidden="true"
                                                            >
                                                                ›
                                                            </span>

                                                        </div>
                                                    </button>

                                                    <div
                                                        id={`strategy-details-${strategy.id}`}
                                                        className={`strategy-card-body ${
                                                            isExpanded
                                                                ? 'visible'
                                                                : ''
                                                        }`}
                                                        aria-hidden={
                                                            !isExpanded
                                                        }
                                                    >

                                                        <div className="strategy-description">
                                                            {
                                                                strategy.description
                                                            }
                                                        </div>

                                                        <div className="strategy-market-live">
                                                            <div>
                                                                <span>
                                                                    Live
                                                                    Market
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        strategy.marketState
                                                                    }
                                                                </strong>
                                                            </div>

                                                            <div>
                                                                <span>
                                                                    Direction
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        strategy.marketDirection
                                                                    }
                                                                </strong>
                                                            </div>

                                                            <div>
                                                                <span>
                                                                    Confidence
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        strategy.marketConfidence
                                                                    }
                                                                    %
                                                                </strong>
                                                            </div>
                                                        </div>

                                                        <div className="strategy-market-live">
                                                            <div>
                                                                <span>
                                                                    Live
                                                                    Ticks
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        strategy.liveTickCount
                                                                    }
                                                                    /
                                                                    {
                                                                        MAX_TICKS_PER_SYMBOL
                                                                    }
                                                                </strong>
                                                            </div>

                                                            <div>
                                                                <span>
                                                                    Required
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        strategy
                                                                            .marketProfile
                                                                            .minimumConfidence
                                                                    }
                                                                    %
                                                                </strong>
                                                            </div>

                                                            <div>
                                                                <span>
                                                                    Confidence
                                                                    Gate
                                                                </span>

                                                                <strong>
                                                                    {strategy.confidenceQualified
                                                                        ? 'PASS'
                                                                        : 'WAIT'}
                                                                </strong>
                                                            </div>
                                                        </div>

                                                        <div className="scanner-score">
                                                            <div className="score-info">
                                                                <span>
                                                                    Scanner
                                                                    Score
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        strategy.scannerScore
                                                                    }
                                                                    %
                                                                </strong>
                                                            </div>

                                                            <div className="score-track">
                                                                <div
                                                                    className="score-fill"
                                                                    style={{
                                                                        width: `${strategy.scannerScore}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="scanner-score">
                                                            <div className="score-info">
                                                                <span>
                                                                    Market
                                                                    Compatibility
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        strategy.marketCompatibility
                                                                    }
                                                                    %
                                                                </strong>
                                                            </div>

                                                            <div className="score-track">
                                                                <div
                                                                    className="score-fill"
                                                                    style={{
                                                                        width: `${strategy.marketCompatibility}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="strategy-details">

                                                            <div className="strategy-detail">
                                                                <span>
                                                                    Engine
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        strategy.engine
                                                                    }
                                                                </strong>
                                                            </div>

                                                            <div className="strategy-detail">
                                                                <span>
                                                                    Market
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        strategy.symbol
                                                                    }
                                                                </strong>
                                                            </div>

                                                            <div className="strategy-detail">
                                                                <span>
                                                                    Direction
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        strategy.type ||
                                                                        'Default'
                                                                    }
                                                                </strong>
                                                            </div>

                                                            <div className="strategy-detail editable-strategy-detail">
                                                                <span>
                                                                    Stake
                                                                </span>

                                                                <div className="strategy-input-wrapper">
                                                                    <span className="strategy-input-prefix">
                                                                        $
                                                                    </span>

                                                                    <input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        value={
                                                                            stakeValues[
                                                                                strategy
                                                                                    .id
                                                                            ] ??
                                                                            ''
                                                                        }
                                                                        onChange={event =>
                                                                            updateStake(
                                                                                strategy.id,
                                                                                event
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        onClick={event =>
                                                                            event.stopPropagation()
                                                                        }
                                                                        aria-label={`Stake for ${strategy.name}`}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="strategy-detail">
                                                                <span>
                                                                    Duration
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        strategy.duration
                                                                    }{' '}
                                                                    {strategy.duration ===
                                                                    1
                                                                        ? 'tick'
                                                                        : 'ticks'}
                                                                </strong>
                                                            </div>

                                                            <div className="strategy-detail editable-strategy-detail">
                                                                <span>
                                                                    Target
                                                                </span>

                                                                <div className="strategy-input-wrapper">
                                                                    <span className="strategy-input-prefix">
                                                                        $
                                                                    </span>

                                                                    <input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        value={
                                                                            targetValues[
                                                                                strategy
                                                                                    .id
                                                                            ] ??
                                                                            ''
                                                                        }
                                                                        onChange={event =>
                                                                            updateTarget(
                                                                                strategy.id,
                                                                                event
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        onClick={event =>
                                                                            event.stopPropagation()
                                                                        }
                                                                        aria-label={`Target for ${strategy.name}`}
                                                                    />
                                                                </div>
                                                            </div>

                                                        </div>

                                                        <button
                                                            type="button"
                                                            className="load-bot-button"
                                                            onClick={() =>
                                                                loadStrategy(
                                                                    strategy
                                                                )
                                                            }
                                                            disabled={
                                                                loadingStrategyId !==
                                                                    null ||
                                                                isScanning ||
                                                                strategy.marketState ===
                                                                    'INSUFFICIENT_DATA' ||
                                                                strategy.liveTickCount <
                                                                    MIN_TICKS_FOR_LIVE_SCANNER
                                                            }
                                                        >
                                                            {loadingStrategyId ===
                                                            strategy.id
                                                                ? 'Loading...'
                                                                : strategy.marketState ===
                                                                        'INSUFFICIENT_DATA' ||
                                                                    strategy.liveTickCount <
                                                                        MIN_TICKS_FOR_LIVE_SCANNER
                                                                  ? 'Waiting for Data'
                                                                  : 'Load Bot'}
                                                        </button>

                                                    </div>
                                                </div>
                                            );
                                        }
                                    )}
                                </div>

                                <button
                                    type="button"
                                    className="rescan-button"
                                    onClick={
                                        scanAllStrategies
                                    }
                                    disabled={
                                        isScanning ||
                                        loadingStrategyId !==
                                            null
                                    }
                                >
                                    ↻ Scan Again
                                </button>
                            </>
                        )}
                </div>
            </div>
        )}
    </>
);

};

export default FloatingAI;
