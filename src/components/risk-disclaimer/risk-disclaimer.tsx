/* ============================================================
   RISK DISCLAIMER
   Full-width navy strip above the Run panel
   ============================================================ */

.risk-disclaimer {
    position: fixed;

    left: 0;
    right: 0;
    bottom: 68px;

    width: 100%;
    height: 68px;

    margin: 0;
    padding: 0;

    background: var(--general-main-1) !important;
    background-color: var(--general-main-1) !important;
    background-image: none !important;

    border: 0 !important;
    box-shadow: none !important;

    box-sizing: border-box;

    z-index: 9998;

    pointer-events: none;
}


/* ============================================================
   FLOATING RISK DISCLAIMER BUTTON
   ============================================================ */

.risk-disclaimer-button {
    position: absolute;

    left: 22px;
    bottom: 11px;

    width: 118px;
    height: 26px;

    padding: 0 7px;
    margin: 0;

    border: 0;
    border-radius: 5px;

    background: #f5c400 !important;
    color: #111111;

    font-family: inherit;
    font-size: 8px;
    font-weight: 600;
    line-height: 1;

    display: flex;
    align-items: center;
    justify-content: center;

    gap: 4px;

    box-sizing: border-box;

    cursor: pointer;

    z-index: 10000;

    pointer-events: auto;

    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);

    transition:
        opacity 0.2s ease,
        transform 0.1s ease;
}

.risk-disclaimer-button:hover {
    opacity: 0.92;
}

.risk-disclaimer-button:active {
    transform: scale(0.98);
}


/* ============================================================
   BUTTON ICON
   ============================================================ */

.risk-disclaimer-icon {
    display: inline-flex;

    align-items: center;
    justify-content: center;

    margin: 0;
    padding: 0;

    font-size: 10px;
    line-height: 1;

    flex: 0 0 auto;
}


/* ============================================================
   BUTTON TEXT
   ============================================================ */

.risk-disclaimer-button-text {
    display: inline-block;

    margin: 0;
    padding: 0;

    white-space: nowrap;
}


/* ============================================================
   MODAL OVERLAY
   ============================================================ */

.risk-disclaimer-overlay {
    position: fixed;

    inset: 0;

    z-index: 99999;

    background: rgba(0, 0, 0, 0.65);

    display: flex;

    align-items: center;
    justify-content: center;

    padding: 12px;

    box-sizing: border-box;

    overflow-y: auto;

    -webkit-overflow-scrolling: touch;

    pointer-events: auto;
}


/* ============================================================
   MODAL
   ============================================================ */

.risk-disclaimer-modal {
    position: relative;

    width: 100%;
    max-width: 520px;

    height: auto;

    min-height: 0;

    max-height: calc(100vh - 24px);
    max-height: calc(100dvh - 24px);

    margin: auto;

    padding: 0;

    background: #181a1f;
    color: #ffffff;

    border: 1px solid rgba(255, 255, 255, 0.12);

    border-radius: 12px;

    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);

    box-sizing: border-box;

    display: flex;
    flex-direction: column;

    overflow: hidden;

    flex: 0 1 auto;
}


/* ============================================================
   HEADER
   ============================================================ */

.risk-disclaimer-header {
    position: relative;

    width: 100%;

    min-height: 62px;

    padding: 14px 20px;

    margin: 0;

    display: flex;

    align-items: center;
    justify-content: space-between;

    gap: 12px;

    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    box-sizing: border-box;

    flex: 0 0 auto;
}


/* ============================================================
   TITLE WRAPPER
   ============================================================ */

.risk-disclaimer-title-wrapper {
    display: flex;

    align-items: center;

    gap: 10px;

    min-width: 0;

    flex: 1;
}


/* ============================================================
   TITLE
   ============================================================ */

.risk-disclaimer-title-wrapper h2 {
    display: block;

    margin: 0;
    padding: 0;

    color: #ffffff;

    font-size: 18px;
    font-weight: 700;

    line-height: 1.2;

    white-space: nowrap;
}


/* ============================================================
   WARNING ICON
   ============================================================ */

.risk-disclaimer-warning-icon {
    display: inline-flex;

    align-items: center;
    justify-content: center;

    margin: 0;
    padding: 0;

    font-size: 20px;

    line-height: 1;

    flex: 0 0 auto;
}


/* ============================================================
   CLOSE BUTTON
   ============================================================ */

.risk-disclaimer-close {
    display: flex;

    align-items: center;
    justify-content: center;

    width: 36px;
    height: 36px;

    min-width: 36px;

    margin: 0;
    padding: 0;

    border: 0;
    border-radius: 50%;

    background: transparent;
    color: #ffffff;

    font-family: inherit;

    font-size: 30px;
    font-weight: 400;

    line-height: 1;

    cursor: pointer;

    box-sizing: border-box;

    flex: 0 0 auto;
}

.risk-disclaimer-close:hover {
    background: rgba(255, 255, 255, 0.08);
}


/* ============================================================
   MAIN CONTENT
   ============================================================ */

