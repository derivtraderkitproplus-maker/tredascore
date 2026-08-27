import React, { useState } from 'react';
import { useStore } from '@/hooks/useStore';
import { AI_STRATEGIES, AIStrategy } from './strategies';
import './FloatingAI.css';

type ScannerResult = AIStrategy & {
    scannerScore: number;
    rank: number;
};

const FloatingAI = () => {
    const { quick_strategy } = useStore();

    const [isOpen, setIsOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scannerResults, setScannerResults] = useState<ScannerResult[]>([]);
    const [loadingStrategyId, setLoadingStrategyId] = useState<string | null>(
        null
    );

    /**
     * ------------------------------------------------------------
     * CALCULATE SCANNER SCORE
     * ------------------------------------------------------------
     *
     * IMPORTANT:
     *
     * This is a profile/scanner score.
     * It is NOT a guaranteed win rate and does not predict profit.
     *
     * Later this function can be connected to live Deriv market
     * data and historical performance data.
     */
    const calculateScannerScore = (strategy: AIStrategy): number => {
        let score = 70;

        // Risk profile contribution
        if (strategy.risk === 'LOW') {
            score += 8;
        } else if (strategy.risk === 'MEDIUM') {
            score += 5;
        } else {
            score += 2;
        }

        // Controlled profit/loss configuration
        if (strategy.profit > 0 && strategy.loss > 0) {
            const ratio = strategy.profit / strategy.loss;

            if (ratio >= 1) {
                score += 5;
            } else {
                score += 2;
            }
        }

        // Prefer shorter-duration profiles for the initial scanner
        if (strategy.duration <= 1) {
            score += 4;
        }

        // Existing engines supported by the Quick Strategy system
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

        // Keep score inside a clean percentage-style range.
        return Math.min(99, Math.max(50, score));
    };

    /**
     * ------------------------------------------------------------
     * SCAN ALL 30 STRATEGIES
     * ------------------------------------------------------------
     */
    const scanAllStrategies = async () => {
        setIsScanning(true);
        setScannerResults([]);

        try {
            // Small delay gives the scanner animation a real scanning feel.
            await new Promise(resolve => setTimeout(resolve, 900));

            const results: ScannerResult[] = AI_STRATEGIES.map(strategy => ({
                ...strategy,
                scannerScore: calculateScannerScore(strategy),
                rank: 0,
            }));

            // Highest scanner score first.
            results.sort((a, b) => {
                if (b.scannerScore !== a.scannerScore) {
                    return b.scannerScore - a.scannerScore;
                }

                // Secondary ordering keeps results deterministic.
                return a.name.localeCompare(b.name);
            });

            // Assign ranks after sorting.
            const rankedResults = results.map((strategy, index) => ({
                ...strategy,
                rank: index + 1,
            }));

            setScannerResults(rankedResults);
        } catch (error) {
            console.error('AI Scanner error:', error);
        } finally {
            setIsScanning(false);
        }
    };

    /**
     * ------------------------------------------------------------
     * LOAD SELECTED STRATEGY
     * ------------------------------------------------------------
     *
     * This uses the EXISTING Quick Strategy system.
     *
     * It loads the bot configuration but does NOT press Run.
     */
    const loadStrategy = async (strategy: ScannerResult) => {
        if (loadingStrategyId) return;

        setLoadingStrategyId(strategy.id);

        try {
            /*
             * Select the existing Quick Strategy engine.
             */
            quick_strategy.setSelectedStrategy(strategy.engine);

            /*
             * Send the strategy configuration to the existing
             * Quick Strategy store.
             *
             * action = LOAD means:
             *
             * Load configuration
             * DO NOT automatically start trading
             */
            await quick_strategy.onSubmit({
                symbol: strategy.symbol,
                tradetype: strategy.tradetype,
                type: strategy.type,

                stake: strategy.stake,
                durationtype: strategy.durationtype,
                duration: strategy.duration,

                profit: strategy.profit,
                loss: strategy.loss,

                size: strategy.size,
                unit: strategy.unit,

                action: 'LOAD',
            });

            /*
             * Close scanner after successful loading.
             */
            setIsOpen(false);
            setScannerResults([]);
        } catch (error) {
            console.error(
                'Failed to load AI strategy:',
                error
            );
        } finally {
            setLoadingStrategyId(null);
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
    };

    return (
        <>
            {/* ================================================== */}
            {/* FLOATING AI BUTTON */}
            {/* ================================================== */}

            <button
                type="button"
                className={`floating-ai-button ${
                    isOpen ? 'active' : ''
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

                <span className="ai-core">✦</span>
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
                            onClick={closeScanner}
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

                        {scannerResults.length === 0 && !isScanning && (
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
                                            {AI_STRATEGIES.length}
                                        </strong>{' '}
                                        available strategy profiles
                                        and rank them from strongest
                                        scanner score to lowest.
                                    </p>
                                </div>

                                <div className="strategy-count">
                                    <strong>
                                        {AI_STRATEGIES.length}
                                    </strong>

                                    <span>
                                        AI strategies available
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    className="scan-button"
                                    onClick={scanAllStrategies}
                                >
                                    ✦ Scan 30 Strategies
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
                                    Scanning Strategies...
                                </h3>

                                <p>
                                    Analyzing all{' '}
                                    {AI_STRATEGIES.length}{' '}
                                    strategy profiles.
                                </p>

                                <div className="scanning-progress">
                                    <div className="scanning-progress-bar" />
                                </div>
                            </div>
                        )}

                        {/* ================================================== */}
                        {/* 30 STRATEGY RESULTS */}
                        {/* ================================================== */}

                        {scannerResults.length > 0 && !isScanning && (
                            <>
                                <div className="scanner-heading">
                                    <div>
                                        <h3>
                                            Scanner Results
                                        </h3>

                                        <p>
                                            {scannerResults.length}{' '}
                                            strategies ranked by
                                            scanner score.
                                        </p>
                                    </div>

                                    <div className="result-count">
                                        {scannerResults.length}/
                                        {AI_STRATEGIES.length}
                                    </div>
                                </div>

                                {/* ================================================== */}
                                {/* SCROLLABLE STRATEGY LIST */}
                                {/* ================================================== */}

                                <div className="strategy-list">
                                    {scannerResults.map(strategy => (
                                        <div
                                            key={strategy.id}
                                            className={`strategy-card ${
                                                strategy.rank === 1
                                                    ? 'top-strategy'
                                                    : ''
                                            }`}
                                        >
                                            {/* RANK */}
                                            <div className="strategy-card-top">
                                                <div
                                                    className={`strategy-rank ${
                                                        strategy.rank === 1
                                                            ? 'rank-one'
                                                            : ''
                                                    }`}
                                                >
                                                    #
                                                    {strategy.rank}
                                                </div>

                                                {strategy.rank === 1 && (
                                                    <div className="best-badge">
                                                        BEST MATCH
                                                    </div>
                                                )}

                                                <div
                                                    className={`risk-badge risk-${strategy.risk.toLowerCase()}`}
                                                >
                                                    {strategy.risk}
                                                </div>
                                            </div>

                                            {/* NAME */}
                                            <div className="strategy-name">
                                                {strategy.name}
                                            </div>

                                            {/* DESCRIPTION */}
                                            <div className="strategy-description">
                                                {strategy.description}
                                            </div>

                                            {/* SCORE */}
                                            <div className="scanner-score">
                                                <div className="score-info">
                                                    <span>
                                                        Scanner Score
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

                                            {/* DETAILS */}
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

                                                <div className="strategy-detail">
                                                    <span>
                                                        Stake
                                                    </span>

                                                    <strong>
                                                        $
                                                        {
                                                            strategy.stake
                                                        }
                                                    </strong>
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

                                                <div className="strategy-detail">
                                                    <span>
                                                        Target
                                                    </span>

                                                    <strong>
                                                        $
                                                        {
                                                            strategy.profit
                                                        }
                                                    </strong>
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
                                    ))}
                                </div>

                                {/* ================================================== */}
                                {/* RESCAN */}
                                {/* ================================================== */}

                                <button
                                    type="button"
                                    className="rescan-button"
                                    onClick={scanAllStrategies}
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
