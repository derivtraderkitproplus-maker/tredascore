// ============================================================
// AI SCANNER LOGIC
// ============================================================
//
// Purpose:
// - Analyze a sequence of Deriv market ticks.
// - Detect market conditions.
// - Measure direction, momentum, trend, volatility and reversal.
// - Detect choppy/noisy conditions.
// - Score all 30 AI strategy profiles.
// - Require sufficient market data.
// - Require sufficient market quality.
// - Require strategy eligibility.
// - Require winner separation before confirming a strategy.
//
// IMPORTANT:
// - This file does NOT connect directly to Deriv.
// - This file does NOT place trades.
// - This file does NOT load Blockly.
// - This file does NOT modify Quick Strategy.
//
// Flow:
//
// Deriv live ticks
//      ↓
// FloatingAI.tsx
//      ↓
// scanMarket()
//      ↓
// analyzeMarket()
//      ↓
// rankStrategies()
//      ↓
// eligibility + confidence + quality
//      ↓
// winner margin / separation
//      ↓
// confirmed AIStrategy
//
// ============================================================

import {
    AI_STRATEGIES,
    AIStrategy,
} from './strategies';

// ============================================================
// TYPES
// ============================================================

export type ScannerMarketState =
    | 'UPTREND'
    | 'DOWNTREND'
    | 'MOMENTUM_UP'
    | 'MOMENTUM_DOWN'
    | 'REVERSAL_UP'
    | 'REVERSAL_DOWN'
    | 'RANGE'
    | 'CHOPPY'
    | 'INSUFFICIENT_DATA';

export type MarketDirection =
    | 'UP'
    | 'DOWN'
    | 'FLAT';

export type VolatilityLevel =
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH';

export type MarketAnalysis = {
    state: ScannerMarketState;

    direction: MarketDirection;

    momentum: number;

    recentMomentum: number;

    trendStrength: number;

    volatility: number;

    consecutiveUp: number;

    consecutiveDown: number;

    priceChange: number;

    normalizedPriceChange: number;

    confidence: number;

    volatilityLevel: VolatilityLevel;

    tickCount: number;

    directionalConsistency: number;

    recentDirectionalConsistency: number;

    reversalStrength: number;

    marketQuality: number;

    isChoppy: boolean;

    isConfirmed: boolean;

    reasons: string[];
};

export type StrategyCompatibility = {
    strategy: AIStrategy;

    score: number;

    eligible: boolean;

    reasons: string[];
};

export type ScannerResult = {
    analysis: MarketAnalysis;

    rankedStrategies: StrategyCompatibility[];

    bestStrategy?: AIStrategy;

    bestScore: number;

    secondBestScore: number;

    winnerMargin: number;

    strategyConfidence: number;

    scanReady: boolean;

    winnerConfirmed: boolean;
};

// ============================================================
// CONFIGURATION
// ============================================================

// Minimum amount of valid market information required.
const MINIMUM_TICKS = 10;

// Preferred amount of history used by the scanner.
const MAX_ANALYSIS_TICKS = 100;

// Recent ticks receive additional importance.
const RECENT_WINDOW = 12;

// Market classification thresholds.
const TREND_THRESHOLD = 55;

const MOMENTUM_THRESHOLD = 65;

const REVERSAL_THRESHOLD = 60;

// Volatility classification.
const LOW_VOLATILITY_MAX = 30;

const HIGH_VOLATILITY_MIN = 70;

// Global scanner safety thresholds.
const MINIMUM_SCAN_CONFIDENCE = 50;

const MINIMUM_WINNER_MARGIN = 8;

const MINIMUM_STRATEGY_SCORE = 55;

const MINIMUM_MARKET_QUALITY = 45;

// Additional signal-quality requirements.
const STRONG_MARKET_QUALITY = 65;

const MINIMUM_DIRECTIONAL_CONSISTENCY = 45;

const MAX_CHOPPY_SCORE = 58;

// ============================================================
// BASIC HELPERS
// ============================================================

const clamp = (
    value: number,
    minimum: number,
    maximum: number
): number =>
    Math.min(
        maximum,
        Math.max(
            minimum,
            value
        )
    );

const average = (
    values: number[]
): number => {
    if (!values.length) {
        return 0;
    }

    return (
        values.reduce(
            (sum, value) =>
                sum + value,
            0
        ) / values.length
    );
};

const safeNumber = (
    value: unknown
): number | null => {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
};

// ============================================================
// CLEAN TICKS
// ============================================================

const cleanTicks = (
    ticks: number[]
): number[] => {
    if (!Array.isArray(ticks)) {
        return [];
    }

    return ticks
        .map(safeNumber)
        .filter(
            (
                value
            ): value is number =>
                value !== null &&
                Number.isFinite(value) &&
                value >= 0
        )
        .slice(
            -MAX_ANALYSIS_TICKS
        );
};

// ============================================================
// PRICE CHANGES
// ============================================================

const getPriceChanges = (
    ticks: number[]
): number[] => {
    const changes: number[] = [];

    for (
        let i = 1;
        i < ticks.length;
        i += 1
    ) {
        const change =
            ticks[i] -
            ticks[i - 1];

        if (
            Number.isFinite(change)
        ) {
            changes.push(change);
        }
    }

    return changes;
};

// ============================================================
// NORMALIZED CHANGES
// ============================================================

const getNormalizedChanges = (
    ticks: number[]
): number[] => {
    const changes: number[] = [];

    for (
        let i = 1;
        i < ticks.length;
        i += 1
    ) {
        const previous =
            ticks[i - 1];

        const current =
            ticks[i];

        if (
            previous === 0 ||
            !Number.isFinite(previous) ||
            !Number.isFinite(current)
        ) {
            changes.push(0);
            continue;
        }

        changes.push(
            (
                current -
                previous
            ) /
                Math.abs(previous)
        );
    }

    return changes;
};

