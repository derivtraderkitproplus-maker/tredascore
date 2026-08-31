// ============================================================
// AI STRATEGY LIBRARY
// ============================================================
//
// 30 selectable AI strategy profiles.
//
// IMPORTANT:
// - These are PROFILES only.
// - They reuse existing Quick Strategy engines.
// - They do NOT create new Blockly blocks.
// - They do NOT create WebSocket connections.
// - They do NOT handle OAuth.
// - Live market/tick analysis is handled by scannerlogic.ts.
// - Live connection/bridge handling is handled by scannerbridge.ts.
//
// IMPORTANT DIRECTION DESIGN:
// ------------------------------------------------------------
// Strategy profiles describe the TYPE of market they prefer,
// but normal directional strategies are allowed to operate in
// either live direction.
//
// The scanner determines the actual market direction.
//
// For risefall strategies:
//   UP   -> CALL
//   DOWN -> PUT
//
// This prevents the AI scanner from being permanently biased
// toward CALL/UP markets.
//
// ============================================================

// ============================================================
// TYPES
// ============================================================

export type AIStrategyBias =
    | 'MOMENTUM'
    | 'TREND'
    | 'REVERSAL'
    | 'RANGE'
    | 'ACCUMULATION'
    | 'RECOVERY'
    | 'BALANCED';

export type AIStrategyDirection =
    | 'UP'
    | 'DOWN'
    | 'BOTH'
    | 'NEUTRAL';

export type AIStrategyVolatility =
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'ANY';

export type AIStrategyRisk =
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH';

export type AIStrategyMarketProfile = {
    bias: AIStrategyBias;

    /**
     * Preferred live market direction.
     *
     * BOTH means the strategy can operate in either direction.
     *
     * The scanner will resolve the actual CALL/PUT execution
     * direction from the live market.
     */
    preferredDirection: AIStrategyDirection;

    preferredVolatility: AIStrategyVolatility;

    /**
     * Minimum live-market confidence required before
     * the scanner considers the strategy actionable.
     */
    minimumConfidence: number;
};

export type AIStrategy = {
    // ========================================================
    // Identity
    // ========================================================

    id: string;

    name: string;

    description: string;

    // ========================================================
    // Existing Quick Strategy engine
    // ========================================================

    /**
     * Must match an existing Quick Strategy engine.
     */
    engine: string;

    // ========================================================
    // Default trading configuration
    // ========================================================

    symbol: string;

    tradetype: string;

    type: string;

    stake: number;

    durationtype: string;

    duration: number;

    profit: number;

    loss: number;

    // ========================================================
    // Progressive strategy parameters
    // ========================================================

    size?: number;

    unit?: number;

    // ========================================================
    // Scanner metadata
    // ========================================================

    risk: AIStrategyRisk;

    marketProfile: AIStrategyMarketProfile;
};

// ============================================================
// 30 AI STRATEGY PROFILES
// ============================================================

