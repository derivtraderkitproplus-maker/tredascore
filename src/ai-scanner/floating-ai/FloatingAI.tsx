import React, { useState } from 'react';
import './FloatingAI.css';

const FloatingAI = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                className={`floating-ai-button ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
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
                            <strong>AI Scanner</strong>
                        </div>

                        <button
                            type="button"
                            className="ai-close"
                            onClick={() => setIsOpen(false)}
                        >
                            ×
                        </button>
                    </div>

                    <div className="floating-ai-content">
                        <h3>AI Trading Scanner</h3>

                        <p>
                            Scan the market for high-probability trading strategies.
                        </p>

                        <button
                            type="button"
                            className="scan-button"
                        >
                            Scan Best Market
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default FloatingAI;
