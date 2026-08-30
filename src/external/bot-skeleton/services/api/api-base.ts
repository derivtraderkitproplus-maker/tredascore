// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md

/* [AI] - Analytics removed - utility functions moved to @/utils/account-helpers */
import {
    getAccountId,
    getAccountType,
    isDemoAccount,
    removeUrlParameter,
} from '@/utils/account-helpers';
/* [/AI] */

import CommonStore from '@/stores/common-store';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { TAuthData } from '@/types/api-types';
import { clearAuthData } from '@/utils/auth-utils';
import {
    handleBackendError,
    isBackendError,
} from '@/utils/error-handler';
import { activeSymbolsProcessorService } from '../../../../services/active-symbols-processor.service';
import { observer as globalObserver } from '../../utils/observer';
import {
    doUntilDone,
    socket_state,
} from '../tradeEngine/utils/helpers';

import {
    CONNECTION_STATUS,
    setAccountList,
    setAuthData,
    setConnectionStatus,
    setIsAuthorized,
    setIsAuthorizing,
} from './observables/connection-status-stream';

import ApiHelpers from './api-helpers';
import {
    generateDerivApiInstance,
    V2GetActiveAccountId,
} from './appId';
import chart_api from './chart-api';

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

type CurrentSubscription = {
    id: string;
    unsubscribe: () => void;
};

type SubscriptionPromise = Promise<{
    subscription: CurrentSubscription;
}>;

type ScannerTick = {
    symbol: string;
    quote: number;
    epoch: number;
};

type ScannerTickCallback = (
    tick: ScannerTick
) => void;

type ScannerTickStream = {
    symbol: string;

    callbacks: Set<ScannerTickCallback>;

    messageSubscription: {
        unsubscribe: () => void;
    } | null;

    active: boolean;

    subscriptionId: string | null;

    subscriptionRequested: boolean;
};

type TApiBaseApi = {
    connection: {
        readyState: keyof typeof socket_state;

        addEventListener: (
            event: string,
            callback: () => void
        ) => void;

        removeEventListener: (
            event: string,
            callback: () => void
        ) => void;
    };

    send: (data: unknown) => any;

    disconnect: () => void;

    authorize: (
        token: string
    ) => Promise<{
        authorize: TAuthData;
        error: unknown;
    }>;

    onMessage: () => {
        subscribe: (
            callback: (
                message: unknown
            ) => void
        ) => {
            unsubscribe: () => void;
        };
    };
} & ReturnType<
    typeof generateDerivApiInstance
>;
/*
 * ============================================================
 * API BASE
 * ============================================================
 */

class APIBase {
    api: TApiBaseApi | null = null;

    token: string = '';

    account_id: string = '';

    pip_sizes = {};

    account_info = {};

    is_running = false;

    subscriptions: CurrentSubscription[] = [];

    time_interval:
        | ReturnType<typeof setInterval>
        | null = null;

    has_active_symbols = false;

    is_stopping = false;

    active_symbols: any[] = [];

    current_auth_subscriptions:
        SubscriptionPromise[] = [];

    is_authorized = false;

    active_symbols_promise:
        Promise<any[] | undefined> | null =
        null;

    common_store:
        | CommonStore
        | undefined;

    reconnection_attempts: number = 0;

    /*
     * ========================================================
     * AI SCANNER LIVE TICK BRIDGE
     * ========================================================
     */

    private scannerTickStreams =
        new Map<string, ScannerTickStream>();

    private readonly ACTIVE_SYMBOLS_TIMEOUT_MS =
        10000;

    private readonly ENRICHMENT_TIMEOUT_MS =
        10000;

    private readonly MAX_RECONNECTION_ATTEMPTS =
        5;

    /*
     * ========================================================
     * SUBSCRIPTION CLEANUP
     * ========================================================
     */

    unsubscribeAllSubscriptions = () => {
        this.current_auth_subscriptions?.forEach(
            subscription_promise => {
                subscription_promise.then(
                    ({ subscription }) => {
                        if (subscription?.id) {
                            this.api?.send({
                                forget:
                                    subscription.id,
                            });
                        }
                    }
                );
            }
        );

        this.current_auth_subscriptions =
            [];
    };

    /*
     * ========================================================
     * SOCKET OPEN
     * ========================================================
     */