export const AI_STRATEGIES: AIStrategy[] = [

    // ========================================================
    // 01–06 — CLASSIC STRATEGIES
    // ========================================================

    {
        id: 'martingale-classic',
        name: 'Martingale Classic',
        description: 'Classic loss-recovery strategy.',
        engine: 'MARTINGALE',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 10,

        size: 2,

        risk: 'HIGH',

        marketProfile: {
            bias: 'RECOVERY',
            preferredDirection: 'BOTH',
            preferredVolatility: 'LOW',
            minimumConfidence: 70,
        },
    },

    {
        id: 'dalembert-classic',
        name: "D'Alembert Classic",
        description: 'Gradually adjusts the stake after trade results.',
        engine: 'D_ALEMBERT',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 10,

        unit: 1,

        risk: 'MEDIUM',

        marketProfile: {
            bias: 'BALANCED',
            preferredDirection: 'BOTH',
            preferredVolatility: 'LOW',
            minimumConfidence: 65,
        },
    },

    {
        id: 'oscars-grind',
        name: "Oscar's Grind",
        description: 'Progressive stake management based on trade results.',
        engine: 'OSCARS_GRIND',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 10,

        risk: 'MEDIUM',

        marketProfile: {
            bias: 'BALANCED',
            preferredDirection: 'BOTH',
            preferredVolatility: 'MEDIUM',
            minimumConfidence: 65,
        },
    },

    {
        id: 'reverse-martingale',
        name: 'Reverse Martingale',
        description: 'Increases exposure following successful trades.',
        engine: 'REVERSE_MARTINGALE',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 10,

        size: 2,

        risk: 'HIGH',

        marketProfile: {
            bias: 'MOMENTUM',
            preferredDirection: 'BOTH',
            preferredVolatility: 'MEDIUM',
            minimumConfidence: 72,
        },
    },

    {
        id: 'reverse-dalembert',
        name: "Reverse D'Alembert",
        description: 'Progressive adjustment following successful trades.',
        engine: 'REVERSE_D_ALEMBERT',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 10,

        unit: 1,

        risk: 'MEDIUM',

        marketProfile: {
            bias: 'TREND',
            preferredDirection: 'BOTH',
            preferredVolatility: 'MEDIUM',
            minimumConfidence: 68,
        },
    },

    {
        id: '1326',
        name: '1-3-2-6',
        description: 'Fixed progressive staking sequence.',
        engine: 'STRATEGY_1_3_2_6',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 10,

        risk: 'MEDIUM',

        marketProfile: {
            bias: 'BALANCED',
            preferredDirection: 'BOTH',
            preferredVolatility: 'MEDIUM',
            minimumConfidence: 68,
        },
    },

    // ========================================================
    // 07–14 — ACCUMULATOR STRATEGIES
    // ========================================================

    {
        id: 'accumulator-martingale',
        name: 'Accumulator Martingale',
        description: 'Accumulator profile using progressive loss recovery.',
        engine: 'ACCUMULATORS_MARTINGALE',

        symbol: '1HZ100V',
        tradetype: '',
        type: '',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 10,

        size: 2,

        risk: 'HIGH',

        marketProfile: {
            bias: 'ACCUMULATION',
            preferredDirection: 'NEUTRAL',
            preferredVolatility: 'LOW',
            minimumConfidence: 72,
        },
    },

    {
        id: 'accumulator-dalembert',
        name: "Accumulator D'Alembert",
        description: 'Accumulator profile using unit-based progression.',
        engine: 'ACCUMULATORS_DALEMBERT',

        symbol: '1HZ100V',
        tradetype: '',
        type: '',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 10,

        unit: 1,

        risk: 'MEDIUM',

        marketProfile: {
            bias: 'ACCUMULATION',
            preferredDirection: 'NEUTRAL',
            preferredVolatility: 'LOW',
            minimumConfidence: 68,
        },
    },

    {
        id: 'accumulator-reverse-martingale',
        name: 'Accumulator Reverse Martingale',
        description: 'Accumulator profile increasing after successful trades.',
        engine: 'ACCUMULATORS_REVERSE_MARTINGALE',

        symbol: '1HZ100V',
        tradetype: '',
        type: '',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 10,

        size: 2,

        risk: 'HIGH',

        marketProfile: {
            bias: 'MOMENTUM',
            preferredDirection: 'NEUTRAL',
            preferredVolatility: 'MEDIUM',
            minimumConfidence: 72,
        },
    },

    {
        id: 'accumulator-reverse-dalembert',
        name: "Accumulator Reverse D'Alembert",
        description: 'Accumulator profile using reverse unit progression.',
        engine: 'ACCUMULATORS_REVERSE_DALEMBERT',

        symbol: '1HZ100V',
        tradetype: '',
        type: '',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 10,

        unit: 1,

        risk: 'MEDIUM',

        marketProfile: {
            bias: 'TREND',
            preferredDirection: 'NEUTRAL',
            preferredVolatility: 'MEDIUM',
            minimumConfidence: 68,
        },
    },

    {
        id: 'accumulator-martingale-reset',
        name: 'Accumulator Martingale Reset',
        description: 'Accumulator Martingale with statistical reset.',
        engine: 'ACCUMULATORS_MARTINGALE_ON_STAT_RESET',

        symbol: '1HZ100V',
        tradetype: '',
        type: '',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 10,

        size: 2,

        risk: 'HIGH',

        marketProfile: {
            bias: 'RECOVERY',
            preferredDirection: 'NEUTRAL',
            preferredVolatility: 'LOW',
            minimumConfidence: 75,
        },
    },

    {
        id: 'accumulator-dalembert-reset',
        name: "Accumulator D'Alembert Reset",
        description: 'Accumulator D’Alembert with statistical reset.',
        engine: 'ACCUMULATORS_DALEMBERT_ON_STAT_RESET',

        symbol: '1HZ100V',
        tradetype: '',
        type: '',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 10,

        unit: 1,

        risk: 'MEDIUM',

        marketProfile: {
            bias: 'BALANCED',
            preferredDirection: 'NEUTRAL',
            preferredVolatility: 'LOW',
            minimumConfidence: 70,
        },
    },

    {
        id: 'accumulator-reverse-martingale-reset',
        name: 'Accumulator Reverse Martingale Reset',
        description: 'Reverse accumulator progression with reset.',
        engine: 'ACCUMULATORS_REVERSE_MARTINGALE_ON_STAT_RESET',

        symbol: '1HZ100V',
        tradetype: '',
        type: '',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 10,

        size: 2,

        risk: 'HIGH',

        marketProfile: {
            bias: 'MOMENTUM',
            preferredDirection: 'NEUTRAL',
            preferredVolatility: 'MEDIUM',
            minimumConfidence: 75,
        },
    },

    {
        id: 'accumulator-reverse-dalembert-reset',
        name: "Accumulator Reverse D'Alembert Reset",
        description: 'Reverse D’Alembert accumulator with reset.',
        engine: 'ACCUMULATORS_REVERSE_DALEMBERT_ON_STAT_RESET',

        symbol: '1HZ100V',
        tradetype: '',
        type: '',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 10,

        unit: 1,

        risk: 'MEDIUM',

        marketProfile: {
            bias: 'TREND',
            preferredDirection: 'NEUTRAL',
            preferredVolatility: 'LOW',
            minimumConfidence: 70,
        },
    },

    // ========================================================
    // 15–30 — AI PROFILES
    // ========================================================

    {
        id: 'ai-dollar-flow',
        name: 'AI Dollar Flow',
        description: 'AI profile focused on controlled progressive entries.',
        engine: 'MARTINGALE',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 5,
        loss: 5,

        size: 1.5,

        risk: 'HIGH',

        marketProfile: {
            bias: 'RECOVERY',
            preferredDirection: 'BOTH',
            preferredVolatility: 'LOW',
            minimumConfidence: 72,
        },
    },

    {
        id: 'ai-trend-printer',
        name: 'AI Trend Printer',
        description: 'Trend-following profile using successful trade progression.',
        engine: 'REVERSE_MARTINGALE',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 5,
        loss: 5,

        size: 1.5,

        risk: 'HIGH',

        marketProfile: {
            bias: 'TREND',
            preferredDirection: 'BOTH',
            preferredVolatility: 'MEDIUM',
            minimumConfidence: 75,
        },
    },

    {
        id: 'ai-momentum',
        name: 'AI Momentum',
        description: 'Momentum-oriented progressive profile.',
        engine: 'REVERSE_MARTINGALE',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 5,

        size: 1.5,

        risk: 'HIGH',

        marketProfile: {
            bias: 'MOMENTUM',
            preferredDirection: 'BOTH',
            preferredVolatility: 'HIGH',
            minimumConfidence: 78,
        },
    },

    {
        id: 'ai-reversal',
        name: 'AI Reversal',
        description: 'Contrarian profile using controlled progression.',
        engine: 'D_ALEMBERT',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'PUT',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 5,
        loss: 5,

        unit: 1,

        risk: 'MEDIUM',

        marketProfile: {
            bias: 'REVERSAL',
            preferredDirection: 'BOTH',
            preferredVolatility: 'MEDIUM',
            minimumConfidence: 75,
        },
    },

    {
        id: 'ai-precision',
        name: 'AI Precision',
        description: 'Conservative unit-based profile.',
        engine: 'D_ALEMBERT',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 5,
        loss: 3,

        unit: 1,

        risk: 'MEDIUM',

        marketProfile: {
            bias: 'TREND',
            preferredDirection: 'BOTH',
            preferredVolatility: 'LOW',
            minimumConfidence: 72,
        },
    },

    {
        id: 'ai-conservative',
        name: 'AI Conservative',
        description: 'Lower progression profile designed for controlled exposure.',
        engine: 'D_ALEMBERT',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 3,
        loss: 3,

        unit: 1,

        risk: 'LOW',

        marketProfile: {
            bias: 'RANGE',
            preferredDirection: 'BOTH',
            preferredVolatility: 'LOW',
            minimumConfidence: 65,
        },
    },

    {
        id: 'ai-balanced',
        name: 'AI Balanced',
        description: 'Balanced progressive strategy profile.',
        engine: 'OSCARS_GRIND',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 5,
        loss: 5,

        risk: 'MEDIUM',

        marketProfile: {
            bias: 'BALANCED',
            preferredDirection: 'BOTH',
            preferredVolatility: 'MEDIUM',
            minimumConfidence: 68,
        },
    },

    {
        id: 'ai-recovery',
        name: 'AI Recovery',
        description: 'Recovery-oriented profile using progressive staking.',
        engine: 'MARTINGALE',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 5,
        loss: 5,

        size: 1.5,

        risk: 'HIGH',

        marketProfile: {
            bias: 'RECOVERY',
            preferredDirection: 'BOTH',
            preferredVolatility: 'LOW',
            minimumConfidence: 75,
        },
    },

    {
        id: 'ai-growth',
        name: 'AI Growth',
        description: 'Growth-oriented profile following successful trades.',
        engine: 'REVERSE_MARTINGALE',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 5,

        size: 1.5,

        risk: 'HIGH',

        marketProfile: {
            bias: 'TREND',
            preferredDirection: 'BOTH',
            preferredVolatility: 'MEDIUM',
            minimumConfidence: 75,
        },
    },

    {
        id: 'ai-scalper',
        name: 'AI Scalper',
        description: 'Short-duration profile for rapid entries.',
        engine: 'STRATEGY_1_3_2_6',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 3,
        loss: 3,

        risk: 'MEDIUM',

        marketProfile: {
            bias: 'MOMENTUM',
            preferredDirection: 'BOTH',
            preferredVolatility: 'HIGH',
            minimumConfidence: 72,
        },
    },

    {
        id: 'ai-steady-flow',
        name: 'AI Steady Flow',
        description: 'Steady unit-based progression profile.',
        engine: 'D_ALEMBERT',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 5,
        loss: 5,

        unit: 1,

        risk: 'LOW',

        marketProfile: {
            bias: 'RANGE',
            preferredDirection: 'BOTH',
            preferredVolatility: 'LOW',
            minimumConfidence: 65,
        },
    },

    {
        id: 'ai-power-trend',
        name: 'AI Power Trend',
        description: 'Higher-intensity trend progression profile.',
        engine: 'REVERSE_MARTINGALE',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 10,
        loss: 5,

        size: 2,

        risk: 'HIGH',

        marketProfile: {
            bias: 'MOMENTUM',
            preferredDirection: 'BOTH',
            preferredVolatility: 'HIGH',
            minimumConfidence: 80,
        },
    },

    {
        id: 'ai-smart-reset',
        name: 'AI Smart Reset',
        description: 'Accumulator profile with statistical reset.',
        engine: 'ACCUMULATORS_MARTINGALE_ON_STAT_RESET',

        symbol: '1HZ100V',
        tradetype: '',
        type: '',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 5,
        loss: 5,

        size: 1.5,

        risk: 'HIGH',

        marketProfile: {
            bias: 'RECOVERY',
            preferredDirection: 'NEUTRAL',
            preferredVolatility: 'LOW',
            minimumConfidence: 78,
        },
    },

    {
        id: 'ai-accumulator-flow',
        name: 'AI Accumulator Flow',
        description: 'Accumulator-based progressive profile.',
        engine: 'ACCUMULATORS_DALEMBERT',

        symbol: '1HZ100V',
        tradetype: '',
        type: '',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 5,
        loss: 5,

        unit: 1,

        risk: 'MEDIUM',

        marketProfile: {
            bias: 'ACCUMULATION',
            preferredDirection: 'NEUTRAL',
            preferredVolatility: 'LOW',
            minimumConfidence: 72,
        },
    },

    {
        id: 'ai-reverse-flow',
        name: 'AI Reverse Flow',
        description: 'Reverse accumulator progression profile.',
        engine: 'ACCUMULATORS_REVERSE_MARTINGALE',

        symbol: '1HZ100V',
        tradetype: '',
        type: '',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 5,
        loss: 5,

        size: 1.5,

        risk: 'HIGH',

        marketProfile: {
            bias: 'MOMENTUM',
            preferredDirection: 'NEUTRAL',
            preferredVolatility: 'MEDIUM',
            minimumConfidence: 75,
        },
    },

    {
        id: 'ai-final-boss',
        name: 'AI Adaptive',
        description: 'Adaptive profile selected by the scanner.',
        engine: 'STRATEGY_1_3_2_6',

        symbol: '1HZ100V',
        tradetype: 'risefall',
        type: 'CALL',

        stake: 1,
        durationtype: 't',
        duration: 1,

        profit: 5,
        loss: 5,

        risk: 'MEDIUM',

        marketProfile: {
            bias: 'BALANCED',
            preferredDirection: 'BOTH',
            preferredVolatility: 'ANY',
            minimumConfidence: 70,
        },
    },
];