// ============================================================
// DIRECTION
// ============================================================

const calculateDirection = (
    priceChange: number
): MarketDirection => {
    if (priceChange > 0) {
        return 'UP';
    }

    if (priceChange < 0) {
        return 'DOWN';
    }

    return 'FLAT';
};

// ============================================================
// RECENT DIRECTION
// ============================================================

const calculateRecentDirection = (
    changes: number[]
): MarketDirection => {
    if (!changes.length) {
        return 'FLAT';
    }

    const recent =
        changes.slice(
            -Math.min(
                RECENT_WINDOW,
                changes.length
            )
        );

    const net =
        recent.reduce(
            (sum, value) =>
                sum + value,
            0
        );

    return calculateDirection(
        net
    );
};

// ============================================================
// CONSECUTIVE MOVEMENT
// ============================================================

const calculateConsecutiveMovement = (
    changes: number[]
): {
    up: number;
    down: number;
} => {
    let up = 0;
    let down = 0;

    for (
        let i =
            changes.length - 1;
        i >= 0;
        i -= 1
    ) {
        const change =
            changes[i];

        if (change > 0) {
            if (down > 0) {
                break;
            }

            up += 1;
        } else if (change < 0) {
            if (up > 0) {
                break;
            }

            down += 1;
        } else {
            break;
        }
    }

    return {
        up,
        down,
    };
};

// ============================================================
// DIRECTIONAL CONSISTENCY
// ============================================================

const calculateDirectionalConsistency = (
    changes: number[]
): number => {
    const directionalMoves =
        changes.filter(
            change =>
                change !== 0 &&
                Number.isFinite(change)
        );

    if (!directionalMoves.length) {
        return 0;
    }

    const positive =
        directionalMoves.filter(
            change =>
                change > 0
        ).length;

    const negative =
        directionalMoves.filter(
            change =>
                change < 0
        ).length;

    const dominant =
        Math.max(
            positive,
            negative
        );

    return clamp(
        (
            dominant /
            directionalMoves.length
        ) * 100,
        0,
        100
    );
};

// ============================================================
// MOVEMENT STRENGTH
// ============================================================

const calculateMomentum = (
    changes: number[]
): number => {
    if (!changes.length) {
        return 0;
    }

    const directionalMoves =
        changes.filter(
            change =>
                change !== 0 &&
                Number.isFinite(change)
        );

    if (!directionalMoves.length) {
        return 0;
    }

    const totalMovement =
        directionalMoves
            .map(Math.abs)
            .reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            );

    if (
        totalMovement === 0
    ) {
        return 0;
    }

    const positiveMovement =
        directionalMoves
            .filter(
                change =>
                    change > 0
            )
            .reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            );

    const negativeMovement =
        directionalMoves
            .filter(
                change =>
                    change < 0
            )
            .reduce(
                (
                    sum,
                    value
                ) =>
                    sum +
                    Math.abs(
                        value
                    ),
                0
            );

    const dominantMovement =
        Math.max(
            positiveMovement,
            negativeMovement
        );

    return clamp(
        (
            dominantMovement /
            totalMovement
        ) * 100,
        0,
        100
    );
};

// ============================================================
// RECENT MOMENTUM
// ============================================================

const calculateRecentMomentum = (
    changes: number[]
): number => {
    if (!changes.length) {
        return 0;
    }

    const recent =
        changes.slice(
            -Math.min(
                RECENT_WINDOW,
                changes.length
            )
        );

    return calculateMomentum(
        recent
    );
};

// ============================================================
// TREND STRENGTH
// ============================================================

const calculateTrendStrength = (
    ticks: number[],
    changes: number[],
    consistency: number
): number => {
    if (
        ticks.length < 4 ||
        !changes.length
    ) {
        return 0;
    }

    const firstPrice =
        ticks[0];

    const lastPrice =
        ticks[
            ticks.length - 1
        ];

    const netMovement =
        Math.abs(
            lastPrice -
                firstPrice
        );

    const absoluteMovement =
        changes
            .map(Math.abs)
            .reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            );

    if (
        absoluteMovement === 0
    ) {
        return 0;
    }

    const efficiency =
        clamp(
            (
                netMovement /
                absoluteMovement
            ) * 100,
            0,
            100
        );

    const midpoint =
        Math.floor(
            ticks.length / 2
        );

    const firstHalf =
        ticks.slice(
            0,
            midpoint
        );

    const secondHalf =
        ticks.slice(
            midpoint
        );

    const firstChange =
        firstHalf.length >= 2
            ? firstHalf[
                  firstHalf.length - 1
              ] -
              firstHalf[0]
            : 0;

    const secondChange =
        secondHalf.length >= 2
            ? secondHalf[
                  secondHalf.length - 1
              ] -
              secondHalf[0]
            : 0;

    const sameDirection =
        firstChange !== 0 &&
        secondChange !== 0 &&
        Math.sign(
            firstChange
        ) ===
            Math.sign(
                secondChange
            );

    const continuationBonus =
        sameDirection
            ? 15
            : 0;

    return clamp(
        efficiency * 0.45 +
            consistency * 0.40 +
            continuationBonus,
        0,
        100
    );
};

// ============================================================
// RECENT TREND STRENGTH
// ============================================================

const calculateRecentTrendStrength = (
    changes: number[]
): number => {
    if (
        changes.length < 4
    ) {
        return 0;
    }

    const recent =
        changes.slice(
            -Math.min(
                RECENT_WINDOW,
                changes.length
            )
        );

    const consistency =
        calculateDirectionalConsistency(
            recent
        );

    const net =
        recent.reduce(
            (
                sum,
                value
            ) =>
                sum + value,
            0
        );

    const movement =
        recent
            .map(Math.abs)
            .reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            );

    if (
        movement === 0
    ) {
        return 0;
    }

    const efficiency =
        clamp(
            (
                Math.abs(net) /
                movement
            ) * 100,
            0,
            100
        );

    return clamp(
        efficiency * 0.55 +
            consistency * 0.45,
        0,
        100
    );
};

