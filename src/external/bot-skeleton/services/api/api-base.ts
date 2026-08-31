// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
/* [AI] - Analytics removed - utility functions moved to @/utils/account-helpers */
import { getAccountId, getAccountType, isDemoAccount, removeUrlParameter } from '@/utils/account-helpers';
/* [/AI] */
import CommonStore from '@/stores/common-store';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { TAuthData } from '@/types/api-types';
import { clearAuthData } from '@/utils/auth-utils';
import { handleBackendError, isBackendError } from '@/utils/error-handler';
import { activeSymbolsProcessorService } from '../../../../services/active-symbols-processor.service';
import { observer as globalObserver } from '../../utils/observer';
import { doUntilDone, socket_state } from '../tradeEngine/utils/helpers';
import {
    CONNECTION_STATUS,
    setAccountList,
    setAuthData,
    setConnectionStatus,
    setIsAuthorized,
    setIsAuthorizing,
} from './observables/connection-status-stream';
import ApiHelpers from './api-helpers';
import { generateDerivApiInstance, V2GetActiveAccountId } from './appId';
import chart_api from './chart-api';

type CurrentSubscription = {
    id: string;
    unsubscribe: () => void;
};

type SubscriptionPromise = Promise<{
    subscription: CurrentSubscription;
}>;

type TApiBaseApi = {
    connection: {
        readyState: keyof typeof socket_state;
        addEventListener: (event: string, callback: () => void) => void;
        removeEventListener: (event: string, callback: () => void) => void;
    };
    send: (data: unknown) => void;
    disconnect: () => void;
    authorize: (token: string) => Promise<{ authorize: TAuthData; error: unknown }>;

    onMessage: () => {
        subscribe: (callback: (message: unknown) => void) => {
            unsubscribe: () => void;
        };
    };
} & ReturnType<typeof generateDerivApiInstance>;

class APIBase {
    api: TApiBaseApi | null = null;
    token: string = '';
    account_id: string = '';
    pip_sizes = {};
    account_info = {};
    is_running = false;
    subscriptions: CurrentSubscription[] = [];
    time_interval: ReturnType<typeof setInterval> | null = null;
    has_active_symbols = false;
    is_stopping = false;
    active_symbols: any[] = [];
    current_auth_subscriptions: SubscriptionPromise[] = [];
    is_authorized = false;
    active_symbols_promise: Promise<any[] | undefined> | null = null;
    common_store: CommonStore | undefined;
    reconnection_attempts: number = 0;

    // ========================================================
    // AI SCANNER STATE
    // ========================================================
    //
    // The scanner uses the SAME Deriv WebSocket connection.
    // No second WebSocket is created.
    //
    // scanner_ticks contains clean numeric quote values that
    // can be passed directly to:
    //
    // analyzeMarket(scannerTicks)
    //
    // The scanner itself remains completely separate from this
    // API layer.
    // ========================================================

    private readonly SCANNER_MAX_TICKS = 120;

    private scanner_ticks: number[] = [];

    private scanner_symbol: string = '';

    private scanner_message_unsubscribe:
        (() => void) | null = null;

    private scanner_subscription_id:
        string | null = null;

    private scanner_subscription_active = false;

    // Constants for timeouts - extracted magic numbers for better maintainability
    private readonly ACTIVE_SYMBOLS_TIMEOUT_MS = 10000; // 10 seconds
    private readonly ENRICHMENT_TIMEOUT_MS = 10000; // 10 seconds
    private readonly MAX_RECONNECTION_ATTEMPTS = 5; // Maximum number of reconnection attempts before session reset

    // ========================================================
    // EXISTING SUBSCRIPTION CLEANUP
    // ========================================================

    unsubscribeAllSubscriptions = () => {
        this.current_auth_subscriptions?.forEach(subscription_promise => {
            subscription_promise.then(({ subscription }) => {
                if (subscription?.id) {
                    this.api?.send({
                        forget: subscription.id,
                    });
                }
            });
        });

        this.current_auth_subscriptions = [];
    };

    // ========================================================
    // AI SCANNER HELPERS
    // ========================================================

    /**
     * Return the current scanner tick history.
     *
     * The returned array is copied so callers cannot directly
     * mutate APIBase's internal tick buffer.
     *
     * This array is compatible with:
     *
     * analyzeMarket(api_base.getScannerTicks())
     */
    getScannerTicks = (): number[] => {
        return [...this.scanner_ticks];
    };

    /**
     * Return the symbol currently being monitored by the scanner.
     */
    getScannerSymbol = (): string => {
        return this.scanner_symbol;
    };

