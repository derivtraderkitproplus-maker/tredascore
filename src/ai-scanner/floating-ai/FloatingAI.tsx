import React, { useState } from 'react';
import { useStore } from '@/hooks/useStore';
import './FloatingAI.css';

const FloatingAI = () => {
    const { quick_strategy } = useStore();

    const [isOpen, setIsOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scannerResult, setScannerResult] = useState<any>(null);

    /**
     * SCANNER
     *
     * This is the connection point for the real AI scanner.
     * For now it produces a test result so we can verify that:
     *
     * AI Scanner
     *     ↓
     * Scanner Result
     *     ↓
     * Load Scanner Result
     *     ↓
     * Quick Strategy
     *     ↓
     * Blockly
     *     ↓
     * Existing Run button
     */
    const scanBestMarket = async () => {
        setIsScanning(true);
        setScannerResult(null);

        try {
            /*
             * TEMPORARY TEST RESULT
             *
             * We will replace ONLY this section with
             * your real 21-strategy scanner later.
             */
            const result = {
                strategy: 'MARTINGALE',

                symbol: '1HZ100V',
                tradetype: 'risefall',
                type: 'CALL',

                stake: 1,
                durationtype: 't',
                duration: 1,

                profit: 10,
                loss: 10,

                size: 2,

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
     * LOAD THE SCANNER RESULT INTO THE EXISTING
     * QUICK STRATEGY SYSTEM.
     *
     * IMPORTANT:
     * This does NOT execute a trade.
     *
     * It loads the generated strategy into Blockly.
     * The user's normal RUN button remains responsible
     * for starting the bot.
     */
    const loadScannerResult = async () => {
        if (!scannerResult) return;

        try {
            /*
             * Tell QuickStrategyStore which strategy
             * the scanner selected.
             */
            quick_strategy.setSelectedStrategy(scannerResult.strategy);

            /*
             * Send the scanner result through the existing
             * QuickStrategyStore.
             *
             * action = LOAD
             *
             * Therefore QuickStrategyStore will load the
             * Blockly XML but will NOT call:
             *
             * run_panel.onRunButtonClick()
             */
            await quick_strategy.onSubmit({
                ...scannerResult,
                action: 'LOAD',
            });

            /*
             * Close the AI panel after the bot has been loaded.
             */
            setIsOpen(false);
            setScannerResult(null);
        } catch (error) {
            console.error('Failed to load scanner result:', error);
        }
    };

    return (
        <>
            {/* FLOATING AI BUTTON */}
            <button
                type="button"
                className={`floating-ai-button ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(prev => !prev)}
                aria-label="Open AI Scanner"
            >
                <span className="ai-ring ring-one" />
                <span className="ai-ring ring-two" />
                <span className="ai-ring ring-three" />

                <span className="ai-core">✦</span>
            </button>

            {/* AI SCANNER PANEL */}
            {isOpen && (
                <div className="floating-ai-panel">
                    {/* HEADER */}
                    <div className="floating-ai-header">
                        <div>
                            <span className="ai-status-dot" />
                            <strong>AI Scanner</strong>
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
                                <h3>AI Trading Scanner</h3>

                                <p>
                                    Scan the market for high-probability
                                    trading strategies.
                                </p>

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
                                <h3>Scanner Result</h3>

                                <p>
                                    The scanner has selected a strategy and
                                    market.
                                </p>

                                <div className="scanner-result">
                                    <div className="scanner-result-row">
                                        <span>Market</span>
                                        <strong>
                                            {scannerResult.symbol}
                                        </strong>
                                    </div>

                                    <div className="scanner-result-row">
                                        <span>Strategy</span>
                                        <strong>
                                            {scannerResult.strategy}
                                        </strong>
                                    </div>

                                    <div className="scanner-result-row">
                                        <span>Direction</span>
                                        <strong>
                                            {scannerResult.type}
                                        </strong>
                                    </div>

                                    <div className="scanner-result-row">
                                        <span>Stake</span>
                                        <strong>
                                            ${scannerResult.stake}
                                        </strong>
                                    </div>

                                    <div className="scanner-result-row">
                                        <span>Duration</span>
                                        <strong>
                                            {scannerResult.duration}{' '}
                                            {scannerResult.duration === 1
                                                ? 'tick'
                                                : 'ticks'}
                                        </strong>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="scan-button"
                                    onClick={loadScannerResult}
                                >
                                    Load Scanner Result
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