// ============================================================
// VOLATILITY
// ============================================================

const calculateVolatility = (
    ticks: number[]
): number => {
    const normalized =
        getNormalizedChanges(
            ticks
        );

    const movements =
        normalized
            .map(Math.abs)
            .filter(
                value =>
                    Number.isFinite(
                        value
                    )
            );

    if (!movements.length) {
        return 0;
    }

    const mean =
        average(
            movements
        );

    if (
        mean === 0
    ) {
        return 0;
    }

    const squaredDeviation =
        movements.map(
            value =>
                Math.pow(
                    value -
                        mean,
                    2
                )
        );

    const variance =
        average(
            squaredDeviation
        );

    const standardDeviation =
        Math.sqrt(
            variance
        );

    const coefficient =
        mean > 0
            ? standardDeviation /
              mean
            : 0;

    const intensity =
        clamp(
            mean * 1000000,
            0,
            100
        );

    const irregularity =
        clamp(
            coefficient * 100,
            0,
            100
        );

    return Math.round(
        clamp(
            intensity * 0.70 +
                irregularity * 0.30,
            0,
            100
        )
    );
};

// ============================================================
// VOLATILITY CLASSIFICATION
// ============================================================

const classifyVolatility = (
    volatility: number
): VolatilityLevel => {
    if (
        volatility <=
        LOW_VOLATILITY_MAX
    ) {
        return 'LOW';
    }

    if (
        volatility >=
        HIGH_VOLATILITY_MIN
    ) {
        return 'HIGH';
    }

    return 'MEDIUM';
};

// ============================================================
// REVERSAL DETECTION
// ============================================================

const calculateReversalStrength = (
    changes: number[]
): {
    up: number;
    down: number;
} => {
    if (
        changes.length < 6
    ) {
        return {
            up: 0,
            down: 0,
        };
    }

    const recent =
        changes.slice(-6);

    const firstHalf =
        recent.slice(0, 3);

    const secondHalf =
        recent.slice(3);

    const firstMovement =
        firstHalf.reduce(
            (
                sum,
                value
            ) =>
                sum + value,
            0
        );

    const secondMovement =
        secondHalf.reduce(
            (
                sum,
                value
            ) =>
                sum + value,
            0
        );

    const firstMagnitude =
        firstHalf
            .map(Math.abs)
            .reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            );

    const secondMagnitude =
        secondHalf
            .map(Math.abs)
            .reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            );

    if (
        firstMagnitude === 0 ||
        secondMagnitude === 0
    ) {
        return {
            up: 0,
            down: 0,
        };
    }

    const directionChange =
        Math.sign(
            firstMovement
        ) !==
        Math.sign(
            secondMovement
        );

    if (
        !directionChange
    ) {
        return {
            up: 0,
            down: 0,
        };
    }

    const strength =
        clamp(
            (
                secondMagnitude /
                (
                    firstMagnitude +
                    secondMagnitude
                )
            ) * 100,
            0,
            100
        );

    if (
        firstMovement < 0 &&
        secondMovement > 0
    ) {
        return {
            up: strength,
            down: 0,
        };
    }

    if (
        firstMovement > 0 &&
        secondMovement < 0
    ) {
        return {
            up: 0,
            down: strength,
        };
    }

    return {
        up: 0,
        down: 0,
    };
};

// ============================================================
// CHOPPINESS
// ============================================================

const calculateChoppiness = (
    changes: number[]
): number => {
    if (
        changes.length < 4
    ) {
        return 0;
    }

    const directional =
        changes.filter(
            change =>
                change !== 0 &&
                Number.isFinite(change)
        );

    if (
        directional.length < 4
    ) {
        return 0;
    }

    let directionChanges = 0;

    for (
        let i = 1;
        i < directional.length;
        i += 1
    ) {
        if (
            Math.sign(
                directional[i]
            ) !==
            Math.sign(
                directional[i - 1]
            )
        ) {
            directionChanges += 1;
        }
    }

    const flipRate =
        (
            directionChanges /
            (
                directional.length -
                1
            )
        ) * 100;

    const consistency =
        calculateDirectionalConsistency(
            directional
        );

    return clamp(
        flipRate * 0.65 +
            (
                100 -
                consistency
            ) * 0.35,
        0,
        100
    );
};

// ============================================================
// MARKET BIAS
// ============================================================

const getMarketBias = (
    analysis: MarketAnalysis
): AIStrategy['marketProfile']['bias'] => {
    switch (
        analysis.state
    ) {
        case 'MOMENTUM_UP':
        case 'MOMENTUM_DOWN':
            return 'MOMENTUM';

        case 'UPTREND':
        case 'DOWNTREND':
            return 'TREND';

        case 'REVERSAL_UP':
        case 'REVERSAL_DOWN':
            return 'REVERSAL';

        case 'RANGE':
            return 'RANGE';

        case 'CHOPPY':
            return 'BALANCED';

        default:
            return 'BALANCED';
    }
};

// ============================================================
// MARKET CONFIRMATION
// ============================================================

const calculateMarketQuality = (
    consistency: number,
    recentConsistency: number,
    trendStrength: number,
    choppiness: number,
    recentTrendStrength: number
): number => {
    const directionalQuality =
        consistency * 0.30;

    const recentQuality =
        recentConsistency * 0.25;

    const trendQuality =
        trendStrength * 0.15;

    const recentTrendQuality =
        recentTrendStrength * 0.15;

    const antiChopQuality =
        (
            100 -
            choppiness
        ) * 0.15;

    return Math.round(
        clamp(
            directionalQuality +
                recentQuality +
                trendQuality +
                recentTrendQuality +
                antiChopQuality,
            0,
            100
        )
    );
};