    /**
     * Return whether the scanner tick stream is active.
     */
    isScannerTickStreamActive = (): boolean => {
        return this.scanner_subscription_active;
    };

    /**
     * Clear the scanner's local tick history.
     *
     * This does NOT disconnect the Deriv API.
     * It only resets the data consumed by the AI scanner.
     */
    clearScannerTicks = () => {
        this.scanner_ticks = [];
    };

    /**
     * Add a validated quote to the scanner buffer.
     *
     * The scanner logic expects a number[].
     * Invalid, negative, NaN and infinite values are ignored.
     */
    private pushScannerTick = (value: unknown) => {
        const quote = Number(value);

        if (
            !Number.isFinite(quote) ||
            quote < 0
        ) {
            return;
        }

        this.scanner_ticks.push(quote);

        if (
            this.scanner_ticks.length >
            this.SCANNER_MAX_TICKS
        ) {
            this.scanner_ticks =
                this.scanner_ticks.slice(
                    -this.SCANNER_MAX_TICKS
                );
        }
    };

    /**
     * Add historical prices returned by Deriv.
     *
     * Deriv history responses normally contain:
     *
     * history.prices
     *
     * The values are normalized into the same number[] format
     * used by the live tick stream.
     */
    private pushScannerHistory = (
        prices: unknown
    ) => {
        if (!Array.isArray(prices)) {
            return;
        }

        prices.forEach(price => {
            const quote = Number(price);

            if (
                Number.isFinite(quote) &&
                quote >= 0
            ) {
                this.scanner_ticks.push(
                    quote
                );
            }
        });

        if (
            this.scanner_ticks.length >
            this.SCANNER_MAX_TICKS
        ) {
            this.scanner_ticks =
                this.scanner_ticks.slice(
                    -this.SCANNER_MAX_TICKS
                );
        }
    };

    /**
     * Process a single message from the existing Deriv
     * WebSocket message stream.
     *
     * This listener is intentionally passive.
     * It does not execute trades or alter existing API logic.
     */
    private handleScannerMessage = (
        rawMessage: unknown
    ) => {
        if (
            !rawMessage ||
            typeof rawMessage !== 'object'
        ) {
            return;
        }

        const message =
            rawMessage as Record<
                string,
                any
            >;

        // ----------------------------------------------------
        // INITIAL TICK HISTORY
        // ----------------------------------------------------

        if (
            message.history &&
            Array.isArray(
                message.history.prices
            )
        ) {
            this.pushScannerHistory(
                message.history.prices
            );
        }

        // ----------------------------------------------------
        // LIVE TICK
        // ----------------------------------------------------

        if (
            message.tick
        ) {
            const quote =
                message.tick.quote;

            this.pushScannerTick(
                quote
            );

            return;
        }

        // ----------------------------------------------------
        // ALTERNATIVE QUOTE FORM
        // ----------------------------------------------------
        //
        // Some API wrappers expose quote at the top level.
        // Only consume it when the message is clearly a tick.
        // ----------------------------------------------------

        if (
            message.msg_type === 'tick' &&
            message.quote !== undefined
        ) {
            this.pushScannerTick(
                message.quote
            );
        }
    };

