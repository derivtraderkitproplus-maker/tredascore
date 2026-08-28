import React, { useState } from 'react';
import { useStore } from '@/hooks/useStore';
import { AI_STRATEGIES, AIStrategy } from './strategies';
import {
    analyzeMarket,
    calculateMarketCompatibility,
    MarketAnalysis,
} from './scannerLogic';
import './FloatingAI.css';

type ScannerResult = AIStrategy & {
    scannerScore: number;
    marketCompatibility: number;
    rank: number;
};

const FloatingAI = () => {
    const { quick_strategy } = useStore();

    const [isOpen, setIsOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const [scannerResults, setScannerResults] = useState<
        ScannerResult[]
    >([]);

    const [loadingStrategyId, setLoadingStrategyId] =
        useState<string | null>(null);

    /*
     * ------------------------------------------------------------
     * MARKET ANALYSIS
     * ------------------------------------------------------------
     *
     * This will later be populated by live Deriv ticks.
     *
     * For now we keep the scanner safely in an
     * INSUFFICIENT_DATA state until the live tick bridge
     * is connected.
     *
     * IMPORTANT:
     *
     * We do NOT invent market data.
     */
    const [marketAnalysis, setMarketAnalysis] =
        useState<MarketAnalysis>(() =>
            analyzeMarket([])
        );

    /*
     * ------------------------------------------------------------
     * EDITABLE STAKE / TARGET VALUES
     * ------------------------------------------------------------
     */

    const [stakeValues, setStakeValues] =
        useState<Record<string, string>>({});

    const [targetValues, setTargetValues] =
        useState<Record<string, string>>({});

    /**
     * ------------------------------------------------------------
     * BASE STRATEGY SCORE
     * ------------------------------------------------------------
     *
     * This measures the quality of the strategy profile itself.
     *
     * It is NOT a win rate.
     *
     * It does NOT predict profit.
     */
    const calculateProfileScore = (
        strategy: AIStrategy
    ): number => {
        let score = 70;

        /*
         * Risk profile
         */
        if (strategy.risk === 'LOW') {
            score += 8;
        } else if (strategy.risk === 'MEDIUM') {
            score += 5;
        } else {
            score += 2;
        }

        /*
         * Profit / loss relationship
         */
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

        /*
         * Short duration preference
         */
        if (strategy.duration <= 1) {
            score += 4;
        }

        /*
         * Existing Quick Strategy engines
         */
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

    /**
     * ------------------------------------------------------------
     * FINAL SCANNER SCORE
     * ------------------------------------------------------------
     *
     * Combines:
     *
     * 1. Strategy profile score
     * 2. Current market compatibility
     *
     * This creates the foundation for the future
     * live-market strategy ranking.
     */
    const calculateFinalScannerScore = (
        strategy: AIStrategy,
        analysis: MarketAnalysis
    ): {
        scannerScore: number;
        marketCompatibility: number;
    } => {
        const profileScore =
            calculateProfileScore(strategy);

        const marketCompatibility =
            calculateMarketCompatibility(
                strategy,
                analysis
            );

        /*
         * If there is not enough market data yet,
         * don't pretend there is a live-market advantage.
         *
         * The profile score remains visible.
         */
        if (
            analysis.state ===
            'INSUFFICIENT_DATA'
        ) {
            return {
                scannerScore: profileScore,
                marketCompatibility: 0,
            };
        }

        /*
         * Weighted score:
         *
         * 60% market compatibility
         * 40% strategy profile
         *
         * Once live data is connected this will make
         * market conditions more important than static
         * strategy properties.
         */
        const finalScore =
            profileScore * 0.4 +
            marketCompatibility * 0.6;

        return {
            scannerScore: Math.round(
                Math.min(
                    99,
                    Math.max(0, finalScore)
                )
            ),

            marketCompatibility,
        };
    };

    /**
     * ------------------------------------------------------------
     * SCAN ALL STRATEGIES
     * ------------------------------------------------------------
     */
    const scanAllStrategies = async () => {
        setIsScanning(true);
        setScannerResults([]);

        try {
            /*
             * Small delay for scanner animation.
             */
            await new Promise(resolve =>
                setTimeout(resolve, 900)
            );

            /*
             * ----------------------------------------------------
             * MARKET ANALYSIS
             * ----------------------------------------------------
             *
             * Currently there are no live ticks.
             *
             * This will later become:
             *
             * analyzeMarket(liveTicks)
             *
             * when the Deriv WebSocket bridge is connected.
             */
            const analysis =
                analyzeMarket([]);

            setMarketAnalysis(analysis);

            /*
             * ----------------------------------------------------
             * SCORE ALL STRATEGIES
             * ----------------------------------------------------
             */
            const results: ScannerResult[] =
                AI_STRATEGIES.map(strategy => {
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
                    };
                });

            /*
             * Highest score first.
             */
            results.sort((a, b) => {
                if (
                    b.scannerScore !==
                    a.scannerScore
                ) {
                    return (
                        b.scannerScore -
                        a.scannerScore
                    );
                }

                /*
                 * If scores are equal,
                 * use market compatibility.
                 */
                if (
                    b.marketCompatibility !==
                    a.marketCompatibility
                ) {
                    return (
                        b.marketCompatibility -
                        a.marketCompatibility
                    );
                }

                /*
                 * Final deterministic ordering.
                 */
                return a.name.localeCompare(
                    b.name
                );
            });

            /*
             * Assign ranks.
             */
            const rankedResults =
                results.map(
                    (strategy, index) => ({
                        ...strategy,
                        rank: index + 1,
                    })
                );

            /*
             * ----------------------------------------------------
             * INITIALIZE EDITABLE VALUES
             * ----------------------------------------------------
             */
            const initialStakeValues: Record<
                string,
                string
            > = {};

            const initialTargetValues: Record<
                string,
                string
            > = {};

            rankedResults.forEach(
                strategy => {
                    initialStakeValues[
                        strategy.id
                    ] = String(
                        strategy.stake
                    );

                    initialTargetValues[
                        strategy.id
                    ] = String(
                        strategy.profit
                    );
                }
            );

            setStakeValues(
                initialStakeValues
            );

            setTargetValues(
                initialTargetValues
            );

            setScannerResults(
                rankedResults
            );
        } catch (error) {
            console.error(
                'AI Scanner error:',
                error
            );
        } finally {
            setIsScanning(false);
        }
    };

    /**
     * ------------------------------------------------------------
     * UPDATE STAKE
     * ------------------------------------------------------------
     */
    const updateStake = (
        strategyId: string,
        value: string
    ) => {
        if (!/^\d*\.?\d*$/.test(value)) {
            return;
        }

        setStakeValues(previous => ({
            ...previous,
            [strategyId]: value,
        }));
    };

    /**
     * ------------------------------------------------------------
     * UPDATE TARGET
     * ------------------------------------------------------------
     */
    const updateTarget = (
        strategyId: string,
        value: string
    ) => {
        if (!/^\d*\.?\d*$/.test(value)) {
            return;
        }

        setTargetValues(previous => ({
            ...previous,
            [strategyId]: value,
        }));
    };

    /**
     * ------------------------------------------------------------
     * LOAD SELECTED STRATEGY
     * ------------------------------------------------------------
     *
     * IMPORTANT:
     *
     * This still ONLY loads the bot.
     *
     * It does NOT automatically press Run.
     */
    const loadStrategy = async (
        strategy: ScannerResult
    ) => {
        if (loadingStrategyId) {
            return;
        }

        const editedStake =
            parseFloat(
                stakeValues[strategy.id]
            );

        const editedTarget =
            parseFloat(
                targetValues[strategy.id]
            );

        /*
         * Validate stake.
         */
        if (
            !Number.isFinite(
                editedStake
            ) ||
            editedStake <= 0
        ) {
            console.error(
                'Invalid stake amount.'
            );

            return;
        }

        /*
         * Validate target.
         */
        if (
            !Number.isFinite(
                editedTarget
            ) ||
            editedTarget <= 0
        ) {
            console.error(
                'Invalid target amount.'
            );

            return;
        }

        setLoadingStrategyId(
            strategy.id
        );

        try {
            /*
             * Select existing Quick Strategy engine.
             */
            quick_strategy.setSelectedStrategy(
                strategy.engine
            );

            /*
             * Load configuration into
             * existing Quick Strategy.
             *
             * DO NOT RUN.
             */
            await quick_strategy.onSubmit({
                symbol: strategy.symbol,

                tradetype:
                    strategy.tradetype,

                type: strategy.type,

                stake: editedStake,

                durationtype:
                    strategy.durationtype,

                duration:
                    strategy.duration,

                profit: editedTarget,

                loss: strategy.loss,

                size: strategy.size,

                unit: strategy.unit,

                action: 'LOAD',
            });

            /*
             * Close scanner after successful load.
             */
            setIsOpen(false);

            setScannerResults([]);

            setStakeValues({});

            setTargetValues({});
        } catch (error) {
            console.error(
                'Failed to load AI strategy:',
                error
            );
        } finally {
            setLoadingStrategyId(
                null
            );
        }
    };

    /**
     * ------------------------------------------------------------
     * CLOSE SCANNER
     * ------------------------------------------------------------
     */
    const closeScanner = () => {
        setIsOpen(false);

        setScannerResults([]);

        setLoadingStrategyId(null);

        setStakeValues({});

        setTargetValues({});
    };

    return (
        <>
            {/* ================================================== */}
            {/* FLOATING AI BUTTON */}
            {/* ================================================== */}

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

            {/* ================================================== */}
            {/* AI SCANNER */}
            {/* ================================================== */}

            {isOpen && (
                <div className="floating-ai-panel">

                    {/* ================================================== */}
                    {/* HEADER */}
                    {/* ================================================== */}

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

                    {/* ================================================== */}
                    {/* CONTENT */}
                    {/* ================================================== */}

                    <div className="floating-ai-content">

                        {/* ================================================== */}
                        {/* INITIAL SCANNER */}
                        {/* ================================================== */}

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
                                            and rank
                                            them
                                            using
                                            strategy
                                            compatibility
                                            and market
                                            analysis.
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
                                    >
                                        ✦ Scan 30
                                        Strategies
                                    </button>
                                </>
                            )}

                        {/* ================================================== */}
                        {/* SCANNING */}
                        {/* ================================================== */}

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
                                    strategy
                                    profiles.
                                </p>

                                <div className="scanning-progress">
                                    <div className="scanning-progress-bar" />
                                </div>
                            </div>
                        )}

                        {/* ================================================== */}
                        {/* RESULTS */}
                        {/* ================================================== */}

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
                                                by
                                                scanner
                                                score.
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

                                    {/* ================================================== */}
                                    {/* MARKET STATUS */}
                                    {/* ================================================== */}

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

                                    {/* ================================================== */}
                                    {/* NO LIVE DATA NOTICE */}
                                    {/* ================================================== */}

                                    {marketAnalysis.state ===
                                        'INSUFFICIENT_DATA' && (
                                        <div className="scanner-data-notice">
                                            Waiting
                                            for live
                                            market
                                            ticks.
                                            Current
                                            ranking
                                            is based
                                            on
                                            strategy
                                            profiles
                                            only.
                                        </div>
                                    )}

                                    {/* ================================================== */}
                                    {/* STRATEGY LIST */}
                                    {/* ================================================== */}

                                    <div className="strategy-list">
                                        {scannerResults.map(
                                            strategy => (
                                                <div
                                                    key={
                                                        strategy.id
                                                    }
                                                    className={`strategy-card ${
                                                        strategy.rank ===
                                                        1
                                                            ? 'top-strategy'
                                                            : ''
                                                    }`}
                                                >

                                                    {/* RANK */}
                                                    <div className="strategy-card-top">
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

                                                        {strategy.rank ===
                                                            1 && (
                                                            <div className="best-badge">
                                                                BEST
                                                                MATCH
                                                            </div>
                                                        )}

                                                        <div
                                                            className={`risk-badge risk-${strategy.risk.toLowerCase()}`}
                                                        >
                                                            {
                                                                strategy.risk
                                                            }
                                                        </div>
                                                    </div>

                                                    {/* NAME */}
                                                    <div className="strategy-name">
                                                        {
                                                            strategy.name
                                                        }
                                                    </div>

                                                    {/* DESCRIPTION */}
                                                    <div className="strategy-description">
                                                        {
                                                            strategy.description
                                                        }
                                                    </div>

                                                    {/* SCORE */}
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

                                                    {/* MARKET COMPATIBILITY */}
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

                                                    {/* DETAILS */}
                                                    <div className="strategy-details">

                                                        {/* ENGINE */}
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

                                                        {/* MARKET */}
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

                                                        {/* DIRECTION */}
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

                                                        {/* STAKE */}
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
                                                                    aria-label={`Stake for ${strategy.name}`}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* DURATION */}
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

                                                        {/* TARGET */}
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
                                                                    aria-label={`Target for ${strategy.name}`}
                                                                />
                                                            </div>
                                                        </div>

                                                    </div>

                                                    {/* LOAD BOT */}
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
                                                                null &&
                                                            loadingStrategyId !==
                                                                strategy.id
                                                        }
                                                    >
                                                        {loadingStrategyId ===
                                                        strategy.id
                                                            ? 'Loading...'
                                                            : 'Load Bot'}
                                                    </button>
                                                </div>
                                            )
                                        )}
                                    </div>

                                    {/* RESCAN */}
                                    <button
                                        type="button"
                                        className="rescan-button"
                                        onClick={
                                            scanAllStrategies
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