// ============================================================
// MAIN MARKET ANALYSIS
// ============================================================

export const analyzeMarket = (
    rawTicks: number[]
): MarketAnalysis => {
    const ticks =
        cleanTicks(
            rawTicks
        );

    // --------------------------------------------------------
    // HARD DATA GATE
    // --------------------------------------------------------

    if (
        ticks.length <
        MINIMUM_TICKS
    ) {
        return {
            state:
                'INSUFFICIENT_DATA',

            direction:
                'FLAT',

            momentum: 0,

            recentMomentum: 0,

            trendStrength: 0,

            volatility: 0,

            consecutiveUp: 0,

            consecutiveDown: 0,

            priceChange: 0,

            normalizedPriceChange: 0,

            confidence: 0,

            volatilityLevel:
                'LOW',

            tickCount:
                ticks.length,

            directionalConsistency:
                0,

            recentDirectionalConsistency:
                0,

            reversalStrength: 0,

            marketQuality: 0,

            isChoppy: false,

            isConfirmed: false,

            reasons: [
                `Waiting for at least ${MINIMUM_TICKS} valid ticks.`,
                `Current valid ticks: ${ticks.length}.`,
                'No strategy can be confirmed yet.',
            ],
        };
    }

    // --------------------------------------------------------
    // CALCULATE RAW DATA
    // --------------------------------------------------------

    const changes =
        getPriceChanges(
            ticks
        );

    const normalizedChanges =
        getNormalizedChanges(
            ticks
        );

    const firstPrice =
        ticks[0];

    const lastPrice =
        ticks[
            ticks.length - 1
        ];

    const priceChange =
        lastPrice -
        firstPrice;

    const normalizedPriceChange =
        firstPrice !== 0
            ? (
                  priceChange /
                  Math.abs(
                      firstPrice
                  )
              ) * 100
            : 0;

    const direction =
        calculateDirection(
            priceChange
        );

    const recentDirection =
        calculateRecentDirection(
            changes
        );

    // --------------------------------------------------------
    // MOVEMENT
    // --------------------------------------------------------

    const consecutive =
        calculateConsecutiveMovement(
            changes
        );

    const consistency =
        calculateDirectionalConsistency(
            changes
        );

    const recentChanges =
        changes.slice(
            -Math.min(
                RECENT_WINDOW,
                changes.length
            )
        );

    const recentConsistency =
        calculateDirectionalConsistency(
            recentChanges
        );

    const momentum =
        calculateMomentum(
            normalizedChanges
        );

    const recentMomentum =
        calculateRecentMomentum(
            normalizedChanges
        );

    // --------------------------------------------------------
    // TREND
    // --------------------------------------------------------

    const trendStrength =
        calculateTrendStrength(
            ticks,
            changes,
            consistency
        );

    const recentTrendStrength =
        calculateRecentTrendStrength(
            normalizedChanges
        );

    // --------------------------------------------------------
    // VOLATILITY
    // --------------------------------------------------------

    const volatility =
        calculateVolatility(
            ticks
        );

    const volatilityLevel =
        classifyVolatility(
            volatility
        );

    // --------------------------------------------------------
    // REVERSAL
    // --------------------------------------------------------

    const reversal =
        calculateReversalStrength(
            normalizedChanges
        );

    const reversalStrength =
        Math.max(
            reversal.up,
            reversal.down
        );

    // --------------------------------------------------------
    // CHOP
    // --------------------------------------------------------

    const fullChoppiness =
        calculateChoppiness(
            normalizedChanges
        );

    const recentChoppiness =
        calculateChoppiness(
            normalizedChanges.slice(
                -Math.min(
                    RECENT_WINDOW,
                    normalizedChanges.length
                )
            )
        );

    const choppiness =
        Math.round(
            (
                fullChoppiness *
                0.45
            ) +
            (
                recentChoppiness *
                0.55
            )
        );

    const isChoppy =
        choppiness >=
            MAX_CHOPPY_SCORE ||
        (
            recentChoppiness >=
                65 &&
            recentConsistency <
                50
        );

    // --------------------------------------------------------
    // MARKET QUALITY
    // --------------------------------------------------------

    const marketQuality =
        calculateMarketQuality(
            consistency,
            recentConsistency,
            trendStrength,
            choppiness,
            recentTrendStrength
        );

    // --------------------------------------------------------
    // REASONS
    // --------------------------------------------------------

    const reasons: string[] =
        [];

    let state:
        ScannerMarketState =
        'RANGE';

    let confidence =
        45;

    // ========================================================
    // STRONG REVERSAL UP
    // ========================================================

    if (
        reversal.up >=
            REVERSAL_THRESHOLD &&
        recentDirection ===
            'UP' &&
        recentMomentum >= 50 &&
        !isChoppy
    ) {
        state =
            'REVERSAL_UP';

        confidence =
            50 +
            reversal.up * 0.25 +
            recentMomentum * 0.15 +
            recentConsistency * 0.10;

        reasons.push(
            'Potential upward reversal detected.'
        );

        reasons.push(
            `Reversal strength: ${Math.round(
                reversal.up
            )}%.`
        );
    }

    // ========================================================
    // STRONG REVERSAL DOWN
    // ========================================================

    else if (
        reversal.down >=
            REVERSAL_THRESHOLD &&
        recentDirection ===
            'DOWN' &&
        recentMomentum >= 50 &&
        !isChoppy
    ) {
        state =
            'REVERSAL_DOWN';

        confidence =
            50 +
            reversal.down * 0.25 +
            recentMomentum * 0.15 +
            recentConsistency * 0.10;

        reasons.push(
            'Potential downward reversal detected.'
        );

        reasons.push(
            `Reversal strength: ${Math.round(
                reversal.down
            )}%.`
        );
    }

    // ========================================================
    // MOMENTUM UP
    // ========================================================

    else if (
        direction === 'UP' &&
        recentDirection === 'UP' &&
        momentum >=
            MOMENTUM_THRESHOLD &&
        recentMomentum >=
            MOMENTUM_THRESHOLD &&
        consecutive.up >= 3 &&
        consistency >= 60 &&
        recentConsistency >= 55 &&
        !isChoppy
    ) {
        state =
            'MOMENTUM_UP';

        confidence =
            45 +
            momentum * 0.20 +
            recentMomentum * 0.25 +
            consistency * 0.10 +
            recentConsistency *
                0.10 +
            trendStrength * 0.10;

        reasons.push(
            'Strong upward momentum detected.'
        );

        reasons.push(
            `${consecutive.up} consecutive upward ticks.`
        );
    }

    // ========================================================
    // MOMENTUM DOWN
    // ========================================================

    else if (
        direction === 'DOWN' &&
        recentDirection === 'DOWN' &&
        momentum >=
            MOMENTUM_THRESHOLD &&
        recentMomentum >=
            MOMENTUM_THRESHOLD &&
        consecutive.down >= 3 &&
        consistency >= 60 &&
        recentConsistency >= 55 &&
        !isChoppy
    ) {
        state =
            'MOMENTUM_DOWN';

        confidence =
            45 +
            momentum * 0.20 +
            recentMomentum * 0.25 +
            consistency * 0.10 +
            recentConsistency *
                0.10 +
            trendStrength * 0.10;

        reasons.push(
            'Strong downward momentum detected.'
        );

        reasons.push(
            `${consecutive.down} consecutive downward ticks.`
        );
    }

    // ========================================================
    // UPTREND
    // ========================================================

    else if (
        direction === 'UP' &&
        recentDirection === 'UP' &&
        trendStrength >=
            TREND_THRESHOLD &&
        recentTrendStrength >=
            50 &&
        consistency >= 50 &&
        recentConsistency >= 50 &&
        !isChoppy
    ) {
        state =
            'UPTREND';

        confidence =
            42 +
            trendStrength * 0.25 +
            recentTrendStrength *
                0.20 +
            consistency * 0.15 +
            recentConsistency *
                0.10;

        reasons.push(
            'Market is showing a sustained upward trend.'
        );
    }

    // ========================================================
    // DOWNTREND
    // ========================================================

    else if (
        direction === 'DOWN' &&
        recentDirection === 'DOWN' &&
        trendStrength >=
            TREND_THRESHOLD &&
        recentTrendStrength >=
            50 &&
        consistency >= 50 &&
        recentConsistency >= 50 &&
        !isChoppy
    ) {
        state =
            'DOWNTREND';

        confidence =
            42 +
            trendStrength * 0.25 +
            recentTrendStrength *
                0.20 +
            consistency * 0.15 +
            recentConsistency *
                0.10;

        reasons.push(
            'Market is showing a sustained downward trend.'
        );
    }

    // ========================================================
    // CHOPPY
    // ========================================================

    else if (
        isChoppy
    ) {
        state =
            'CHOPPY';

        confidence =
            25 +
            (
                100 -
                choppiness
            ) * 0.15;

        reasons.push(
            'Market movement is inconsistent and noisy.'
        );

        reasons.push(
            `Choppiness: ${choppiness}%.`
        );

        reasons.push(
            'Trading signal blocked by scanner safety filter.'
        );
    }

    // ========================================================
    // RANGE
    // ========================================================

    else {
        state =
            'RANGE';

        confidence =
            42 +
            (
                100 -
                consistency
            ) * 0.10 +
            (
                100 -
                trendStrength
            ) * 0.10;

        reasons.push(
            'No dominant directional condition detected.'
        );
    }

    // ========================================================
    // CONFIDENCE ADJUSTMENTS
    // ========================================================

    if (
        isChoppy
    ) {
        confidence -= 15;
    }

    if (
        recentMomentum <
        40
    ) {
        confidence -= 5;
    }

    if (
        recentConsistency <
        MINIMUM_DIRECTIONAL_CONSISTENCY
    ) {
        confidence -= 5;
    }

    if (
        marketQuality <
        MINIMUM_MARKET_QUALITY
    ) {
        confidence -= 5;
    }

    // If the full direction and recent direction disagree,
    // reduce confidence unless this is explicitly a reversal.
    const directionConflict =
        direction !== 'FLAT' &&
        recentDirection !== 'FLAT' &&
        direction !==
            recentDirection;

    if (
        directionConflict &&
        state !== 'REVERSAL_UP' &&
        state !== 'REVERSAL_DOWN'
    ) {
        confidence -= 10;

        reasons.push(
            'Recent direction conflicts with the broader movement.'
        );
    }

    confidence =
        Math.round(
            clamp(
                confidence,
                0,
                99
            )
        );

    // ========================================================
    // MARKET CONFIRMATION
    // ========================================================

    const isConfirmed =
        state !==
            'INSUFFICIENT_DATA' &&
        !isChoppy &&
        confidence >=
            MINIMUM_SCAN_CONFIDENCE &&
        marketQuality >=
            MINIMUM_MARKET_QUALITY &&
        recentConsistency >=
            MINIMUM_DIRECTIONAL_CONSISTENCY;

    // ========================================================
    // GENERAL INFORMATION
    // ========================================================

    reasons.push(
        `Momentum: ${Math.round(
            momentum
        )}%.`
    );

    reasons.push(
        `Recent momentum: ${Math.round(
            recentMomentum
        )}%.`
    );

    reasons.push(
        `Trend strength: ${Math.round(
            trendStrength
        )}%.`
    );

    reasons.push(
        `Recent trend strength: ${Math.round(
            recentTrendStrength
        )}%.`
    );

    reasons.push(
        `Directional consistency: ${Math.round(
            consistency
        )}%.`
    );

    reasons.push(
        `Recent directional consistency: ${Math.round(
            recentConsistency
        )}%.`
    );

    reasons.push(
        `Volatility: ${Math.round(
            volatility
        )}% (${volatilityLevel}).`
    );

    reasons.push(
        `Market quality: ${marketQuality}%.`
    );

    reasons.push(
        `Confidence: ${confidence}%.`
    );

    reasons.push(
        `Full direction: ${direction}.`
    );

    reasons.push(
        `Recent direction: ${recentDirection}.`
    );

    if (
        priceChange !== 0
    ) {
        reasons.push(
            `Net direction: ${direction}.`
        );
    }

    if (
        isChoppy
    ) {
        reasons.push(
            'Scanner safety filter: CHOPPY market.'
        );
    }

    if (
        isConfirmed
    ) {
        reasons.push(
            'Market conditions passed the scanner confirmation filters.'
        );
    } else {
        reasons.push(
            'Market conditions are not strong enough for confirmation.'
        );
    }

    return {
        state,

        direction,

        momentum:
            Math.round(
                clamp(
                    momentum,
                    0,
                    100
                )
            ),

        recentMomentum:
            Math.round(
                clamp(
                    recentMomentum,
                    0,
                    100
                )
            ),

        trendStrength:
            Math.round(
                clamp(
                    trendStrength,
                    0,
                    100
                )
            ),

        volatility:
            Math.round(
                clamp(
                    volatility,
                    0,
                    100
                )
            ),

        consecutiveUp:
            consecutive.up,

        consecutiveDown:
            consecutive.down,

        priceChange,

        normalizedPriceChange:
            Number(
                normalizedPriceChange.toFixed(
                    6
                )
            ),

        confidence,

        volatilityLevel,

        tickCount:
            ticks.length,

        directionalConsistency:
            Math.round(
                clamp(
                    consistency,
                    0,
                    100
                )
            ),

        recentDirectionalConsistency:
            Math.round(
                clamp(
                    recentConsistency,
                    0,
                    100
                )
            ),

        reversalStrength:
            Math.round(
                clamp(
                    reversalStrength,
                    0,
                    100
                )
            ),

        marketQuality,

        isChoppy,

        isConfirmed,

        reasons,
    };
};

