import React, { useEffect, useState } from 'react';
import './RiskDisclaimer.css';

const RiskDisclaimer = () => {
    const [isOpen, setIsOpen] = useState(false);

    /**
     * ------------------------------------------------------------
     * PREVENT BACKGROUND SCROLLING
     * ------------------------------------------------------------
     */
    useEffect(() => {
        if (!isOpen) return;

        const originalOverflow = document.body.style.overflow;

        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    /**
     * ------------------------------------------------------------
     * ESCAPE KEY
     * ------------------------------------------------------------
     */
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    /**
     * ------------------------------------------------------------
     * OPEN DISCLAIMER
     * ------------------------------------------------------------
     */
    const openDisclaimer = () => {
        setIsOpen(true);
    };

    /**
     * ------------------------------------------------------------
     * CLOSE DISCLAIMER
     * ------------------------------------------------------------
     */
    const closeDisclaimer = () => {
        setIsOpen(false);
    };

    /**
     * ------------------------------------------------------------
     * CLOSE WHEN CLICKING OUTSIDE MODAL
     * ------------------------------------------------------------
     */
    const handleOverlayClick = (
        event: React.MouseEvent<HTMLDivElement>
    ) => {
        if (event.target === event.currentTarget) {
            closeDisclaimer();
        }
    };

    return (
        <>
            {/* ================================================== */}
            {/* RISK DISCLAIMER BUTTON */}
            {/* ================================================== */}

            <button
                type="button"
                className="risk-disclaimer-button"
                onClick={openDisclaimer}
                aria-label="Open Risk Disclaimer"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
            >
                <span
                    className="risk-disclaimer-icon"
                    aria-hidden="true"
                >
                    ⚠
                </span>

                <span className="risk-disclaimer-button-text">
                    Risk Disclaimer
                </span>
            </button>

            {/* ================================================== */}
            {/* RISK DISCLAIMER MODAL */}
            {/* ================================================== */}

            {isOpen && (
                <div
                    className="risk-disclaimer-overlay"
                    onClick={handleOverlayClick}
                    role="presentation"
                >
                    <div
                        className="risk-disclaimer-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="risk-disclaimer-title"
                    >
                        {/* ================================================== */}
                        {/* HEADER */}
                        {/* ================================================== */}

                        <div className="risk-disclaimer-header">
                            <div className="risk-disclaimer-title-wrapper">
                                <div
                                    className="risk-disclaimer-warning-icon"
                                    aria-hidden="true"
                                >
                                    ⚠
                                </div>

                                <h2 id="risk-disclaimer-title">
                                    Risk Disclaimer
                                </h2>
                            </div>

                            <button
                                type="button"
                                className="risk-disclaimer-close"
                                onClick={closeDisclaimer}
                                aria-label="Close Risk Disclaimer"
                            >
                                ×
                            </button>
                        </div>

                        {/* ================================================== */}
                        {/* CONTENT */}
                        {/* ================================================== */}

                        <div className="risk-disclaimer-content">

                            {/* MAIN WARNING */}
                            <div className="risk-disclaimer-alert">
                                <span
                                    className="risk-disclaimer-alert-icon"
                                    aria-hidden="true"
                                >
                                    ⚠
                                </span>

                                <strong>
                                    Trading involves significant risk.
                                </strong>
                            </div>

                            {/* INTRODUCTION */}
                            <p>
                                The products offered through Deriv
                                include complex derivatives and carry
                                significant risks. You should understand
                                how the products work before trading.
                            </p>

                            {/* LOSS WARNING */}
                            <p>
                                You may lose all the money you invest.
                                Never trade with money you cannot afford
                                to lose.
                            </p>

                            {/* LEVERAGE */}
                            <p>
                                CFDs are complex financial instruments
                                with a high risk of losing money rapidly
                                due to leverage. Leverage can amplify
                                both gains and losses.
                            </p>

                            {/* INDEPENDENT DECISION */}
                            <p>
                                Trading decisions are your responsibility.
                                You should carefully consider your
                                financial circumstances, experience and
                                risk tolerance before trading.
                            </p>

                            {/* PAST PERFORMANCE */}
                            <p>
                                Past performance is not a guarantee of
                                future results and should not be relied
                                upon as an indication of future
                                performance.
                            </p>

                            {/* ================================================== */}
                            {/* IMPORTANT NOTICE */}
                            {/* ================================================== */}

                            <div className="risk-disclaimer-important">
                                <div className="risk-disclaimer-important-title">
                                    Important
                                </div>

                                <p>
                                    Do not trade with borrowed money or
                                    money that you need for essential
                                    expenses. Make sure you understand
                                    the risks before entering a trade.
                                </p>
                            </div>

                            {/* ================================================== */}
                            {/* THIRD-PARTY NOTICE */}
                            {/* ================================================== */}

                            <div className="risk-disclaimer-third-party">
                                <p>
                                    This website is an independent
                                    third-party platform. Trading
                                    availability, products and services
                                    may depend on the applicable
                                    underlying provider and your account
                                    eligibility.
                                </p>
                            </div>

                            {/* ================================================== */}
                            {/* ACTIONS */}
                            {/* ================================================== */}

                            <div className="risk-disclaimer-actions">

                                <a
                                    href="https://deriv.com/terms-and-conditions/risk-disclosure"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="risk-disclaimer-read-more"
                                >
                                    Read Full Risk Disclosure
                                </a>

                                <button
                                    type="button"
                                    className="risk-disclaimer-close-button"
                                    onClick={closeDisclaimer}
                                >
                                    Close
                                </button>

                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default RiskDisclaimer;