    /**
     * Start the AI scanner's tick stream.
     *
     * IMPORTANT:
     * This uses the existing `this.api` WebSocket.
     *
     * It does NOT create another WebSocket.
     *
     * Example:
     *
     * api_base.startScannerTicks('R_100');
     */
    startScannerTicks = async (
        symbol: string
    ) => {
        if (
            !symbol ||
            typeof symbol !== 'string'
        ) {
            throw new Error(
                'A valid Deriv symbol is required to start scanner ticks'
            );
        }

        if (!this.api) {
            throw new Error(
                'API connection not available for scanner tick stream'
            );
        }

        // ----------------------------------------------------
        // If already monitoring this symbol, do nothing.
        // ----------------------------------------------------

        if (
            this.scanner_subscription_active &&
            this.scanner_symbol === symbol
        ) {
            return {
                success: true,
                symbol,
                ticks:
                    this.getScannerTicks(),
            };
        }

        // ----------------------------------------------------
        // Stop an existing scanner stream before changing
        // symbols.
        // ----------------------------------------------------

        if (
            this.scanner_subscription_active
        ) {
            await this.stopScannerTicks();
        }

        // ----------------------------------------------------
        // Reset scanner data for the new symbol.
        // ----------------------------------------------------

        this.clearScannerTicks();

        this.scanner_symbol =
            symbol;

        // ----------------------------------------------------
        // Attach to the EXISTING API message stream.
        // ----------------------------------------------------

        try {
            const messageStream =
                this.api.onMessage();

            if (
                messageStream &&
                typeof messageStream.subscribe ===
                    'function'
            ) {
                const messageSubscription =
                    messageStream.subscribe(
                        this.handleScannerMessage
                    );

                if (
                    messageSubscription &&
                    typeof messageSubscription
                        .unsubscribe ===
                        'function'
                ) {
                    this.scanner_message_unsubscribe =
                        messageSubscription.unsubscribe;
                }
            }
        } catch (error) {
            console.error(
                '[APIBase] Failed to attach scanner message listener:',
                error
            );

            this.scanner_symbol = '';

            throw error;
        }

        // ----------------------------------------------------
        // Request initial history + live ticks.
        //
        // We deliberately use a bounded history request.
        // The scanner itself only needs its most recent
        // MAX_ANALYSIS_TICKS values.
        // ----------------------------------------------------

        try {
            const response =
                await doUntilDone(
                    () =>
                        this.api?.send({
                            ticks_history:
                                symbol,
                            count:
                                this.SCANNER_MAX_TICKS,
                            end: 'latest',
                            style: 'ticks',
                            subscribe: 1,
                        }),
                    [],
                    this
                );

            // Some API wrappers return the history response
            // directly through send().
            if (
                response &&
                typeof response ===
                    'object'
            ) {
                const result =
                    response as Record<
                        string,
                        any
                    >;

                if (
                    result.error
                ) {
                    throw new Error(
                        result.error.message ||
                            'Deriv scanner history request failed'
                    );
                }

                if (
                    result.history &&
                    Array.isArray(
                        result.history.prices
                    )
                ) {
                    this.pushScannerHistory(
                        result.history.prices
                    );
                }

                if (
                    result.tick
                ) {
                    this.pushScannerTick(
                        result.tick.quote
                    );
                }
            }

            this.scanner_subscription_active =
                true;

            return {
                success: true,
                symbol,
                ticks:
                    this.getScannerTicks(),
            };
        } catch (error) {
            console.error(
                '[APIBase] Failed to start scanner tick stream:',
                error
            );

            if (
                this.scanner_message_unsubscribe
            ) {
                try {
                    this.scanner_message_unsubscribe();
                } catch {
                    // Ignore cleanup errors.
                }
            }

            this.scanner_message_unsubscribe =
                null;

            this.scanner_symbol =
                '';

            this.scanner_subscription_active =
                false;

            throw error;
        }
    };

    /**
     * Stop the AI scanner tick subscription.
     *
     * This does NOT disconnect the main Deriv WebSocket.
     * It only stops the scanner's tick subscription.
     */
    stopScannerTicks = async () => {
        // ----------------------------------------------------
        // Forget Deriv subscription when we have its ID.
        // ----------------------------------------------------

        if (
            this.scanner_subscription_id &&
            this.api
        ) {
            try {
                this.api.send({
                    forget:
                        this.scanner_subscription_id,
                });
            } catch (error) {
                console.warn(
                    '[APIBase] Failed to forget scanner subscription:',
                    error
                );
            }
        }

        this.scanner_subscription_id =
            null;

        // ----------------------------------------------------
        // Remove local message listener.
        // ----------------------------------------------------

        if (
            this.scanner_message_unsubscribe
        ) {
            try {
                this.scanner_message_unsubscribe();
            } catch (error) {
                console.warn(
                    '[APIBase] Failed to unsubscribe scanner listener:',
                    error
                );
            }
        }

        this.scanner_message_unsubscribe =
            null;

        this.scanner_subscription_active =
            false;

        this.scanner_symbol = '';
    };

    /**
     * Completely reset scanner state.
     *
     * This is useful when switching symbols, logging out or
     * intentionally resetting the scanner.
     */
    resetScanner = async () => {
        await this.stopScannerTicks();

        this.clearScannerTicks();
    };

    // ========================================================
    // SOCKET OPEN
    // ========================================================

    onsocketopen() {
        setConnectionStatus(CONNECTION_STATUS.OPENED);

        // Reset reconnection attempts on successful connection
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

        this.handleTokenExchangeIfNeeded();
    }