// ============================================================
// DIRECTION COMPATIBILITY
// ============================================================

const calculateDirectionCompatibility = (
    strategyDirection:
        AIStrategy['marketProfile']['preferredDirection'],
    analysisDirection:
        MarketDirection
): number => {
    if (
        strategyDirection ===
        'BOTH'
    ) {
        return 100;
    }

    if (
        strategyDirection ===
        'NEUTRAL'
    ) {
        return (
            analysisDirection ===
            'FLAT'
                ? 100
                : 70
        );
    }

    if (
        strategyDirection ===
            'UP' &&
        analysisDirection ===
            'UP'
    ) {
        return 100;
    }

    if (
        strategyDirection ===
            'DOWN' &&
        analysisDirection ===
            'DOWN'
    ) {
        return 100;
    }

    return 20;
};

// ============================================================
// VOLATILITY COMPATIBILITY
// ============================================================

const calculateVolatilityCompatibility = (
    preferred:
        AIStrategy['marketProfile']['preferredVolatility'],
    actual:
        VolatilityLevel
): number => {
    if (
        preferred ===
        'ANY'
    ) {
        return 100;
    }

    if (
        preferred === actual
    ) {
        return 100;
    }

    if (
        preferred === 'MEDIUM' &&
        (
            actual === 'LOW' ||
            actual === 'HIGH'
        )
    ) {
        return 70;
    }

    if (
        preferred === 'LOW' &&
        actual === 'MEDIUM'
    ) {
        return 60;
    }

    if (
        preferred === 'HIGH' &&
        actual === 'MEDIUM'
    ) {
        return 65;
    }

    return 35;
};

