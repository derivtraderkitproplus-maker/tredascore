import React, { useEffect, useState } from 'react';
import './RiskDisclaimer.css';

const RiskDisclaimer = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [shouldRender, setShouldRender] = useState(true);

    useEffect(() => {
        const checkActivePanels = () => {
            // 1. Target your exact tab container element at the top of the screen
            const activeTabElement = document.querySelector('.active, [aria-selected="true"], .nav-link-active, .tab-active');
            
            // 2. Fallback check: Look only for the exact standalone tab headers, not raw page table logs
            const headers = Array.from(document.querySelectorAll('button, a, div'));
            const isViewingUnwantedTab = headers.some(el => {
                const text = el.textContent?.trim();
                // Ensure we only match the precise tab names exactly
                return text === 'Summary' || text === 'Transactions' || text === 'Journal';
            });

            // 3. Look for your specific layout data grids
            const hasDataGrid = document.querySelector('.summary-container, .transactions-table, .journal-panel');

            // If an unwanted active view panel matches, hide the button safely
            if (hasDataGrid || (isViewingUnwantedTab && !document.body.innerText.includes('Bot Builder'))) {
                setShouldRender(false);
            } else {
                setShouldRender(true);
            }
        };

        checkActivePanels();

        // Safe mutation tree tracking to toggle visibility instantly on click transitions
        const observer = new MutationObserver(checkActivePanels);
        observer.observe(document.body, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, []);

    useEffect(() => {  
        if (!isOpen) return;  

        const originalOverflow = document.body.style.overflow;  
        document.body.style.overflow = 'hidden';  

        return () => {  
            document.body.style.overflow = originalOverflow;  
        };  
    }, [isOpen]);  

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

    const handleOverlayClick = (  
        event: React.MouseEvent<HTMLDivElement>  
    ) => {  
        if (event.target === event.currentTarget) {  
            setIsOpen(false);  
        }  
    };  

    if (!shouldRender) return null;  

    return (  
        <div className="risk-disclaimer">  
            {/* FLOATING BUTTON */}  
            <button  
                type="button"  
                className="risk-disclaimer-button"  
                onClick={() => setIsOpen(true)}  
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

            {/* COMPACT MODAL */}  
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
                        {/* HEADER */}  
                        <div className="risk-disclaimer-header">  
                            <div className="risk-disclaimer-title-wrapper">  
                                <span  
                                    className="risk-disclaimer-warning-icon"  
                                    aria-hidden="true"  
                                >  
                                    ⚠  
                                </span>  

                                <h2 id="risk-disclaimer-title">  
                                    Risk Disclaimer  
                                </h2>  
                            </div>  

                            <button  
                                type="button"  
                                className="risk-disclaimer-close"  
                                onClick={() => setIsOpen(false)}  
                                aria-label="Close Risk Disclaimer"  
                            >  
                                ×  
                            </button>  
                        </div>  

                        {/* CONTENT */}  
                        <div className="risk-disclaimer-content">  
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

                            <p>  
                                You may lose all the money you invest.  
                                Never trade with money you cannot afford  
                                to lose.  
                            </p>  

                            <div className="risk-disclaimer-points">  
                                <div className="risk-disclaimer-point">  
                                    <strong>Losses</strong>  
                                    <span>  
                                        Only trade money you can afford to lose.  
                                    </span>  
                                </div>  

                                <div className="risk-disclaimer-point">  
                                    <strong>Leverage</strong>  
                                    <span>  
                                        Leverage can increase both gains and losses.  
                                    </span>  
                                </div>  

                                <div className="risk-disclaimer-point">  
                                    <strong>Responsibility</strong>  
                                    <span>  
                                        Make sure you understand the product  
                                        and risks before trading.  
                                    </span>  
                                </div>  
                            </div>  

                            <p className="risk-disclaimer-note">  
                                Past performance does not guarantee future  
                                results.  
                            </p>  
                        </div>  

                        {/* FOOTER */}  
                        <div className="risk-disclaimer-footer">  
                            <a  
                                href="https://deriv.com"  
                                target="_blank"  
                                rel="noopener noreferrer"  
                                className="risk-disclaimer-read-more"  
                            >  
                                Read Full Risk Disclosure  
                            </a>  

                            <button  
                                type="button"  
                                className="risk-disclaimer-understand"  
                                onClick={() => setIsOpen(false)}  
                            >  
                                I Understand  
                            </button>  
                        </div>  
                    </div>  
                </div>  
            )}  
        </div>  
    );
};

export default RiskDisclaimer;