    private async handleTokenExchangeIfNeeded() {
        const urlParams =
            new URLSearchParams(
                window.location.search
            );

        const account_id =
            urlParams.get(
                'account_id'
            );

        const accountType =
            urlParams.get(
                'account_type'
            );

        if (account_id) {
            localStorage.setItem(
                'active_loginid',
                account_id
            );

            // Remove account_id from URL after storing
            removeUrlParameter(
                'account_id'
            );
        }

        if (accountType) {
            localStorage.setItem(
                'account_type',
                accountType
            );

            // Remove account_type from URL after storing
            removeUrlParameter(
                'account_type'
            );
        }

        // Check if we have an account_id from URL or localStorage
        let activeAccountId:
            string | null =
            getAccountId();

        // If no account_id in localStorage, check sessionStorage for accounts
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
                        accounts.length >
                            0 &&
                        accounts[0]
                            .account_id
                    ) {
                        // Use the first account as default
                        const accountId =
                            accounts[0]
                                .account_id as string;

                        activeAccountId =
                            accountId;

                        localStorage.setItem(
                            'active_loginid',
                            accountId
                        );

                        // Set account type based on account_id prefix
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

        // Now proceed with normal authorization if we have an account_id
        if (activeAccountId) {
            setIsAuthorizing(
                true
            );

            await this.authorizeAndSubscribe();
        }
    }

    // ========================================================
    // SOCKET CLOSE
    // ========================================================

    onsocketclose() {
        setConnectionStatus(
            CONNECTION_STATUS.CLOSED
        );

        // The WebSocket is gone, therefore the scanner's
        // subscription is also gone.
        this.scanner_subscription_id =
            null;

        this.scanner_subscription_active =
            false;

        if (
            this.scanner_message_unsubscribe
        ) {
            try {
                this.scanner_message_unsubscribe();
            } catch {
                // Ignore cleanup errors.
            }
        }

        this.scanner_message_unsubscribe =
            null;

        this.reconnectIfNotConnected();
    }

    // ========================================================
    // INIT
    // ========================================================