    onsocketopen() {
        setConnectionStatus(
            CONNECTION_STATUS.OPENED
        );

        this.reconnection_attempts = 0;

        const currentClientStore =
            globalObserver.getState(
                'client.store'
            );

        if (currentClientStore) {
            currentClientStore.setIsAccountRegenerating(
                false
            );
        }

        /*
         * Restore scanner tick streams only after
         * the WebSocket is confirmed OPEN.
         */
        this.restoreScannerTickStreams();

        this.handleTokenExchangeIfNeeded();
    }

    /*
     * ========================================================
     * TOKEN EXCHANGE
     * ========================================================
     */

    private async handleTokenExchangeIfNeeded() {
        const urlParams =
            new URLSearchParams(
                window.location.search
            );

        const account_id =
            urlParams.get('account_id');

        const accountType =
            urlParams.get('account_type');

        if (account_id) {
            localStorage.setItem(
                'active_loginid',
                account_id
            );

            removeUrlParameter(
                'account_id'
            );
        }

        if (accountType) {
            localStorage.setItem(
                'account_type',
                accountType
            );

            removeUrlParameter(
                'account_type'
            );
        }

        let activeAccountId:
            | string
            | null =
            getAccountId();

        if (!activeAccountId) {
            try {
                const storedAccounts =
                    sessionStorage.getItem(
                        'deriv_accounts'
                    );

                if (storedAccounts) {
                    const accounts =
                        JSON.parse(
                            storedAccounts
                        );
                    if (
                        accounts &&
                        accounts.length > 0 &&
                        accounts[0]
                            .account_id
                    ) {
                        const accountId =
                            accounts[0]
                                .account_id as string;

                        activeAccountId =
                            accountId;

                        localStorage.setItem(
                            'active_loginid',
                            accountId
                        );

                        const isDemo =
                            accountId.startsWith(
                                'VRT'
                            ) ||
                            accountId.startsWith(
                                'VRTC'
                            );

                        localStorage.setItem(
                            'account_type',
                            isDemo
                                ? 'demo'
                                : 'real'
                        );
                    }
                }
            } catch (error) {
                console.error(
                    '[APIBase] Error reading accounts from sessionStorage:',
                    error
                );
            }
        }

        if (activeAccountId) {
            setIsAuthorizing(true);

            await this.authorizeAndSubscribe();
        }
    }

    /*
     * ========================================================
     * SOCKET CLOSE
     * ========================================================
     */

    onsocketclose() {
        setConnectionStatus(
            CONNECTION_STATUS.CLOSED
        );

        this.detachScannerTickMessageSubscriptions();

        this.reconnectIfNotConnected();
    }

    /*
     * ========================================================
     * INITIALIZE API
     * ========================================================
     */

    async init(
        force_create_connection = false
    ) {
        this.toggleRunButton(true);

        if (this.api) {
            this.unsubscribeAllSubscriptions();
        }

        if (!force_create_connection) {
            this.reconnection_attempts = 0;
        }

        if (
            !this.api ||
            this.api?.connection.readyState !==
                1 ||
            force_create_connection
        ) {
            this.detachScannerTickMessageSubscriptions();

            if (this.api?.connection) {
                ApiHelpers.disposeInstance();

                setConnectionStatus(
                    CONNECTION_STATUS.CLOSED
                );

                this.api.disconnect();

                this.api.connection.removeEventListener(
                    'open',
                    this.onsocketopen.bind(
                        this
                    )
                );

                this.api.connection.removeEventListener(
                    'close',
                    this.onsocketclose.bind(
                        this
                    )
                );
            }

            this.api =
                await generateDerivApiInstance();

            this.api?.connection.addEventListener(
                'open',
                this.onsocketopen.bind(
                    this
                )
            );

            this.api?.connection.addEventListener(
                'close',
                this.onsocketclose.bind(
                    this
                )
            );

            const currentClientStore =
                globalObserver.getState(
                    'client.store'
                );

            if (currentClientStore) {
                const active_login_id =
                    getAccountId();

                if (active_login_id) {
                    currentClientStore.setWebSocketLoginId(
                        active_login_id
                    );
                }
            }
        }
        const hasAccountID =
            V2GetActiveAccountId();

        if (
            !this.has_active_symbols &&
            !hasAccountID
        ) {
            this.active_symbols_promise =
                this.getActiveSymbols().then(
                    () => undefined
                );
        }

        this.initEventListeners();

        if (this.time_interval) {
            clearInterval(
                this.time_interval
            );
        }

        this.time_interval = null;

        chart_api.init(
            force_create_connection
        );

        if (
            this.api?.connection.readyState ===
            1
        ) {
            this.restoreScannerTickStreams();
        }
    }