// ============================================================
// BIAS COMPATIBILITY
// ============================================================

const calculateBiasCompatibility = (
    strategyBias:
        AIStrategy['marketProfile']['bias'],
    analysis:
        MarketAnalysis
): number => {
    const marketBias =
        getMarketBias(
            analysis
        );

    if (
        strategyBias ===
        marketBias
    ) {
        return 100;
    }

    if (
        strategyBias ===
        'BALANCED'
    ) {
        if (
            marketBias ===
                'RANGE' ||
            marketBias ===
                'TREND'
        ) {
            return 85;
        }

        return 70;
    }

    if (
        strategyBias ===
        'RECOVERY'
    ) {
        if (
            analysis.state ===
                'RANGE' ||
            analysis.state ===
                'REVERSAL_UP' ||
            analysis.state ===
                'REVERSAL_DOWN'
        ) {
            return 80;
        }

        return 60;
    }

    if (
        strategyBias ===
        'ACCUMULATION'
    ) {
        if (
            analysis.volatilityLevel ===
            'LOW'
        ) {
            return 85;
        }

        return 60;
    }

    return 45;
};

// ============================================================
// STATE COMPATIBILITY
// ============================================================

const calculateStateCompatibility = (
    strategy:
        AIStrategy,
    analysis:
        MarketAnalysis
): number => {
    const bias =
        strategy.marketProfile
            .bias;

    switch (
        analysis.state
    ) {
        case 'MOMENTUM_UP':
        case 'MOMENTUM_DOWN':
            if (
                bias ===
                    'MOMENTUM' ||
                bias ===
                    'TREND'
            ) {
                return 100;
            }

            if (
                bias ===
                'BALANCED'
            ) {
                return 75;
            }

            return 45;

        case 'UPTREND':
        case 'DOWNTREND':
            if (
                bias ===
                    'TREND' ||
                bias ===
                    'MOMENTUM'
            ) {
                return 100;
            }

            if (
                bias ===
                'BALANCED'
            ) {
                return 80;
            }

            return 55;

        case 'REVERSAL_UP':
        case 'REVERSAL_DOWN':
            if (
                bias ===
                'REVERSAL'
            ) {
                return 100;
            }

            if (
                bias ===
                'BALANCED'
            ) {
                return 75;
            }

            return 45;

        case 'RANGE':
            if (
                bias ===
                    'RANGE' ||
                bias ===
                    'BALANCED'
            ) {
                return 100;
            }

            if (
                bias ===
                'ACCUMULATION'
            ) {
                return 85;
            }

            return 50;

        case 'CHOPPY':
            if (
                bias ===
                    'BALANCED' ||
                bias ===
                    'RECOVERY'
            ) {
                return 60;
            }

            return 20;

        default:
            return 0;
    }
};