.risk-disclaimer-content {
    width: 100%;

    margin: 0;

    padding: 18px 20px 20px;

    box-sizing: border-box;

    overflow-y: auto;
    overflow-x: hidden;

    flex: 1 1 auto;

    -webkit-overflow-scrolling: touch;
}


/* ============================================================
   WARNING / ALERT
   ============================================================ */

.risk-disclaimer-alert {
    width: 100%;

    min-height: 54px;

    margin: 0 0 18px;

    padding: 13px 14px;

    display: flex;

    align-items: center;

    gap: 10px;

    border-radius: 8px;

    background: rgba(245, 196, 0, 0.12);

    border: 1px solid rgba(245, 196, 0, 0.3);

    color: #ffffff;

    box-sizing: border-box;
}


/* ============================================================
   ALERT ICON
   ============================================================ */

.risk-disclaimer-alert-icon {
    display: inline-flex;

    align-items: center;
    justify-content: center;

    margin: 0;
    padding: 0;

    font-size: 18px;

    line-height: 1;

    flex: 0 0 auto;
}


/* ============================================================
   ALERT TEXT
   ============================================================ */

.risk-disclaimer-alert strong {
    display: block;

    margin: 0;
    padding: 0;

    color: #ffffff;

    font-size: 14px;
    font-weight: 700;

    line-height: 1.35;
}


/* ============================================================
   INTRODUCTORY TEXT
   ============================================================ */

.risk-disclaimer-content > p:not(.risk-disclaimer-note) {
    display: block;

    width: 100%;

    margin: 0 0 18px;

    padding: 0;

    color: rgba(255, 255, 255, 0.82);

    font-size: 14px;

    line-height: 1.55;

    box-sizing: border-box;
}


/* ============================================================
   THREE RISK POINTS
   ============================================================ */

.risk-disclaimer-points {
    display: flex;

    flex-direction: column;

    width: 100%;

    gap: 14px;

    margin: 0;

    padding: 0;

    box-sizing: border-box;
}


/* ============================================================
   INDIVIDUAL RISK CARD
   ============================================================ */

.risk-disclaimer-point {
    display: flex;

    flex-direction: column;

    align-items: flex-start;

    width: 100%;

    margin: 0;

    padding: 12px 14px;

    border-radius: 8px;

    background: rgba(255, 255, 255, 0.045);

    border: 1px solid rgba(255, 255, 255, 0.08);

    box-sizing: border-box;

    overflow: visible;
}


/* ============================================================
   POINT TITLE
   ============================================================ */

.risk-disclaimer-point strong {
    display: block;

    width: 100%;

    margin: 0 0 4px;

    padding: 0;

    color: #ffffff;

    font-size: 14px;

    font-weight: 700;

    line-height: 1.35;

    box-sizing: border-box;
}


/* ============================================================
   POINT DESCRIPTION
   ============================================================ */

.risk-disclaimer-point span {
    display: block;

    width: 100%;

    margin: 0;

    padding: 0;

    color: rgba(255, 255, 255, 0.72);

    font-size: 13px;

    font-weight: 400;

    line-height: 1.5;

    box-sizing: border-box;
}


/* ============================================================
   PAST PERFORMANCE
   ============================================================ */

.risk-disclaimer-note {
    display: block;

    width: 100%;

    margin: 18px 0 0;

    padding: 0;

    color: rgba(255, 255, 255, 0.78);

    font-size: 14px;

    line-height: 1.55;

    box-sizing: border-box;
}


/* ============================================================
   FOOTER
   ============================================================ */

.risk-disclaimer-footer {
    width: 100%;

    min-height: 80px;

    margin: 0;

    padding: 14px 20px;

    display: flex;

    align-items: center;

    justify-content: space-between;

    gap: 16px;

    border-top: 1px solid rgba(255, 255, 255, 0.1);

    box-sizing: border-box;

    flex: 0 0 auto;
}


/* ============================================================
   READ FULL RISK DISCLOSURE
   ============================================================ */

.risk-disclaimer-read-more {
    display: block;

    min-width: 0;

    margin: 0;

    padding: 0;

    color: #4c8bf5;

    font-size: 14px;

    font-weight: 600;

    line-height: 1.35;

    text-decoration: none;

    white-space: nowrap;

    flex: 1 1 auto;
}

.risk-disclaimer-read-more:hover {
    text-decoration: underline;
}


/* ============================================================
   I UNDERSTAND
   ============================================================ */

.risk-disclaimer-understand {
    display: flex;

    align-items: center;
    justify-content: center;

    width: 142px;

    min-width: 142px;

    height: 44px;

    margin: 0;

    padding: 10px 16px;

    border: 0;

    border-radius: 7px;

    background: #4c8bf5;

    color: #ffffff;

    font-family: inherit;

    font-size: 14px;

    font-weight: 600;

    line-height: 1;

    cursor: pointer;

    box-sizing: border-box;

    flex: 0 0 auto;
}

.risk-disclaimer-understand:hover {
    opacity: 0.92;
}

.risk-disclaimer-understand:active {
    transform: scale(0.98);
}


/* ============================================================
   COMPACT MOBILE
   ============================================================ */