    /*
     * ========================================================
     * CONNECTION STATUS
     * ========================================================
     */

    getConnectionStatus() {
        if (this.api?.connection) {
            const ready_state =
                this.api.connection.readyState;

            return (
                socket_state[
                    ready_state as keyof typeof socket_state
                ] || 'Unknown'
            );
        }

        return 'Socket not initialized';
    }

    /*
     * ========================================================
     * TERMINATE
     * ========================================================
     */

    terminate() {
        this.unsubscribeAllTickStreams();

        if (this.api) {
            this.api.disconnect();
        }
    }

    /*
     * ========================================================
     * EVENT LISTENERS
     * ========================================================
     */

    initEventListeners() {
        if (window) {
            window.addEventListener(
                'online',
                this.reconnectIfNotConnected
            );

            window.addEventListener(
                'focus',
                this.reconnectIfNotConnected
            );
        }
    }

    /*
     * ========================================================
     * NEW API INSTANCE
     * ========================================================
     */

    async createNewInstance(
        account_id: string
    ) {
        if (
            this.account_id !==
            account_id
        ) {
            await this.init();
        }
    }

    /*
     * ========================================================
     * RECONNECT
     * ========================================================
     */

    reconnectIfNotConnected = () => {
        if (
            this.api?.connection?.readyState &&
            this.api.connection.readyState >
                1
        ) {
            this.reconnection_attempts +=
                1;

            if (
                this.reconnection_attempts >=
                this
                    .MAX_RECONNECTION_ATTEMPTS
            ) {
                this.reconnection_attempts =
                    0;
                setIsAuthorized(false);

                setAccountList([]);

                setAuthData(null);

                localStorage.removeItem(
                    'active_loginid'
                );

                localStorage.removeItem(
                    'account_type'
                );

                localStorage.removeItem(
                    'accountsList'
                );

                localStorage.removeItem(
                    'clientAccounts'
                );
            }

            this.init(true);
        }
    };

    /*
     * ========================================================
     * AUTHORIZATION
     * ========================================================
     */