// ============================================================
// RISK COMPATIBILITY
// ============================================================

const calculateRiskCompatibility = (
    risk:
        AIStrategy['risk'],
    analysis:
        MarketAnalysis
): number => {
    switch (risk) {
        case 'LOW':
            if (
                analysis.volatilityLevel ===
                'LOW'
            ) {
                return 100;
            }

            if (
                analysis.volatilityLevel ===
                'MEDIUM'
            ) {
                return 75;
            }

            return 35;

        case 'MEDIUM':
            if (
                analysis.volatilityLevel ===
                'MEDIUM'
            ) {
                return 100;
            }

            if (
                analysis.volatilityLevel ===
                'LOW'
            ) {
                return 90;
            }

            return 60;

        case 'HIGH':
            if (
                analysis.momentum >=
                65
            ) {
                return 100;
            }

            if (
                analysis.volatilityLevel ===
                'HIGH'
            ) {
                return 85;
            }

            return 65;

        default:
            return 50;
    }
};

// ============================================================
// STRATEGY COMPATIBILITY
// ============================================================

export const calculateMarketCompatibility = (
    strategy:
        AIStrategy,
    analysis:
        MarketAnalysis
): number => {
    if (
        analysis.state ===
        'INSUFFICIENT_DATA'
    ) {
        return 0;
    }

    // Hard safety block.
    if (
        analysis.isChoppy
    ) {
        return Math.min(
            49,
            calculateBaseCompatibility(
                strategy,
                analysis
            )
        );
    }

    return calculateBaseCompatibility(
        strategy,
        analysis
    );
};

// ============================================================
// BASE COMPATIBILITY
// ============================================================

const calculateBaseCompatibility = (
    strategy:
        AIStrategy,
    analysis:
        MarketAnalysis
): number => {
    const biasScore =
        calculateBiasCompatibility(
            strategy
                .marketProfile
                .bias,
            analysis
        );

    const directionScore =
        calculateDirectionCompatibility(
            strategy
                .marketProfile
                .preferredDirection,
            analysis.direction
        );

    const volatilityScore =
        calculateVolatilityCompatibility(
            strategy
                .marketProfile
                .preferredVolatility,
            analysis.volatilityLevel
        );

    const stateScore =
        calculateStateCompatibility(
            strategy,
            analysis
        );

    const riskScore =
        calculateRiskCompatibility(
            strategy.risk,
            analysis
        );

    const confidenceScore =
        analysis.confidence;

    const qualityScore =
        analysis.marketQuality;

    // --------------------------------------------------------
    // WEIGHTING
    // --------------------------------------------------------
    //
    // Market state     23%
    // Strategy bias    23%
    // Direction        18%
    // Volatility       10%
    // Risk              8%
    // Confidence       10%
    // Quality           8%
    //
    // --------------------------------------------------------

    const score =
        stateScore * 0.23 +
        biasScore * 0.23 +
        directionScore * 0.18 +
        volatilityScore * 0.10 +
        riskScore * 0.08 +
        confidenceScore * 0.10 +
        qualityScore * 0.08;

    return Math.round(
        clamp(
            score,
            0,
            99
        )
    );
};

// ============================================================
// STRATEGY REASONS
// ============================================================

const buildStrategyReasons = (
    strategy:
        AIStrategy,
    analysis:
        MarketAnalysis,
    score: number
): string[] => {
    const reasons: string[] =
        [];

    reasons.push(
        `Market state: ${analysis.state}.`
    );

    reasons.push(
        `Strategy bias: ${strategy.marketProfile.bias}.`
    );

    reasons.push(
        `Direction preference: ${strategy.marketProfile.preferredDirection}.`
    );

    reasons.push(
        `Volatility preference: ${strategy.marketProfile.preferredVolatility}.`
    );

    reasons.push(
        `Required confidence: ${strategy.marketProfile.minimumConfidence}%.`
    );

    reasons.push(
        `Market confidence: ${analysis.confidence}%.`
    );

    reasons.push(
        `Market quality: ${analysis.marketQuality}%.`
    );

    reasons.push(
        `Compatibility score: ${score}%.`
    );

    if (
        analysis.state ===
        'INSUFFICIENT_DATA'
    ) {
        reasons.push(
            'Strategy unavailable until sufficient live ticks are collected.'
        );
    }

    if (
        analysis.confidence <
        strategy.marketProfile
            .minimumConfidence
    ) {
        reasons.push(
            'Market confidence is below this strategy profile minimum.'
        );
    }

    if (
        analysis.marketQuality <
        MINIMUM_MARKET_QUALITY
    ) {
        reasons.push(
            'Market quality is below the scanner safety threshold.'
        );
    }

    if (
        analysis.isChoppy
    ) {
        reasons.push(
            'Strategy blocked by choppy-market safety filter.'
        );
    }

    if (
        score <
        MINIMUM_STRATEGY_SCORE
    ) {
        reasons.push(
            `Compatibility score is below the ${MINIMUM_STRATEGY_SCORE}% minimum.`
        );
    }

    return reasons;
};

// ============================================================
// RANK ALL 30 STRATEGIES
// ============================================================

