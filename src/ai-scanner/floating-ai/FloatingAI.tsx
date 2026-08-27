import React, { useState } from 'react';
import { useStore } from '@/hooks/useStore';
import { AI_STRATEGIES, AIStrategy } from './strategies';
import './FloatingAI.css';

const FloatingAI = () => {
    const { quick_strategy } = useStore();

    const [isOpen, setIsOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scannerResult, setScannerResult] = useState<any>(null);
    const [selectedStrategyId, setSelectedStrategyId] = useState(
        AI_STRATEGIES[0]?.id ?? ''
    );

    /**
     * ------------------------------------------------------------
     * SELECT STRATEGY PROFILE
     * ------------------------------------------------------------
     *
     * The AI library contains 30 profiles.
     *
     * Each profile points to an existing Quick Strategy engine.
     *
     * Example:
     *
     * AI Dollar Flow
     *       ↓
     * MARTINGALE
     *       ↓
     * Existing Quick Strategy
     *       ↓
     * Blockly
     */

    const selectStrategy = (strategyId: string) => {
        setSelectedStrategyId(strategyId);
        setScannerResult(null);
    };

    /**
     * ------------------------------------------------------------
     * AI SCANNER
     * ------------------------------------------------------------
     *
     * IMPORTANT:
     *
     * This currently selects a strategy PROFILE from the
     * 30-strategy library.
     *
     * It does NOT claim to predict the market or guarantee
     * profitability.
     *
     * Later we can replace the selection logic with the real
     * Deriv WebSocket market scanner.
     */

    const scanBestMarket = async () => {
        setIsScanning(true);
        setScannerResult(null);

        try {
            /*
             * Find the selected AI profile.
             */
            const selectedProfile: AIStrategy | undefined =
                AI_STRATEGIES.find(
                    strategy => strategy.id === selectedStrategyId
                );

            if (!selectedProfile) {
                throw new Error('Selected AI strategy was not found.');
            }

            /*
             * Build the result using the strategy profile.
             *
             * IMPORTANT:
             *
             * strategy = ENGINE
             *
             * strategyId = AI PROFILE ID
             *
             * strategyName = USER-FACING NAME
             */
            const result = {
                strategy: selectedProfile.engine,

                strategyId: selectedProfile.id,
                strategyName: selectedProfile.name,
                description: selectedProfile.description,
                risk: selectedProfile.risk,

                symbol: selectedProfile.symbol,
                tradetype: selectedProfile.tradetype,
                type: selectedProfile.type,

                stake: selectedProfile.stake,
                durationtype: selectedProfile.durationtype,
                duration: selectedProfile.duration,

                profit: selectedProfile.profit,
                loss: selectedProfile.loss,

                size: selectedProfile.size,
                unit: selectedProfile.unit,

                action: 'LOAD',
            };

            setScannerResult(result);
        } catch (error) {
            console.error('AI Scanner error:', error);
        } finally {
            setIsScanning(false);
        }
    };

    /**
     * ------------------------------------------------------------
     * LOAD SCANNER RESULT
     * ------------------------------------------------------------
     *
     * This sends the selected PROFILE into the existing
     * Quick Strategy system.
     *
     * It DOES NOT press the Run button.
     */

    const loadScannerResult = async () => {
        if (!scannerResult) return;

        try {
            /*
             * scannerResult.strategy contains the existing
             * Quick Strategy engine name.
             *
             * Example:
             *
             * AI Dollar Flow
             *      ↓
             * MARTINGALE
             */
            quick_strategy.setSelectedStrategy(
                scannerResult.strategy
            );

            /*
             * Send all configuration values to the existing
             * Quick Strategy store.
             *
             * action = LOAD
             *
             * Therefore this should load the bot configuration
             * without automatically starting the bot.
             */
            await quick_strategy.onSubmit({
                symbol: scannerResult.symbol,
                tradetype: scannerResult.tradetype,
                type: scannerResult.type,

                stake: scannerResult.stake,
                durationtype: scannerResult.durationtype,
                duration: scannerResult.duration,

                profit: scannerResult.profit,
                loss: scannerResult.loss,

                size: scannerResult.size,
                unit: scannerResult.unit,

                action: 'LOAD',
            });

            /*
             * Close AI panel after successful loading.
             */
            setIsOpen(false);
            setScannerResult(null);
        } catch (error) {
            console.error(
                'Failed to load scanner result:',
                error
            );
        }
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
                onClick={() => setIsOpen(prev => !prev)}
                aria-label="Open AI Scanner"
            >
                <span className="ai-ring ring-one" />
                <span className="ai-ring ring-two" />
                <span className="ai-ring ring-three" />

                <span className="ai-core">✦</span>
            </button>

            {/* ================================================== */}
            {/* AI SCANNER PANEL */}
            {/* ================================================== */}

            {isOpen && (
                <div className="floating-ai-panel">

                    {/* HEADER */}
                    <div className="floating-ai-header">
                        <div>
                            <span className="ai-status-dot" />

                            <strong>
                                AI Scanner
                            </strong>
                        </div>

                        <button
                            type="button"
                            className="ai-close"
                            onClick={() => {
                                setIsOpen(false);
                                setScannerResult(null);
                            }}
                            aria-label="Close AI Scanner"
                        >
                            ×
                        </button>
                    </div>

                    {/* CONTENT */}
                    <div className="floating-ai-content">

                        {!scannerResult ? (
                            <>
                                <h3>
                                    AI Trading Scanner
                                </h3>

                                <p>
                                    Select one of the available
                                    strategy profiles, then load it
                                    into the existing bot builder.
                                </p>

                                {/* ================================================== */}
                                {/* STRATEGY SELECTOR */}
                                {/* ================================================== */}

                                <label
                                    htmlFor="ai-strategy-select"
                                    style={{
                                        display: 'block',
                                        marginBottom: '8px',
                                    }}
                                >
                                    Strategy
                                </label>

                                <select
                                    id="ai-strategy-select"
                                    value={selectedStrategyId}
                                    onChange={event =>
                                        selectStrategy(
                                            event.target.value
                                        )
                                    }
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        marginBottom: '12px',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                    }}
                                >
                                    {AI_STRATEGIES.map(
                                        strategy => (
                                            <option
                                                key={strategy.id}
                                                value={strategy.id}
                                            >
                                                {strategy.name}
                                            </option>
                                        )
                                    )}
                                </select>

                                {/* ================================================== */}
                                {/* STRATEGY COUNT */}
                                {/* ================================================== */}

                                <div
                                    style={{
                                        fontSize: '12px',
                                        opacity: 0.7,
                                        marginBottom: '12px',
                                    }}
                                >
                                    {AI_STRATEGIES.length} strategy
                                    profiles available
                                </div>

                                {/* ================================================== */}
                                {/* SCAN BUTTON */}
                                {/* ================================================== */}

                                <button
                                    type="button"
                                    className="scan-button"
                                    onClick={scanBestMarket}
                                    disabled={isScanning}
                                >
                                    {isScanning
                                        ? 'Scanning...'
                                        : 'Scan Best Market'}
                                </button>
                            </>
                        ) : (
                            <>
                                <h3>
                                    Scanner Result
                                </h3>

                                <p>
                                    Strategy profile selected.
                                </p>

                                {/* ================================================== */}
                                {/* RESULT */}
                                {/* ================================================== */}

                                <div className="scanner-result">

                                    <div className="scanner-result-row">
                                        <span>
                                            Strategy
                                        </span>

                                        <strong>
                                            {
                                                scannerResult.strategyName
                                            }
                                        </strong>
                                    </div>

                                    <div className="scanner-result-row">
                                        <span>
                                            Engine
                                        </span>

                                        <strong>
                                            {
                                                scannerResult.strategy
                                            }
                                        </strong>
                                    </div>

                                    <div className="scanner-result-row">
                                        <span>
                                            Market
                                        </span>

                                        <strong>
                                            {
                                                scannerResult.symbol
                                            }
                                        </strong>
                                    </div>

                                    <div className="scanner-result-row">
                                        <span>
                                            Direction
                                        </span>

                                        <strong>
                                            {
                                                scannerResult.type ||
                                                'Default'
                                            }
                                        </strong>
                                    </div>

                                    <div className="scanner-result-row">
                                        <span>
                                            Stake
                                        </span>

                                        <strong>
                                            $
                                            {
                                                scannerResult.stake
                                            }
                                        </strong>
                                    </div>

                                    <div className="scanner-result-row">
                                        <span>
                                            Duration
                                        </span>

                                        <strong>
                                            {
                                                scannerResult.duration
                                            }{' '}
                                            {scannerResult.duration ===
                                            1
                                                ? 'tick'
                                                : 'ticks'}
                                        </strong>
                                    </div>

                                    <div className="scanner-result-row">
                                        <span>
                                            Risk
                                        </span>

                                        <strong>
                                            {
                                                scannerResult.risk
                                            }
                                        </strong>
                                    </div>

                                </div>

                                {/* ================================================== */}
                                {/* LOAD BOT */}
                                {/* ================================================== */}

                                <button
                                    type="button"
                                    className="scan-button"
                                    onClick={
                                        loadScannerResult
                                    }
                                >
                                    Load Bot
                                </button>

                                {/* ================================================== */}
                                {/* BACK */}
                                {/* ================================================== */}

                                <button
                                    type="button"
                                    onClick={() =>
                                        setScannerResult(
                                            null
                                        )
                                    }
                                    style={{
                                        width: '100%',
                                        marginTop: '8px',
                                        padding: '10px',
                                    }}
                                >
                                    Choose Another Strategy
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