    async authorizeAndSubscribe() {
        if (!this.api) return;

        this.account_id =
            getAccountId() || '';

        setIsAuthorizing(true);

        try {
            const {
                balance,
                error,
            } =
                await this.api.balance();

            if (error) {
                const errorMessage =
                    isBackendError(error)
                        ? handleBackendError(
                              error
                          )
                        : error.message ||
                          'Authorization failed';

                console.error(
                    'Authorization error:',
                    errorMessage
                );

                setIsAuthorizing(false);

                return {
                    ...error,
                    localizedMessage:
                        errorMessage,
                };
            }

            this.account_info = {
                balance:
                    balance?.balance,

                currency:
                    balance?.currency,

                loginid:
                    balance?.loginid,
            };

            this.token =
                balance?.loginid;

            const account_type =
                getAccountType(
                    balance?.loginid
                );

            const currentAccount =
                balance?.loginid
                    ? {
                          balance:
                              balance.balance,

                          currency:
                              balance.currency ||
                              'USD',

                          is_virtual:
                              account_type ===
                              'real'
                                  ? 0
                                  : 1,

                          loginid:
                              balance.loginid,
                      }
                    : null;
            const storedAccounts =
                DerivWSAccountsService.getStoredAccounts();

            const accountList =
                storedAccounts &&
                storedAccounts.length > 0
                    ? storedAccounts
                          .filter(
                              a =>
                                  !a.status ||
                                  a.status ===
                                      'active'
                          )
                          .map(a => ({
                              balance:
                                  parseFloat(
                                      a.balance
                                  ) || 0,

                              currency:
                                  a.currency ||
                                  'USD',

                              is_virtual:
                                  a.account_type ===
                                  'demo'
                                      ? 1
                                      : 0,

                              loginid:
                                  a.account_id,
                          }))
                    : currentAccount
                      ? [currentAccount]
                      : [];

            setAccountList(
                accountList
            );

            setAuthData({
                balance:
                    balance?.balance,

                currency:
                    balance?.currency,

                loginid:
                    balance?.loginid,

                is_virtual:
                    account_type ===
                    'real'
                        ? 0
                        : 1,

                account_list:
                    accountList,
            });

            const loginid =
                balance?.loginid || '';

            const isDemo =
                isDemoAccount(loginid);

            if (isDemo) {
                localStorage.setItem(
                    'account_type',
                    'demo'
                );
            } else {
                localStorage.setItem(
                    'account_type',
                    'real'
                );
            }

            globalObserver.emit(
                'api.authorize',
                {
                    account_list:
                        accountList,

                    current_account: {
                        loginid:
                            balance?.loginid,

                        currency:
                            balance?.currency ||
                            'USD',

                        is_virtual:
                            account_type ===
                            'real'
                                ? 0
                                : 1,

                        balance:
                            typeof balance?.balance ===
                            'number'
                                ? balance.balance
                                : undefined,
                    },
                }
            );

            const currentClientStore =
                globalObserver.getState(
                    'client.store'
                );

            if (
                currentClientStore &&
                balance?.loginid
            ) {
                currentClientStore.setWebSocketLoginId(
                    balance.loginid
                );
            }

            setIsAuthorized(true);

            this.is_authorized =
                true;

            localStorage.setItem(
                'client_account_details',
                JSON.stringify(
                    accountList
                )
            );

            localStorage.setItem(
                'client.country',
                balance?.country
            );

            if (balance?.loginid) {
                localStorage.setItem(
                    'active_loginid',
                    balance.loginid
                );
            }

            if (this.has_active_symbols) {
                this.toggleRunButton(
                    false
                );
            } else {
                this.active_symbols_promise =
                    this.getActiveSymbols();
            }

            await this.subscribe();

            /*
             * Restore scanner streams after authorization.
             */
            this.restoreScannerTickStreams();
        } catch (e) {
            this.is_authorized =
                false;

            clearAuthData();

            setIsAuthorized(false);

            globalObserver.emit(
                'Error',
                e
            );
        } finally {
            setIsAuthorizing(false);
        }
    }

    /*
     * ========================================================
     * NORMAL AUTH STREAMS
     * ========================================================
     */

    async subscribe() {
        const subscribeToStream = (
            streamName: string
        ) => {
            return doUntilDone(
                () => {
                    const subscription =
                        this.api?.send({
                            [streamName]: 1,
                            subscribe: 1,
                        });

                    if (subscription) {
                        this.current_auth_subscriptions.push(
                            subscription
                        );
                    }

                    return subscription;
                },
                [],
                this
            );
        };

        const streamsToSubscribe = [
            'balance',
            'transaction',
            'proposal_open_contract',
        ];

        await Promise.all(
            streamsToSubscribe.map(
                subscribeToStream
            )
        );
    }
    /*
     * ============================================================
     * AI SCANNER — CREATE/RESTORE TICK STREAM
     * ============================================================
     */