export const rankStrategies = (
    analysis:
        MarketAnalysis
): StrategyCompatibility[] => {
    // IMPORTANT:
    //
    // We still return all 30 strategy profiles so the UI can
    // display 30/30.
    //
    // But during insufficient data EVERY strategy is marked
    // ineligible and has a score of 0.
    //
    // This prevents the UI from treating a profile as a
    // genuine winner when no market signal exists.
    //

    return AI_STRATEGIES
        .map(
            strategy => {
                if (
                    analysis.state ===
                    'INSUFFICIENT_DATA'
                ) {
                    return {
                        strategy,

                        score: 0,

                        eligible: false,

                        reasons:
                            buildStrategyReasons(
                                strategy,
                                analysis,
                                0
                            ),
                    };
                }

                const score =
                    calculateMarketCompatibility(
                        strategy,
                        analysis
                    );

                const confidenceEligible =
                    analysis.confidence >=
                    strategy
                        .marketProfile
                        .minimumConfidence;

                const qualityEligible =
                    analysis.marketQuality >=
                    MINIMUM_MARKET_QUALITY;

                const minimumScore =
                    score >=
                    MINIMUM_STRATEGY_SCORE;

                const directionalEligible =
                    analysis.direction !==
                        'FLAT' ||
                    strategy
                        .marketProfile
                        .preferredDirection ===
                        'NEUTRAL' ||
                    strategy
                        .marketProfile
                        .preferredDirection ===
                        'BOTH';

                const choppyBlocked =
                    analysis.isChoppy;

                const marketConfirmed =
                    analysis.isConfirmed;

                const eligible =
                    confidenceEligible &&
                    qualityEligible &&
                    minimumScore &&
                    directionalEligible &&
                    marketConfirmed &&
                    !choppyBlocked;

                return {
                    strategy,

                    score,

                    eligible,

                    reasons:
                        buildStrategyReasons(
                            strategy,
                            analysis,
                            score
                        ),
                };
            }
        )
        .sort(
            (
                a,
                b
            ) =>
                b.score -
                a.score
        );
};

// ============================================================
// COMPLETE SCAN
// ============================================================

export const scanMarket = (
    ticks: number[]
): ScannerResult => {
    const analysis =
        analyzeMarket(
            ticks
        );

    const rankedStrategies =
        rankStrategies(
            analysis
        );

    // --------------------------------------------------------
    // HARD STOP
    // --------------------------------------------------------
    //
    // No strategy is allowed to become a winner when the
    // market itself is not confirmed.
    //

    if (
        !analysis.isConfirmed
    ) {
        return {
            analysis,

            rankedStrategies,

            bestStrategy:
                undefined,

            bestScore: 0,

            secondBestScore: 0,

            winnerMargin: 0,

            strategyConfidence: 0,

            scanReady: false,

            winnerConfirmed: false,
        };
    }

    const eligibleStrategies =
        rankedStrategies.filter(
            result =>
                result.eligible
        );

    const best =
        eligibleStrategies[0];

    const secondBest =
        eligibleStrategies[1];

    // No eligible strategy.
    if (!best) {
        return {
            analysis,

            rankedStrategies,

            bestStrategy:
                undefined,

            bestScore: 0,

            secondBestScore: 0,

            winnerMargin: 0,

            strategyConfidence: 0,

            scanReady: false,

            winnerConfirmed: false,
        };
    }

    const bestScore =
        best.score;

    const secondBestScore =
        secondBest?.score || 0;

    const winnerMargin =
        bestScore -
        secondBestScore;

    // --------------------------------------------------------
    // MARGIN CONFIDENCE
    // --------------------------------------------------------

    const marginConfidence =
        clamp(
            (
                winnerMargin /
                MINIMUM_WINNER_MARGIN
            ) * 100,
            0,
            100
        );

    // --------------------------------------------------------
    // SCORE CONFIDENCE
    // --------------------------------------------------------

    const scoreConfidence =
        bestScore;

    // --------------------------------------------------------
    // STRATEGY CONFIDENCE
    // --------------------------------------------------------

    const strategyConfidence =
        Math.round(
            clamp(
                scoreConfidence *
                    0.70 +
                    marginConfidence *
                        0.30,
                0,
                99
            )
        );

    // --------------------------------------------------------
    // WINNER CONFIRMATION
    // --------------------------------------------------------

    const winnerConfirmed =
        Boolean(
            best &&
            analysis.isConfirmed &&
            analysis.marketQuality >=
                STRONG_MARKET_QUALITY &&
            bestScore >=
                MINIMUM_STRATEGY_SCORE &&
            winnerMargin >=
                MINIMUM_WINNER_MARGIN &&
            strategyConfidence >=
                MINIMUM_SCAN_CONFIDENCE
        );

    return {
        analysis,

        rankedStrategies,

        bestStrategy:
            winnerConfirmed
                ? best.strategy
                : undefined,

        bestScore,

        secondBestScore,

        winnerMargin,

        strategyConfidence,

        scanReady:
            winnerConfirmed,

        winnerConfirmed,
    };
};

// ============================================================
// TOP STRATEGY HELPER
// ============================================================

export const getBestStrategy = (
    ticks: number[]
): AIStrategy | undefined => {
    const result =
        scanMarket(
            ticks
        );

    return result.bestStrategy;
};

// ============================================================
// TOP N STRATEGIES
// ============================================================

export const getTopStrategies = (
    ticks: number[],
    count = 5
): StrategyCompatibility[] => {
    const result =
        scanMarket(
            ticks
        );

    return result.rankedStrategies
        .filter(
            candidate =>
                candidate.eligible
        )
        .slice(
            0,
            Math.max(
                1,
                count
            )
        );
};

// ============================================================
// SCANNER STATUS
// ============================================================

export const isScannerReady = (
    ticks: number[]
): boolean => {
    const result =
        scanMarket(
            ticks
        );

    return result.scanReady;
};

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default analyzeMarket;