// ============================================================
// COUNT
// ============================================================

export const AI_STRATEGY_COUNT =
    AI_STRATEGIES.length;

// ============================================================
// VALIDATION
// ============================================================

export const isAIStrategyLibraryValid = (): boolean => {
    return (
        AI_STRATEGIES.length === 30 &&
        AI_STRATEGIES.every(
            strategy =>
                Boolean(strategy.id) &&
                Boolean(strategy.name) &&
                Boolean(strategy.engine) &&
                strategy.stake > 0 &&
                strategy.duration > 0 &&
                strategy.marketProfile.minimumConfidence >= 0 &&
                strategy.marketProfile.minimumConfidence <= 100
        )
    );
};

// ============================================================
// LOOKUP
// ============================================================

export const getAIStrategy = (
    id: string
): AIStrategy | undefined => {
    return AI_STRATEGIES.find(
        strategy => strategy.id === id
    );
};

// ============================================================
// RISK FILTER
// ============================================================

export const getAIStrategiesByRisk = (
    risk: AIStrategyRisk
): AIStrategy[] => {
    return AI_STRATEGIES.filter(
        strategy => strategy.risk === risk
    );
};

// ============================================================
// ENGINE FILTER
// ============================================================

export const getAIStrategiesByEngine = (
    engine: string
): AIStrategy[] => {
    return AI_STRATEGIES.filter(
        strategy => strategy.engine === engine
    );
};