    async init(
        force_create_connection = false
    ) {
        this.toggleRunButton(true);

        if (this.api) {
            this.unsubscribeAllSubscriptions();
        }

        // Reset reconnection attempts counter on successful connection initialization
        if (!force_create_connection) {
            this.reconnection_attempts = 0;
        }

        if (
            !this.api ||
            this.api?.connection.readyState !==
                1 ||
            force_create_connection
        ) {
            if (
                this.api?.connection
            ) {
                // Remove scanner listener before disposing
                // the existing API instance.
                if (
                    this.scanner_message_unsubscribe
                ) {
                    try {
                        this.scanner_message_unsubscribe();
                    } catch {
                        // Ignore cleanup errors.
                    }
                }

                this.scanner_message_unsubscribe =
                    null;

                this.scanner_subscription_id =
                    null;

                this.scanner_subscription_active =
                    false;

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

            // Store the current account ID used for this WebSocket connection
            // This will be used to check if we need to regenerate the connection when the tab becomes active
            const currentClientStore =
                globalObserver.getState(
                    'client.store'
                );

            if (
                currentClientStore
            ) {
                const active_login_id =
                    getAccountId();

                if (
                    active_login_id
                ) {
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

        if (
            this.time_interval
        ) {
            clearInterval(
                this.time_interval
            );
        }

        this.time_interval =
            null;

        chart_api.init(
            force_create_connection
        );
    }

    // ========================================================
    // CONNECTION STATUS
    // ========================================================

    getConnectionStatus() {
        if (
            this.api?.connection
        ) {
            const ready_state =
                this.api.connection
                    .readyState;

            return (
                socket_state[
                    ready_state as keyof typeof socket_state
                ] ||
                'Unknown'
            );
        }

        return 'Socket not initialized';
    }

    // ========================================================
    // TERMINATE
    // ========================================================

    terminate() {
        // eslint-disable-next-line no-console
        if (this.api) {
            this.api.disconnect();
        }
    }

    // ========================================================
    // EVENT LISTENERS
    // ========================================================

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

    // ========================================================
    // ACCOUNT INSTANCE
    // ========================================================

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

    // ========================================================
    // RECONNECT
    // ========================================================

    reconnectIfNotConnected = () => {
        if (
            this.api?.connection
                ?.readyState &&
            this.api?.connection
                ?.readyState > 1
        ) {
            this.reconnection_attempts +=
                1;

            if (
                this.reconnection_attempts >=
                this.MAX_RECONNECTION_ATTEMPTS
            ) {
                // Reset reconnection counter
                this.reconnection_attempts = 0;

                // Reset scanner state because the old
                // WebSocket session is no longer valid.
                this.scanner_subscription_id =
                    null;

                this.scanner_subscription_active =
                    false;

                if (
                    this.scanner_message_unsubscribe
                ) {
                    try {
                        this.scanner_message_unsubscribe();
                    } catch {
                        // Ignore cleanup errors.
                    }
                }

                this.scanner_message_unsubscribe =
                    null;

                // Properly handle logout through the API
                setIsAuthorized(
                    false
                );

                setAccountList([]);

                setAuthData(null);

                // Clear necessary storage items
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

    // ========================================================
    // AUTHORIZATION
    // ========================================================

    async authorizeAndSubscribe() {
        if (!this.api) return;

        this.account_id =
            getAccountId() || '';

        setIsAuthorizing(
            true
        );

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

                // Authorization error
                console.error(
                    'Authorization error:',
                    errorMessage
                );

                setIsAuthorizing(
                    false
                );

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

            // Build full account list from sessionStorage (populated during OAuth flow)
            // Falls back to just the current account if sessionStorage has no data
            const storedAccounts =
                DerivWSAccountsService.getStoredAccounts();

            const accountList =
                storedAccounts &&
                storedAccounts.length >
                    0
                    ? storedAccounts
                          .filter(
                              a =>
                                  !a.status ||
                                  a.status ===
                                      'active'
                          )
                          .map(
                              a => ({
                                  balance:
                                      parseFloat(
                                          a.balance
                                      ) ||
                                      0,

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
                              })
                          )
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

            // Set account_type in localStorage based on loginid prefix using centralized utility
            const loginid =
                balance?.loginid ||
                '';

            const isDemo =
                isDemoAccount(
                    loginid
                );

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

            // Update the WebSocket login ID in the client store
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

            setIsAuthorized(
                true
            );

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

            if (
                balance?.loginid
            ) {
                localStorage.setItem(
                    'active_loginid',
                    balance.loginid
                );
            }

            if (
                this.has_active_symbols
            ) {
                this.toggleRunButton(
                    false
                );
            } else {
                this.active_symbols_promise =
                    this.getActiveSymbols();
            }

            this.subscribe();
        } catch (e) {
            this.is_authorized =
                false;

            clearAuthData();

            setIsAuthorized(
                false
            );

            globalObserver.emit(
                'Error',
                e
            );
        } finally {
            setIsAuthorizing(
                false
            );
        }
    }

    // ========================================================
    // EXISTING ACCOUNT STREAMS
    // ========================================================

    async subscribe() {
        const subscribeToStream = (
            streamName: string
        ) => {
            return doUntilDone(
                () => {
                    const subscription =
                        this.api?.send({
                            [streamName]:
                                1,

                            subscribe:
                                1,
                        });

                    if (
                        subscription
                    ) {
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

        const streamsToSubscribe =
            [
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

    // ========================================================
    // ACTIVE SYMBOLS
    // ========================================================

    getActiveSymbols =
        async () => {
            if (!this.api) {
                throw new Error(
                    'API connection not available for fetching active symbols'
                );
            }

            try {
                // Add timeout to prevent hanging
                const timeout =
                    new Promise(
                        (_, reject) =>
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
                            this.api?.send(
                                {
                                    active_symbols:
                                        'brief',
                                }
                            ),
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
                    ).length >
                        0
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

                // Process active symbols using the dedicated service with fallback
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

                    // Fallback to raw symbols if enrichment fails
                    this.active_symbols =
                        active_symbols;

                    this.pip_sizes =
                        {};
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

    // ========================================================
    // RUN BUTTON
    // ========================================================

    toggleRunButton =
        (toggle: boolean) => {
            const run_button =
                document.querySelector(
                    '#db-animation__run-button'
                );

            if (!run_button)
                return;

            (
                run_button as HTMLButtonElement
            ).disabled =
                toggle;
        };

    // ========================================================
    // RUNNING STATE
    // ========================================================

    setIsRunning(
        toggle = false
    ) {
        this.is_running =
            toggle;
    }

    // ========================================================
    // GENERIC SUBSCRIPTIONS
    // ========================================================

    pushSubscription(
        subscription: CurrentSubscription
    ) {
        this.subscriptions.push(
            subscription
        );
    }

    clearSubscriptions() {
        this.subscriptions.forEach(
            s =>
                s.unsubscribe()
        );

        this.subscriptions =
            [];

        // Resetting timeout resolvers
        const global_timeouts =
            globalObserver.getState(
                'global_timeouts'
            ) ?? [];

        global_timeouts.forEach(
            (
                _: unknown,
                i: number
            ) => {
                clearTimeout(i);
            }
        );
    }
}

// ============================================================
// SINGLE API BASE INSTANCE
// ============================================================

export const api_base =
    new APIBase();
