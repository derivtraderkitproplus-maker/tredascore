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
    const { active_tab, active_tour, is_preview_on_popup, setActiveTab } = dashboard;
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

            {/* removed this outside from toolbar because it needs to be loaded separately without dependency */}
            <LoadModal />
            <SaveModal />
            {is_open && <QuickStrategy1 />}

            {/* Floating Quick Action Launcher Button - Visible only inside Bot Builder view tab context */}
            {active_tab === 1 && !is_preview_on_popup && (
                <button 
                    className='ai-scanner-launcher-btn'
                    onClick={() => setIsAiScannerOpen(!isAiScannerOpen)}
                    style={{
                        position: 'fixed',
                        bottom: '85px',
                        right: '20px',
                        background: 'linear-gradient(135deg, #7c5dfa 0%, #5078ff 100%)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '12px 18px',
                        borderRadius: '30px',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        cursor: 'pointer',
                        zIndex: 999,
                        boxShadow: '0 4px 15px rgba(124, 93, 250, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    <span>✨</span> {isAiScannerOpen ? localize('Close Scanner') : localize('AI Scanner')}
                </button>
            )}

            {/* Centered Modal Backdrop Layer Overlay containing the 30 profile engine modules */}
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
                        {/* Passes downstream the central connection handle context from active global workspace instance */}
                        <FloatingAI derivContext={app} selectedMarket='R_100' />
                    </div>
                </div>
            )}
        </>
    );
});

export default BotBuilder;