    private attachScannerTickStream(
        stream: ScannerTickStream
    ) {
        if (!this.api) {
            return false;
        }

        if (!stream.active) {
            return false;
        }

        /*
         * Never send a subscription while the socket
         * is not OPEN.
         */
        if (this.api.connection.readyState !== 1) {
            console.log(
                `[AI Scanner] Waiting for WebSocket to open before subscribing to ${stream.symbol}.`
            );
            return false;
        }

        /*
         * Attach the incoming-message listener.
         */
        if (!stream.messageSubscription) {
            try {
                const messageSubscription = this.api
                    .onMessage()
                    .subscribe(
                        (message: any) => {
                            if (!stream.active || !message) {
                                return;
                            }

                            /*
                             * TEMPORARY DIAGNOSTIC:
                             * Helps verify the exact payload arriving from the WS.
                             */
                            console.log('[AI Scanner] RAW WS MESSAGE RECEIVED:', message);

                            /*
                             * ADAPTIVE EXTRACTOR:
                             * Handle both nested raw WS shapes and flat, parsed framework shapes.
                             */
                            const tickData = message.tick || message;
                            
                            // Check if this payload belongs to our expected symbol index
                            const msgSymbol = tickData.symbol || message.echo_req?.ticks;
                            if (msgSymbol && msgSymbol !== stream.symbol) {
                                return; // Safely skip data meant for other open asset pairs
                            }

                            // Extract values safely from either nested structures or root keys
                            const rawQuote = tickData.quote || tickData.price || message.price;
                            const rawEpoch = tickData.epoch || message.time;

                            const quote = Number(rawQuote);
                            const epoch = Number(rawEpoch || Math.floor(Date.now() / 1000));

                            /*
                             * Strict numerical validation.
                             */
                            if (!Number.isFinite(quote)) {
                                return; // Silent discard if a valid quote price wasn't found
                            }

                            const normalizedTick: ScannerTick = {
                                symbol: stream.symbol,
                                quote,
                                epoch,
                            };

                            console.log('[AI Scanner] VALID TICK PARSED:', normalizedTick);

                            const callbacks = Array.from(stream.callbacks);
                            callbacks.forEach(callback => {
                                try {
                                    callback(normalizedTick);
                                } catch (error) {
                                    console.error(
                                        `[APIBase] AI scanner tick callback failed for ${stream.symbol}:`,
                                        error
                                    );
                                }
                            });
                        }
                    );

                stream.messageSubscription = messageSubscription;
            } catch (error) {
                console.error(
                    `[APIBase] Failed to create tick message listener for ${stream.symbol}:`,
                    error
                );
                stream.messageSubscription = null;
                return false;
            }
        }
        /*
         * Don't send the same Deriv subscription
         * twice on the same WebSocket session.
         */
        if (stream.subscriptionRequested) {
            return true;
        }

        try {
            /*
             * THIS is the actual Deriv subscription.
             * Keep the exact strategy symbol.
             * Example: { ticks: '1HZ100V', subscribe: 1 }
             */
            const subscriptionRequest = {
                ticks: stream.symbol,
                subscribe: 1,
            };

            console.log(
                '[AI Scanner] SENDING TICK SUBSCRIPTION:',
                subscriptionRequest
            );

            const subscriptionResult = this.api.send(subscriptionRequest);
            stream.subscriptionRequested = true;

            /*
             * Some API implementations return the subscription response directly.
             */
            if (
                subscriptionResult &&
                typeof subscriptionResult === 'object' &&
                subscriptionResult.id
            ) {
                stream.subscriptionId = subscriptionResult.id;
            }

            /*
             * Some implementations return a Promise.
             */
            if (
                subscriptionResult &&
                typeof subscriptionResult.then === 'function'
            ) {
                subscriptionResult
                    .then((result: any) => {
                        console.log(
                            '[AI Scanner] TICK SUBSCRIPTION RESPONSE:',
                            {
                                symbol: stream.symbol,
                                result,
                            }
                        );

                        if (result?.id) {
                            stream.subscriptionId = result.id;
                        }

                        if (result?.subscription?.id) {
                            stream.subscriptionId = result.subscription.id;
                        }

                        if (result?.error) {
                            console.error(
                                `[AI Scanner] Deriv rejected tick subscription for ${stream.symbol}:`,
                                result.error
                            );
                            stream.subscriptionRequested = false;
                        }
                    })
                    .catch((error: unknown) => {
                        stream.subscriptionRequested = false;
                        stream.subscriptionId = null;
                        console.error(
                            `[APIBase] Could not complete tick subscription for ${stream.symbol}:`,
                            error
                        );
                    });
            }

            console.log(
                `[AI Scanner] Live tick subscription requested: ${stream.symbol}`
            );
            return true;
        } catch (error) {
            stream.subscriptionRequested = false;
            stream.subscriptionId = null;

            console.error(
                `[APIBase] Failed to subscribe to live ticks for ${stream.symbol}:`,
                error
            );

            return false;
        }
    }
    /*
     * ============================================================
     * AI SCANNER — SUBSCRIBE TO TICKS
     * ============================================================
     */

