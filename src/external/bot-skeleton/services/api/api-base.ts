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

    /*
     * Deriv subscription id, when available.
     */
    subscriptionId: string | null;
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
     *
     * The scanner is deliberately kept separate from the
     * trading engine.
     *
     * This bridge:
     *
     * - reads Deriv tick data
     * - validates tick data
     * - forwards ticks to scanner callbacks
     * - prevents duplicate streams per symbol
     * - survives API reconnection
     * - cleans up correctly
     *
     * It NEVER:
     *
     * - places trades
     * - executes Blockly
     * - presses Run
     * - modifies Quick Strategy
     */

    private scannerTickStreams =
        new Map<string, ScannerTickStream>();

    /*
     * Constants for timeouts.
     */

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

        /*
         * Successful connection resets the
         * reconnection counter.
         */
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
         * Restore any AI scanner streams that
         * were registered before reconnection.
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

        /*
         * Scanner stream definitions remain in memory.
         *
         * Only their listeners and old subscription IDs
         * are removed. They will be restored after the
         * new socket becomes OPEN.
         */
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
            /*
             * Detach scanner listeners before replacing
             * the underlying API instance.
             *
             * IMPORTANT:
             * We do NOT delete the registered scanner
             * callbacks. They are restored when the new
             * socket becomes available.
             */
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

        /*
         * If the API is already open, restore scanner
         * streams immediately.
         */
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
             * Authorization is complete.
             *
             * Restore scanner streams again because
             * the connection may have been regenerated
             * during authorization.
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
     *
     * One WebSocket market stream is maintained per symbol.
     *
     * Multiple FloatingAI consumers can request the same
     * symbol without creating multiple Deriv subscriptions.
     */

    private attachScannerTickStream(
        stream: ScannerTickStream
    ) {
        /*
         * --------------------------------------------------------
         * API INSTANCE CHECK
         * --------------------------------------------------------
         */

        if (!this.api) {
            return false;
        }

        /*
         * Stream must still be active.
         */

        if (!stream.active) {
            return false;
        }

        /*
         * --------------------------------------------------------
         * WEBSOCKET READY CHECK
         * --------------------------------------------------------
         *
         * Having an API object is not enough.
         *
         * The underlying WebSocket must actually be OPEN
         * before we send the ticks subscription request.
         */

        if (
            this.api.connection.readyState !==
            1
        ) {
            console.log(
                `[AI Scanner] Waiting for WebSocket to open before subscribing to ${stream.symbol}`
            );

            return false;
        }

        /*
         * --------------------------------------------------------
         * DUPLICATE LISTENER PROTECTION
         * --------------------------------------------------------
         */

        if (
            stream.messageSubscription
        ) {
            return true;
        }

        /*
         * Keep the exact API instance used for this
         * subscription attempt.
         *
         * This prevents a delayed response from an old
         * WebSocket connection from writing its subscription
         * ID into a newly restored stream.
         */

        const apiInstance =
            this.api;

        const symbol =
            stream.symbol;

        try {
            /*
             * ----------------------------------------------------
             * MESSAGE LISTENER
             * ----------------------------------------------------
             *
             * Install the listener BEFORE sending the
             * subscription request so the first tick cannot
             * be missed.
             */

            const messageSubscription =
                apiInstance
                    .onMessage()
                    .subscribe(
                        (
                            message: any
                        ) => {
                            if (
                                !stream.active ||
                                !message
                            ) {
                                return;
                            }

                            /*
                             * Only accept a Deriv tick
                             * belonging to this stream.
                             */

                            if (
                                !message.tick ||
                                message.tick
                                    .symbol !==
                                    symbol
                            ) {
                                return;
                            }

                            const rawQuote =
                                message.tick
                                    .quote;

                            const rawEpoch =
                                message.tick
                                    .epoch;

                            const quote =
                                Number(
                                    rawQuote
                                );

                            const epoch =
                                Number(
                                    rawEpoch
                                );

                            /*
                             * Strict validation.
                             */

                            if (
                                !Number.isFinite(
                                    quote
                                ) ||
                                !Number.isFinite(
                                    epoch
                                )
                            ) {
                                return;
                            }

                            const normalizedTick: ScannerTick =
                                {
                                    symbol,

                                    quote,

                                    epoch,
                                };

                            /*
                             * Diagnostic confirmation that
                             * the actual live tick has reached
                             * the scanner bridge.
                             */

                            console.log(
                                `[AI Scanner] TICK ${symbol}: ${quote} @ ${epoch}`
                            );

                            /*
                             * Copy callbacks before
                             * dispatching.
                             *
                             * This protects the iteration if
                             * a callback causes subscription
                             * cleanup.
                             */

                            const callbacks =
                                Array.from(
                                    stream.callbacks
                                );

                            callbacks.forEach(
                                callback => {
                                    try {
                                        callback(
                                            normalizedTick
                                        );
                                    } catch (
                                        error
                                    ) {
                                        console.error(
                                            `[APIBase] AI scanner tick callback failed for ${symbol}:`,
                                            error
                                        );
                                    }
                                }
                            );
                        }
                    );

            stream.messageSubscription =
                messageSubscription;

            /*
             * ----------------------------------------------------
             * SEND DERIV TICK SUBSCRIPTION
             * ----------------------------------------------------
             *
             * The socket was confirmed OPEN above.
             */

            console.log(
                `[AI Scanner] SUBSCRIBE REQUEST: ${symbol}`
            );

            const subscriptionResult =
                apiInstance.send({
                    ticks: symbol,
                    subscribe: 1,
                });

            /*
             * ----------------------------------------------------
             * CAPTURE SUBSCRIPTION ID
             * ----------------------------------------------------
             *
             * Depending on the API wrapper, send() may return:
             *
             * 1. the response directly
             * 2. a Promise resolving to the response
             *
             * Deriv normally provides the ID under:
             *
             * response.subscription.id
             *
             * We also support response.id for compatibility.
             */

            const captureSubscriptionId = (
                result: any
            ) => {
                /*
                 * Ignore responses belonging to an old
                 * WebSocket instance or an old listener.
                 */

                if (
                    !stream.active ||
                    this.api !==
                        apiInstance ||
                    stream.messageSubscription !==
                        messageSubscription
                ) {
                    return;
                }

                const subscriptionId =
                    result?.subscription
                        ?.id ||
                    result?.id ||
                    null;

                if (
                    subscriptionId
                ) {
                    stream.subscriptionId =
                        String(
                            subscriptionId
                        );

                    console.log(
                        `[AI Scanner] SUBSCRIPTION CONFIRMED: ${symbol} (${stream.subscriptionId})`
                    );
                }

                /*
                 * If Deriv returned an API-level error,
                 * report it clearly.
                 */

                if (
                    result?.error
                ) {
                    console.error(
                        `[AI Scanner] Tick subscription error for ${symbol}:`,
                        result.error
                    );
                }
            };

            /*
             * Synchronous response.
             */

            if (
                subscriptionResult &&
                typeof subscriptionResult ===
                    'object' &&
                typeof subscriptionResult.then !==
                    'function'
            ) {
                captureSubscriptionId(
                    subscriptionResult
                );
            }

            /*
             * Promise response.
             */

            if (
                subscriptionResult &&
                typeof subscriptionResult.then ===
                    'function'
            ) {
                subscriptionResult
                    .then(
                        (
                            result: any
                        ) => {
                            captureSubscriptionId(
                                result
                            );
                        }
                    )
                    .catch(
                        (
                            error: unknown
                        ) => {
                            /*
                             * Only clean up this listener if
                             * this is still the same API instance
                             * and subscription attempt.
                             */

                            if (
                                this.api ===
                                    apiInstance &&
                                stream.messageSubscription ===
                                    messageSubscription
                            ) {
                                try {
                                    messageSubscription.unsubscribe();
                                } catch {
                                    // Ignore cleanup errors.
                                }

                                stream.messageSubscription =
                                    null;

                                stream.subscriptionId =
                                    null;
                            }

                            console.error(
                                `[AI Scanner] Tick subscription request failed for ${symbol}:`,
                                error
                            );
                        }
                    );
            }

            console.log(
                `[AI Scanner] Live tick stream active: ${symbol}`
            );

            return true;
        } catch (error) {
            console.error(
                `[APIBase] Failed to attach live tick stream for ${symbol}:`,
                error
            );

            /*
             * Remove the listener if the subscription request
             * itself failed synchronously.
             */

            try {
                stream.messageSubscription?.unsubscribe();
            } catch {
                // Ignore cleanup errors.
            }

            stream.messageSubscription =
                null;

            stream.subscriptionId =
                null;

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
        /*
         * Validate symbol.
         */

        if (
            typeof symbol !== 'string' ||
            symbol.trim().length === 0
        ) {
            console.error(
                '[APIBase] Cannot subscribe to ticks: symbol is missing'
            );

            return () => {};
        }

        /*
         * Validate callback.
         */

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

        /*
         * Reuse the existing stream for the symbol.
         */

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
            };

            this.scannerTickStreams.set(
                normalizedSymbol,
                stream
            );
        } else {
            /*
             * A previously retained stream may have been
             * detached during a WebSocket reconnection.
             *
             * Make sure it remains active when a consumer
             * subscribes again.
             */

            stream.active = true;
        }

        /*
         * Add this callback only once.
         *
         * Set prevents duplicate callback registration
         * for the exact same function reference.
         */

        stream.callbacks.add(
            callback
        );

        /*
         * If the API is currently OPEN,
         * attach the stream immediately.
         *
         * If the API exists but is still CONNECTING,
         * the stream remains registered and will be
         * restored automatically from onsocketopen().
         */

        if (
            this.api?.connection
                ?.readyState === 1
        ) {
            this.attachScannerTickStream(
                stream
            );
        } else if (this.api) {
            console.log(
                `[AI Scanner] Registered ${normalizedSymbol}; waiting for WebSocket OPEN.`
            );
        } else {
            console.warn(
                `[AI Scanner] Scanner tick stream registered for ${normalizedSymbol}; waiting for API connection.`
            );
        }

        /*
         * Return an isolated unsubscribe function.
         *
         * This removes only THIS callback.
         *
         * The underlying Deriv stream remains active
         * while other consumers still need the symbol.
         */

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

            /*
             * Keep the underlying market stream alive
             * if another callback is still subscribed.
             */

            if (
                currentStream.callbacks.size >
                0
            ) {
                return;
            }

            /*
             * No consumers remain.
             *
             * Remove the actual Deriv subscription.
             */

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

        /*
         * Forget the Deriv subscription when we have
         * received a subscription id.
         *
         * Only send forget if the current API connection
         * is OPEN.
         */

        if (
            stream.subscriptionId &&
            this.api &&
            this.api.connection.readyState ===
                1
        ) {
            try {
                this.api.send({
                    forget:
                        stream.subscriptionId,
                });

                console.log(
                    `[AI Scanner] FORGET subscription: ${symbol} (${stream.subscriptionId})`
                );
            } catch (error) {
                console.warn(
                    `[APIBase] Failed to forget tick stream ${symbol}:`,
                    error
                );
            }
        }

        /*
         * Always remove our WebSocket message listener.
         */

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
     *
     * Used when the underlying WebSocket instance is replaced.
     *
     * IMPORTANT:
     *
     * We do NOT delete the registered scanner callbacks.
     *
     * The callback definitions remain stored so they can
     * automatically attach to the new API connection.
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
                 * The old subscription id belongs to
                 * the old WebSocket session.
                 *
                 * Do not reuse it after reconnection.
                 */

                stream.subscriptionId =
                    null;
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

        /*
         * The API must actually be OPEN before sending
         * a new subscription request.
         */

        if (
            this.api.connection.readyState !==
            1
        ) {
            return;
        }

        this.scannerTickStreams.forEach(
            stream => {
                if (
                    stream.active &&
                    stream.callbacks.size > 0 &&
                    !stream.messageSubscription
                ) {
                    console.log(
                        `[AI Scanner] Restoring tick stream: ${stream.symbol}`
                    );

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
        /*
         * Copy symbols first because stopScannerTickStream()
         * removes entries from the Map.
         */

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
