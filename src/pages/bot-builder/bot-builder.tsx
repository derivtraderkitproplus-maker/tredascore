// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { botNotification } from '@/components/bot-notification/bot-notification';
import { notification_message } from '@/components/bot-notification/bot-notification-utils';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import { TBlocklyEvents } from 'Types';
import FloatingAI from '@/ai-scanner/floating-ai/FloatingAI';
import LoadModal from '../../components/load-modal';
import SaveModal from '../dashboard/bot-list/save-modal';
import BotBuilderTourHandler from '../tutorials/dbot-tours/bot-builder-tour';
import QuickStrategy1 from './quick-strategy';
import WorkspaceWrapper from './workspace-wrapper';

const BotBuilder = observer(() => {
    const { dashboard, app, run_panel, toolbar, quick_strategy, blockly_store } = useStore();
    const { active_tab, active_tour, is_preview_on_popup } = dashboard;
    const { is_open } = quick_strategy;
    const { is_running } = run_panel;
    const { is_loading } = blockly_store;
    const is_blockly_listener_registered = React.useRef(false);
    const is_blockly_delete_listener_registered = React.useRef(false);
    const { isDesktop } = useDevice();
    const { onMount, onUnmount } = app;
    const el_ref = React.useRef<HTMLInputElement | null>(null);

    // State controlling local UI modal presentation overlay layer
    const [isAiScannerOpen, setIsAiScannerOpen] = React.useState(false);

    let deleted_block_id: null | string = null;

    React.useEffect(() => {
        onMount();

        return () => onUnmount();
    }, [onMount, onUnmount]);
    React.useEffect(() => {
        const workspace = window.Blockly?.derivWorkspace;

        if (workspace && is_running && !is_blockly_listener_registered.current) {
            is_blockly_listener_registered.current = true;
            workspace.addChangeListener(handleBlockChangeOnBotRun);
        } else {
            removeBlockChangeListener();
        }

        return () => {
            if (workspace && is_blockly_listener_registered.current) {
                removeBlockChangeListener();
            }
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_running]);

    const handleBlockChangeOnBotRun = (e: Event) => {
        const { is_reset_button_clicked } = toolbar;

        if (e.type !== 'selected' && !is_reset_button_clicked) {
            botNotification(notification_message().workspace_change);
            removeBlockChangeListener();
        } else if (is_reset_button_clicked) {
            removeBlockChangeListener();
        }
    };

    const removeBlockChangeListener = () => {
        is_blockly_listener_registered.current = false;
        window.Blockly?.derivWorkspace?.removeChangeListener(handleBlockChangeOnBotRun);
    };

    React.useEffect(() => {
        const workspace = window.Blockly?.derivWorkspace;

        if (workspace && !is_blockly_delete_listener_registered.current) {
            is_blockly_delete_listener_registered.current = true;
            workspace.addChangeListener(handleBlockDelete);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_loading]);

    const handleBlockDelete = (e: TBlocklyEvents) => {
        const { is_reset_button_clicked, setResetButtonState } = toolbar;

        if (e.type === 'undo') {
            deleted_block_id = null;
            return;
        }

        if (e.type === 'delete' && !is_reset_button_clicked) {
            deleted_block_id = e.blockId;
        }

        if (e.type === 'selected' && deleted_block_id === e.oldElementId) {
            handleBlockDeleteNotification();
            deleted_block_id = null;
        }

        if (
            e.type === 'change' &&
            e.name === 'AMOUNT_LIMITS' &&
            e.newValue === '(min: 0.35 - max: 50000)' &&
            is_reset_button_clicked
        ) {
            setResetButtonState(false);
        }
    };

    const handleBlockDeleteNotification = () => {
        botNotification(notification_message().block_delete, {
            label: localize('Undo'),
            onClick: closeToast => {
                window.Blockly.derivWorkspace.undo();
                closeToast?.();
            },
        });
    };
    return (
        <>
            <div
                className={classNames('bot-builder', {
                    'bot-builder--active': active_tab === 1 && !is_preview_on_popup,
                    'bot-builder--inactive': is_preview_on_popup,
                    'bot-builder--tour-active': active_tour,
                })}
            >
                <div id='scratch_div' ref={el_ref}>
                    <WorkspaceWrapper />
                </div>
            </div>

            {active_tab === 1 && <BotBuilderTourHandler is_mobile={!isDesktop} />}

            <LoadModal />
            <SaveModal />
            {is_open && <QuickStrategy1 />}

            {/* INJECTED ARTIFACT: INERTIAL MOMENTUM FLUID SLIDE PURPLE AI SPHERE MODULE */}
            {active_tab === 1 && !is_preview_on_popup && (
                <div 
                    className='floating-ai-trigger-wrapper'
                    style={{
                        display: isAiScannerOpen ? 'none' : 'flex',
                        transform: `translate(var(--ai-drag-x, 0px), var(--ai-drag-y, 0px))`
                    }}
                    onTouchStart={(e) => {
                        const targetElement = e.currentTarget;
                        const touchStartFrame = e.touches[0];
                        
                        const currentMatrixStyle = window.getComputedStyle(targetElement).transform;
                        let initialXOffset = 0;
                        let initialYOffset = 0;
                        
                        if (currentMatrixStyle && currentMatrixStyle !== 'none') {
                            const matrixValues = currentMatrixStyle.match(/matrix\((.+)\)/);
                            if (matrixValues) {
                                const parts = matrixValues[1].split(', ');
                                initialXOffset = parseFloat(parts[4]) || 0;
                                initialYOffset = parseFloat(parts[5]) || 0;
                            }
                        }

                        const screenWidthLimit = window.innerWidth;
                        const screenHeightLimit = window.innerHeight;
                        const minXAllowed = -screenWidthLimit + 85; 
                        const maxXAllowed = 15;
                        const minYAllowed = -screenHeightLimit + 160;
                        const maxYAllowed = 75;

                        let currentDeltaX = initialXOffset;
                        let currentDeltaY = initialYOffset;
                        let lastTouchX = touchStartFrame.clientX;
                        let lastTouchY = touchStartFrame.clientY;
                        let lastTouchTime = Date.now();
                        let absoluteVelocityX = 0;
                        let absoluteVelocityY = 0;

                        const handleTouchMove = (moveEvent: TouchEvent) => {
                            const movingTouchFrame = moveEvent.touches[0];
                            const currentTimestamp = Date.now();
                            const elapsedTime = currentTimestamp - lastTouchTime;

                            const deltaMovementX = movingTouchFrame.clientX - touchStartFrame.clientX + initialXOffset;
                            const deltaMovementY = movingTouchFrame.clientY - touchStartFrame.clientY + initialYOffset;
                            
                            currentDeltaX = Math.max(minXAllowed, Math.min(deltaMovementX, maxXAllowed));
                            currentDeltaY = Math.max(minYAllowed, Math.min(deltaMovementY, maxYAllowed));
                            
                            targetElement.style.setProperty('--ai-drag-x', `${currentDeltaX}px`);
                            targetElement.style.setProperty('--ai-drag-y', `${currentDeltaY}px`);

                            if (elapsedTime > 0) {
                                absoluteVelocityX = (movingTouchFrame.clientX - lastTouchX) / elapsedTime;
                                absoluteVelocityY = (movingTouchFrame.clientY - lastTouchY) / elapsedTime;
                            }

                            lastTouchX = movingTouchFrame.clientX;
                            lastTouchY = movingTouchFrame.clientY;
                            lastTouchTime = currentTimestamp;
                        };

                        const handleTouchEnd = () => {
                            window.removeEventListener('touchmove', handleTouchMove);
                            window.removeEventListener('touchend', handleTouchEnd);

                            const movementSpeedThreshold = 0.15;
                            const absoluteSpeed = Math.sqrt(absoluteVelocityX * absoluteVelocityX + absoluteVelocityY * absoluteVelocityY);

                            if (absoluteSpeed > movementSpeedThreshold) {
                                const frictionDecayCoefficient = 0.95; 
                                
                                const runMomentumDecayFrame = () => {
                                    absoluteVelocityX *= frictionDecayCoefficient;
                                    absoluteVelocityY *= frictionDecayCoefficient;

                                    currentDeltaX += absoluteVelocityX * 16; 
                                    currentDeltaY += absoluteVelocityY * 16;

                                    currentDeltaX = Math.max(minXAllowed, Math.min(currentDeltaX, maxXAllowed));
                                    currentDeltaY = Math.max(minYAllowed, Math.min(currentDeltaY, maxYAllowed));

                                    targetElement.style.setProperty('--ai-drag-x', `${currentDeltaX}px`);
                                    targetElement.style.setProperty('--ai-drag-y', `${currentDeltaY}px`);

                                    if (Math.abs(absoluteVelocityX) > 0.02 || Math.abs(absoluteVelocityY) > 0.02) {
                                        requestAnimationFrame(runMomentumDecayFrame);
                                    }
                                };
                                requestAnimationFrame(runMomentumDecayFrame);
                            }
                        };

                        window.addEventListener('touchmove', handleTouchMove, { passive: false });
                        window.addEventListener('touchend', handleTouchEnd);
                    }}
                >
                    <div className="floating-radar-pulse-ring radar-ring-outer"></div>
                    <div className="floating-radar-pulse-ring radar-ring-inner"></div>

                    <button 
                        className="premium-ai-sphere-trigger"
                        onClick={() => setIsAiScannerOpen(true)}
                    >
                        <div className="circular-inside-ai-core">
                            <span className="ai-core-text-brand">AI</span>
                        </div>
                    </button>
                </div>
            )}

            {/* Modal Backdrop Layer containing the multi-asset strategy scanner matrix */}
            {active_tab === 1 && !is_preview_on_popup && isAiScannerOpen && (
                <div 
                    className='ai-scanner-floating-overlay-container'
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        zIndex: 1000,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        background: 'rgba(5, 7, 13, 0.6)',
                        backdropFilter: 'blur(4px)',
                        padding: '20px',
                        boxSizing: 'border-box'
                    }}
                >
                    <div 
                        className='close-overlay-hitbox' 
                        onClick={() => setIsAiScannerOpen(false)}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            zIndex: -1
                        }}
                    />
                    <div style={{ width: '100%', maxWidth: '450px' }}>
                        <FloatingAI 
                            derivContext={{ websocketInstance: window.Blockly?.derivWorkspace?.socket || window.ws || app }} 
                            selectedMarket='1HZ100V' 
                            onCloseScanner={() => setIsAiScannerOpen(false)}
                        />
                    </div>
                </div>
            )}
        </>
    );
});

export default BotBuilder;