    subscribeToTicks(
        symbol: string,
        callback: ScannerTickCallback
    ) {
        if (
            typeof symbol !== 'string' ||
            symbol.trim().length === 0
        ) {
            console.error(
                '[APIBase] Cannot subscribe to ticks: symbol is missing'
            );

            return () => {};
        }

        if (
            typeof callback !==
            'function'
        ) {
            console.error(
                `[APIBase] Cannot subscribe to ticks for ${symbol}: callback is invalid`
            );

            return () => {};
        }

        const normalizedSymbol =
            symbol.trim();

        let stream =
            this.scannerTickStreams.get(
                normalizedSymbol
            );

        if (!stream) {
            stream = {
                symbol:
                    normalizedSymbol,

                callbacks:
                    new Set<ScannerTickCallback>(),

                messageSubscription:
                    null,

                active: true,

                subscriptionId:
                    null,

                subscriptionRequested:
                    false,
            };

            this.scannerTickStreams.set(
                normalizedSymbol,
                stream
            );
        }

        stream.active = true;

        stream.callbacks.add(
            callback
        );

        console.log(
            `[AI Scanner] Callback registered for ${normalizedSymbol}. Consumers: ${stream.callbacks.size}`
        );

        /*
         * If already open, attach immediately.
         */
        if (
            this.api &&
            this.api.connection.readyState ===
                1
        ) {
            this.attachScannerTickStream(
                stream
            );
        } else {
            console.log(
                `[AI Scanner] Tick stream registered for ${normalizedSymbol}; waiting for WebSocket connection.`
            );
        }

        let isSubscribed = true;

        return () => {
            if (!isSubscribed) {
                return;
            }

            isSubscribed = false;

            const currentStream =
                this.scannerTickStreams.get(
                    normalizedSymbol
                );

            if (!currentStream) {
                return;
            }

            currentStream.callbacks.delete(
                callback
            );

            console.log(
                `[AI Scanner] Callback removed for ${normalizedSymbol}. Consumers remaining: ${currentStream.callbacks.size}`
            );

            if (
                currentStream.callbacks.size >
                0
            ) {
                return;
            }

            this.stopScannerTickStream(
                normalizedSymbol
            );
        };
    }

    /*
     * ============================================================
     * AI SCANNER — STOP ONE SYMBOL
     * ============================================================
     */

    private stopScannerTickStream(
        symbol: string
    ) {
        const stream =
            this.scannerTickStreams.get(
                symbol
            );

        if (!stream) {
            return;
        }

        stream.active = false;

        if (
            stream.subscriptionId &&
            this.api &&
            this.api.connection.readyState ===
                1
        ) {
            try {
                console.log(
                    `[AI Scanner] Forgetting tick subscription: ${symbol}`
                );

                this.api.send({
                    forget:
                        stream.subscriptionId,
                });
            } catch (error) {
                console.warn(
                    `[APIBase] Failed to forget tick stream ${symbol}:`,
                    error
                );
            }
        }

        try {
            stream.messageSubscription?.unsubscribe();
        } catch (error) {
            console.warn(
                `[APIBase] Failed to remove tick listener for ${symbol}:`,
                error
            );
        }

        stream.messageSubscription =
            null;

        stream.subscriptionId =
            null;

        stream.subscriptionRequested =
            false;

        stream.callbacks.clear();

        this.scannerTickStreams.delete(
            symbol
        );

        console.log(
            `[AI Scanner] Live tick stream stopped: ${symbol}`
        );
    }

    /*
     * ============================================================
     * AI SCANNER — DETACH MESSAGE LISTENERS
     * ============================================================
     */

    private detachScannerTickMessageSubscriptions() {
        this.scannerTickStreams.forEach(
            stream => {
                try {
                    stream.messageSubscription?.unsubscribe();
                } catch (error) {
                    console.warn(
                        `[APIBase] Failed to detach scanner listener for ${stream.symbol}:`,
                        error
                    );
                }

                stream.messageSubscription =
                    null;

                /*
                 * Old subscription IDs belong to
                 * the old WebSocket session.
                 */
                stream.subscriptionId =
                    null;

                /*
                 * Force a fresh subscription on
                 * the new socket.
                 */
                stream.subscriptionRequested =
                    false;
            }
        );
    }

    /*
     * ============================================================
     * AI SCANNER — RESTORE STREAMS
     * ============================================================
     */

    private restoreScannerTickStreams() {
        if (!this.api) {
            return;
        }

        if (
            this.api.connection.readyState !==
            1
        ) {
            return;
        }

        console.log(
            '[AI Scanner] Restoring scanner tick streams.'
        );

        this.scannerTickStreams.forEach(
            stream => {
                if (
                    stream.active &&
                    stream.callbacks.size > 0
                ) {
                    this.attachScannerTickStream(
                        stream
                    );
                }
            }
        );
    }

