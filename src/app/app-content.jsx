import React, { lazy, Suspense, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { ToastContainer } from 'react-toastify';
import AuthLoadingWrapper from '@/components/auth-loading-wrapper';
import { botNotification } from '@/components/bot-notification/bot-notification';
import useLiveChat from '@/components/chat/useLiveChat';
import ChunkLoader from '@/components/loader/chunk-loader';
import { getUrlBase } from '@/components/shared';
import TransactionDetailsModal from '@/components/transaction-details';
import { api_base, ApiHelpers, ServerTime } from '@/external/bot-skeleton';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { useApiBase } from '@/hooks/useApiBase';
import useDevMode from '@/hooks/useDevMode';
import { useStore } from '@/hooks/useStore';
import useThemeSwitcher from '@/hooks/useThemeSwitcher';
import { isPreviewMode } from '@/utils/is-preview-mode';
import { ThemeProvider } from '@deriv-com/quill-ui';
import { setSmartChartsPublicPath } from '@deriv-com/smartcharts-champion';
import { localize } from '@deriv-com/translations';
import Audio from '../components/audio';
import BlocklyLoading from '../components/blockly-loading';
import BotStopped from '../components/bot-stopped';
import BotBuilder from '../pages/bot-builder';
import Main from '../pages/main';
import './app.scss';
import 'react-toastify/dist/ReactToastify.css';
import '../components/bot-notification/bot-notification.scss';

// Verified relative file system module route
import { trackExecutedTradeResult } from '../ai-scanner/floating-ai/scannerLogic';

const PreviewBranding =
    process.env.NEXT_PUBLIC_APP_BUILD === 'true' ? lazy(() => import('../preview/preview-branding')) : null;

const AppContent = observer(() => {
    const [is_api_initialized, setIsApiInitialized] = React.useState(false);
    
    // FIXED: Enforce a strict state barrier to ensure Blockly background stores initialize cleanly
    const [is_loading, setIsLoading] = React.useState(true);
    const [is_engine_stores_ready, setIsEngineStoresReady] = React.useState(false);

    const store = useStore();
    const { app, transactions, common, client } = store;
    const { is_dark_mode_on } = useThemeSwitcher();

    const { recovered_transactions, recoverPendingContracts } = transactions;
    const is_subscribed_to_msg_listener = React.useRef(false);
    const msg_listener = React.useRef(null);
    const { connectionStatus } = useApiBase();

    useDevMode();

    useEffect(() => {
        if (isPreviewMode()) return;
        if (!process.env.NEXT_PUBLIC_DERIV_APP_ID) {
            botNotification(localize('Waiting for environment variables to be set…'), undefined, { type: 'warning' });
        }
    }, []);

    const livechat_client_information = {
        is_client_store_initialized: client?.is_logged_in ? true : !!client,
        is_logged_in: client?.is_logged_in,
        loginid: client?.loginid,
        currency: client?.currency,
        residence: client?.residence,
        email: '',
        first_name: '',
        last_name: '',
    };

    useLiveChat(livechat_client_information);

    useEffect(() => {
        if (connectionStatus === CONNECTION_STATUS.OPENED) {
            setIsApiInitialized(true);
            common.setSocketOpened(true);
        } else if (connectionStatus !== CONNECTION_STATUS.OPENED) {
            common.setSocketOpened(false);
        }
    }, [common, connectionStatus]);

    const { current_language } = common;
    const html = document.documentElement;
    React.useEffect(() => {
        html?.setAttribute('lang', current_language.toLowerCase());
        html?.setAttribute('dir', current_language.toLowerCase() === 'ar' ? 'rtl' : 'ltr');
    }, [current_language, html]);

    const handleMessage = React.useCallback(
        ({ data }) => {
            if (data?.msg_type === 'proposal_open_contract' && !data?.error) {
                const { proposal_open_contract } = data;

                if (proposal_open_contract?.is_sold) {
                    const netPnL = parseFloat(proposal_open_contract.profit || '0');
                    trackExecutedTradeResult(netPnL);
                }

                if (
                    proposal_open_contract?.status !== 'open' &&
                    !recovered_transactions?.includes(proposal_open_contract?.contract_id)
                ) {
                    recoverPendingContracts(proposal_open_contract);
                }
            }
        },
        [recovered_transactions, recoverPendingContracts]
    );

    React.useEffect(() => {
        setSmartChartsPublicPath(getUrlBase('/js/smartcharts/'));
    }, []);

    React.useEffect(() => {
        if (!is_subscribed_to_msg_listener.current && client.is_logged_in && is_api_initialized && api_base?.api) {
            is_subscribed_to_msg_listener.current = true;
            msg_listener.current = api_base.api.onMessage()?.subscribe(handleMessage);
        }
        return () => {
            if (is_subscribed_to_msg_listener.current && msg_listener.current) {
                is_subscribed_to_msg_listener.current = false;
                msg_listener.current.unsubscribe?.();
            }
        };
    }, [is_api_initialized, client.is_logged_in, client.loginid, handleMessage, connectionStatus]);

    // INTERNAL SYNCHRONIZATION INITIALIZER: Safely constructs system storage nodes
    const runSecureInitialization = () => {
        try {
            ServerTime.init(common);
            app.setDBotEngineStores();
            ApiHelpers.setInstance(app.api_helpers_store);
            import('@/utils/gtm').then(({ default: GTM }) => {
                GTM.init(store);
            });
            setIsEngineStoresReady(true); // Confirms underlying data states are active
        } catch (e) {
            console.error("🚨 Initialization retry cycle required:", e);
        }
    };

    const changeActiveSymbolLoadingState = () => {
        runSecureInitialization();

        const retrieveActiveSymbols = () => {
            const { active_symbols } = ApiHelpers.instance;
            if (!active_symbols) return;

            active_symbols.retrieveActiveSymbols(true).then(() => {
                setIsLoading(false);
            }).catch(() => {
                setIsLoading(false); 
            });
        };

        if (ApiHelpers?.instance?.active_symbols) {
            retrieveActiveSymbols();
        } else {
            const intervalId = setInterval(() => {
                if (ApiHelpers?.instance?.active_symbols) {
                    clearInterval(intervalId);
                    retrieveActiveSymbols();
                }
            }, 500);
        }
    };

    React.useEffect(() => {
        if (is_api_initialized) {
            setIsLoading(true);
            if (!client.is_logged_in) {
                changeActiveSymbolLoadingState();
            }
        }
    }, [is_api_initialized]);

    React.useEffect(() => {
        if (client.is_logged_in && is_api_initialized) {
            changeActiveSymbolLoadingState();
        }
    }, [is_api_initialized, client.loginid]);

    if (common?.error) return null;

    // Guard view elements until both active assets and inner library definitions register active
    const isSystemFullyHydrated = !is_loading && is_engine_stores_ready;

    return (
        <React.Fragment>
            {PreviewBranding && (
                <Suspense fallback={null}>
                    <PreviewBranding uiReady={isSystemFullyHydrated} />
                </Suspense>
            )}
            {!isSystemFullyHydrated ? (
                <ChunkLoader message={localize('Initializing Bot Builder components safely…')} />
            ) : (
                <AuthLoadingWrapper>
                    <ThemeProvider theme={is_dark_mode_on ? 'dark' : 'light'}>
                        <BlocklyLoading />
                        <div className='bot-dashboard bot' data-testid='dt_bot_dashboard'>
                            <Audio />
                            <Main />
                        </div>
                    </ThemeProvider>
                </AuthLoadingWrapper>
            )}
        </React.Fragment>
    );
});

export default AppContent;