@media (max-width: 480px) {

    /*
     * Keep the navy strip aligned directly above
     * the Run panel on mobile.
     */
    .risk-disclaimer {
        bottom: 68px;

        height: 68px;
    }

    .risk-disclaimer-button {
        left: 22px;

        bottom: 11px;

        width: 118px;

        height: 26px;

        font-size: 8px;
    }


    /* -----------------------------------------
       MODAL OVERLAY
       ----------------------------------------- */

    .risk-disclaimer-overlay {
        padding: 12px;
    }


    /* -----------------------------------------
       MODAL
       ----------------------------------------- */

    .risk-disclaimer-modal {
        width: 100%;

        max-width: none;

        max-height: calc(100vh - 100px);
        max-height: calc(100dvh - 100px);

        border-radius: 10px;
    }


    /* -----------------------------------------
       HEADER
       ----------------------------------------- */

    .risk-disclaimer-header {
        min-height: 54px;

        padding: 10px 14px;
    }

    .risk-disclaimer-title-wrapper {
        gap: 8px;
    }

    .risk-disclaimer-title-wrapper h2 {
        font-size: 15px;
    }

    .risk-disclaimer-warning-icon {
        font-size: 17px;
    }

    .risk-disclaimer-close {
        width: 32px;
        height: 32px;

        min-width: 32px;

        font-size: 26px;
    }


    /* -----------------------------------------
       CONTENT
       ----------------------------------------- */

    .risk-disclaimer-content {
        padding: 12px 14px 14px;
    }


    /* -----------------------------------------
       WARNING
       ----------------------------------------- */

    .risk-disclaimer-alert {
        min-height: 46px;

        margin-bottom: 12px;

        padding: 10px 12px;

        gap: 8px;
    }

    .risk-disclaimer-alert-icon {
        font-size: 16px;
    }

    .risk-disclaimer-alert strong {
        font-size: 13px;
    }


    /* -----------------------------------------
       INTRO TEXT
       ----------------------------------------- */

    .risk-disclaimer-content > p:not(.risk-disclaimer-note) {
        margin-bottom: 12px;

        font-size: 13px;

        line-height: 1.4;
    }


    /* -----------------------------------------
       RISK CARDS
       ----------------------------------------- */

    .risk-disclaimer-points {
        gap: 8px;
    }

    .risk-disclaimer-point {
        padding: 9px 12px;

        border-radius: 8px;
    }

    .risk-disclaimer-point strong {
        margin-bottom: 2px;

        font-size: 13px;

        line-height: 1.3;
    }

    .risk-disclaimer-point span {
        font-size: 12px;

        line-height: 1.35;
    }


    /* -----------------------------------------
       PAST PERFORMANCE
       ----------------------------------------- */

    .risk-disclaimer-note {
        margin-top: 12px;

        font-size: 13px;

        line-height: 1.4;
    }


    /* -----------------------------------------
       FOOTER
       ----------------------------------------- */

    .risk-disclaimer-footer {
        min-height: 62px;

        padding: 10px 14px;

        gap: 8px;

        display: flex;

        flex-direction: row;

        align-items: center;

        justify-content: space-between;
    }

    .risk-disclaimer-read-more {
        font-size: 12px;

        line-height: 1.35;

        white-space: nowrap;

        flex: 1 1 auto;
    }

    .risk-disclaimer-understand {
        width: 116px;

        min-width: 116px;

        height: 38px;

        padding: 8px 10px;

        font-size: 13px;
    }
}


/* ============================================================
   VERY SMALL PHONES
   ============================================================ */

@media (max-width: 360px) {

    .risk-disclaimer {
        bottom: 68px;

        height: 68px;
    }

    .risk-disclaimer-button {
        left: 16px;

        bottom: 11px;

        width: 118px;

        height: 26px;

        font-size: 8px;
    }

    .risk-disclaimer-overlay {
        padding: 8px;
    }

    .risk-disclaimer-modal {
        max-height: calc(100vh - 80px);
        max-height: calc(100dvh - 80px);
    }

    .risk-disclaimer-header {
        min-height: 50px;

        padding: 8px 12px;
    }

    .risk-disclaimer-content {
        padding: 10px 12px 12px;
    }

    .risk-disclaimer-alert {
        min-height: 42px;

        padding: 9px 10px;
    }

    .risk-disclaimer-alert strong {
        font-size: 13px;
    }

    .risk-disclaimer-points {
        gap: 7px;
    }

    .risk-disclaimer-point {
        padding: 8px 10px;
    }

    .risk-disclaimer-point strong {
        font-size: 13px;
    }

    .risk-disclaimer-point span {
        font-size: 12px;

        line-height: 1.35;
    }

    .risk-disclaimer-note {
        margin-top: 10px;

        font-size: 13px;
    }

    .risk-disclaimer-footer {
        min-height: 58px;

        padding: 8px 12px;

        gap: 8px;
    }

    .risk-disclaimer-read-more {
        font-size: 11px;
    }

    .risk-disclaimer-understand {
        width: 105px;

        min-width: 105px;

        height: 36px;

        padding: 8px 9px;

        font-size: 12px;
    }
}