    /*
     * ============================================================
     * AI SCANNER — STOP ALL TICK STREAMS
     * ============================================================
     */

    unsubscribeAllTickStreams() {
        const symbols =
            Array.from(
                this.scannerTickStreams.keys()
            );

        symbols.forEach(symbol => {
            this.stopScannerTickStream(
                symbol
            );
        });

        this.scannerTickStreams.clear();
    }
    /*
     * ========================================================
     * ACTIVE SYMBOLS
     * ========================================================
     */

    getActiveSymbols =
        async () => {
            if (!this.api) {
                throw new Error(
                    'API connection not available for fetching active symbols'
                );
            }

            try {
                const timeout =
                    new Promise(
                        (
                            _,
                            reject
                        ) =>
                            setTimeout(
                                () =>
                                    reject(
                                        new Error(
                                            'Active symbols fetch timeout'
                                        )
                                    ),
                                this
                                    .ACTIVE_SYMBOLS_TIMEOUT_MS
                            )
                    );

                const activeSymbolsPromise =
                    doUntilDone(
                        () =>
                            this.api?.send({
                                active_symbols:
                                    'brief',
                            }),
                        [],
                        this
                    );

                const apiResult =
                    await Promise.race(
                        [
                            activeSymbolsPromise,
                            timeout,
                        ]
                    );

                const {
                    active_symbols = [],
                    error = {},
                } =
                    apiResult as any;

                if (
                    error &&
                    Object.keys(
                        error
                    ).length > 0
                ) {
                    throw new Error(
                        `Active symbols API error: ${
                            error.message ||
                            'Unknown error'
                        }`
                    );
                }

                if (
                    !active_symbols.length
                ) {
                    throw new Error(
                        'No active symbols received from API'
                    );
                }

                this.has_active_symbols =
                    true;

                try {
                    const enrichmentTimeout =
                        new Promise<never>(
                            (
                                _,
                                reject
                            ) =>
                                setTimeout(
                                    () =>
                                        reject(
                                            new Error(
                                                'Enrichment timeout'
                                            )
                                        ),
                                    this
                                        .ENRICHMENT_TIMEOUT_MS
                                )
                        );

                    const enrichmentPromise =
                        activeSymbolsProcessorService.processActiveSymbols(
                            active_symbols
                        );

                    const processedResult =
                        await Promise.race(
                            [
                                enrichmentPromise,
                                enrichmentTimeout,
                            ]
                        );

                    this.active_symbols =
                        processedResult.enrichedSymbols;

                    this.pip_sizes =
                        processedResult.pipSizes;
                } catch (
                    enrichmentError
                ) {
                    console.warn(
                        'Symbol enrichment failed, using raw symbols:',
                        enrichmentError
                    );

                    this.active_symbols =
                        active_symbols;

                    this.pip_sizes = {};
                }

                this.toggleRunButton(
                    false
                );

                return this.active_symbols;
            } catch (error) {
                console.error(
                    'Failed to fetch and process active symbols:',
                    error
                );

                throw error;
            }
        };

    /*
     * ========================================================
     * RUN BUTTON
     * ========================================================
     */

    toggleRunButton = (
        toggle: boolean
    ) => {
        const run_button =
            document.querySelector(
                '#db-animation__run-button'
            );

        if (!run_button) {
            return;
        }

        (
            run_button as HTMLButtonElement
        ).disabled = toggle;
    };

    /*
     * ========================================================
     * RUN STATE
     * ========================================================
     */

    setIsRunning(
        toggle = false
    ) {
        this.is_running =
            toggle;
    }

    /*
     * ========================================================
     * GENERAL SUBSCRIPTIONS
     * ========================================================
     */

    pushSubscription(
        subscription: CurrentSubscription
    ) {
        this.subscriptions.push(
            subscription
        );
    }

    clearSubscriptions() {
        this.subscriptions.forEach(
            s => s.unsubscribe()
        );

        this.subscriptions = [];

        const global_timeouts =
            globalObserver.getState(
                'global_timeouts'
            ) ?? [];

        global_timeouts.forEach(
            (
                _:
                    unknown,
                i: number
            ) => {
                clearTimeout(i);
            }
        );
    }
}

/*
 * ============================================================
 * SINGLETON
 * ============================================================
 */

export const api_base =
    new APIBase();