// ============================================================
// MARKET-BIAS FILTER
// ============================================================

export const getAIStrategiesByBias = (
    bias: AIStrategyBias
): AIStrategy[] => {
    return AI_STRATEGIES.filter(
        strategy =>
            strategy.marketProfile.bias === bias
    );
};

// ============================================================
// RANDOM STRATEGY
// ============================================================

export const getRandomAIStrategy = (): AIStrategy => {
    const index = Math.floor(
        Math.random() * AI_STRATEGIES.length
    );

    return AI_STRATEGIES[index];
};

// ============================================================
// RESOLVE LIVE DIRECTION
// ============================================================
//
// This is intentionally kept here as a pure configuration
// helper.
//
// It does NOT execute a trade.
//
// For risefall strategies:
//   UP   -> CALL
//   DOWN -> PUT
//
// NEUTRAL remains unchanged.
//
// ============================================================

export const resolveAIStrategyDirection = (
    strategy: AIStrategy,
    direction: 'UP' | 'DOWN' | 'FLAT'
): AIStrategy => {
    if (
        strategy.tradetype !== 'risefall'
    ) {
        return {
            ...strategy,
        };
    }

    if (direction === 'UP') {
        return {
            ...strategy,
            type: 'CALL',
        };
    }

    if (direction === 'DOWN') {
        return {
            ...strategy,
            type: 'PUT',
        };
    }

    return {
        ...strategy,
    };
};

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default AI_STRATEGIES;
