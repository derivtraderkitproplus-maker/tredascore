// ============================================================
// AI SCANNER LOGIC
// ============================================================
//
// Purpose:
// - Analyze live Deriv tick history.
// - Measure direction, momentum, acceleration, trend,
//   volatility, reversal and choppiness.
// - Score all AI strategy profiles.
// - Apply hard data, quality, confidence and separation gates.
// - Never return a strategy unless the market and winner pass
//   all confirmation requirements.
//
// IMPORTANT:
// - This file does NOT connect to Deriv.
// - This file does NOT place trades.
// - This file does NOT load Blockly.
// - This file does NOT modify Quick Strategy.
//
// Pipeline:
//
// Deriv ticks
// -> analyzeMarket()
// -> rankStrategies()
// -> eligibility
// -> winner separation
// -> confirmed strategy
// -> resolve live CALL/PUT direction
//
// ============================================================

import {
    AI_STRATEGIES,
    AIStrategy,
    resolveAIStrategyDirection,
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
    acceleration: number;

    trendStrength: number;
    recentTrendStrength: number;

    volatility: number;
    volatilityLevel: VolatilityLevel;

    consecutiveUp: number;
    consecutiveDown: number;

    priceChange: number;
    normalizedPriceChange: number;

    confidence: number;
    tickCount: number;

    directionalConsistency: number;
    recentDirectionalConsistency: number;

    reversalStrength: number;
    marketQuality: number;

    choppiness: number;
    recentChoppiness: number;
    noiseLevel: number;

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

    /**
     * The original profile selected from the strategy library.
     */
    selectedProfile?: AIStrategy;

    /**
     * The strategy after resolving live market direction.
     *
     * For risefall:
     * UP -> CALL
     * DOWN -> PUT
     */
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

const MINIMUM_TICKS = 20;
const MAX_ANALYSIS_TICKS = 120;

const RECENT_WINDOW = 12;
const ACCELERATION_WINDOW = 6;

const TREND_THRESHOLD = 55;
const MOMENTUM_THRESHOLD = 65;
const REVERSAL_THRESHOLD = 60;

const LOW_VOLATILITY_MAX = 30;
const HIGH_VOLATILITY_MIN = 70;

const MINIMUM_SCAN_CONFIDENCE = 50;
const MINIMUM_WINNER_MARGIN = 8;
const MINIMUM_STRATEGY_SCORE = 55;
const MINIMUM_MARKET_QUALITY = 45;

const STRONG_MARKET_QUALITY = 65;
const MINIMUM_DIRECTIONAL_CONSISTENCY = 45;

const MAX_CHOPPY_SCORE = 58;
const MAX_NOISE_LEVEL = 70;

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
            Number.isFinite(value)
                ? value
                : minimum
        )
    );

const average = (
    values: number[]
): number => {
    if (!values.length) {
        return 0;
    }

    return values.reduce(
        (sum, value) => sum + value,
        0
    ) / values.length;
};

const safeNumber = (
    value: unknown
): number | null => {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
};

const round = (
    value: number,
    decimals = 0
): number => {
    const factor = Math.pow(
        10,
        decimals
    );

    return Math.round(
        value * factor
    ) / factor;
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
        .slice(-MAX_ANALYSIS_TICKS);
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
                current - previous
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

    return calculateDirection(
        recent.reduce(
            (sum, value) =>
                sum + value,
            0
        )
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
        let i = changes.length - 1;
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
    const directional =
        changes.filter(
            change =>
                change !== 0 &&
                Number.isFinite(change)
        );

    if (!directional.length) {
        return 0;
    }

    const positive =
        directional.filter(
            change => change > 0
        ).length;

    const negative =
        directional.filter(
            change => change < 0
        ).length;

    return clamp(
        (
            Math.max(
                positive,
                negative
            ) /
            directional.length
        ) * 100,
        0,
        100
    );
};

// ============================================================
// MOMENTUM
// ============================================================

const calculateMomentum = (
    changes: number[]
): number => {
    if (!changes.length) {
        return 0;
    }

    const directional =
        changes.filter(
            change =>
                change !== 0 &&
                Number.isFinite(change)
        );

    if (!directional.length) {
        return 0;
    }

    const totalMovement =
        directional.reduce(
            (sum, value) =>
                sum + Math.abs(value),
            0
        );

    if (totalMovement <= 0) {
        return 0;
    }

    const positiveMovement =
        directional
            .filter(
                change => change > 0
            )
            .reduce(
                (sum, value) =>
                    sum + value,
                0
            );

    const negativeMovement =
        directional
            .filter(
                change => change < 0
            )
            .reduce(
                (sum, value) =>
                    sum + Math.abs(value),
                0
            );

    const dominantMovement =
        Math.max(
            positiveMovement,
            negativeMovement
        );

    const directionalDominance =
        (
            dominantMovement /
            totalMovement
        ) * 100;

    const averageMovement =
        totalMovement /
        directional.length;

    const intensity =
        clamp(
            Math.sqrt(
                averageMovement
            ) * 100000,
            0,
            100
        );

    return clamp(
        directionalDominance * 0.70 +
        intensity * 0.30,
        0,
        100
    );
};

const calculateRecentMomentum = (
    changes: number[]
): number => {
    if (!changes.length) {
        return 0;
    }

    return calculateMomentum(
        changes.slice(
            -Math.min(
                RECENT_WINDOW,
                changes.length
            )
        )
    );
};

// ============================================================
// ACCELERATION
// ============================================================

const calculateAcceleration = (
    changes: number[]
): number => {
    if (
        changes.length <
        ACCELERATION_WINDOW * 2
    ) {
        return 50;
    }

    const recent =
        changes.slice(
            -ACCELERATION_WINDOW
        );

    const previous =
        changes.slice(
            -(
                ACCELERATION_WINDOW * 2
            ),
            -ACCELERATION_WINDOW
        );

    const recentMomentum =
        calculateMomentum(
            recent
        );

    const previousMomentum =
        calculateMomentum(
            previous
        );

    return round(
        clamp(
            50 +
            (
                recentMomentum -
                previousMomentum
            ) * 1.5,
            0,
            100
        )
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
        ticks[ticks.length - 1];

    const netMovement =
        Math.abs(
            lastPrice -
            firstPrice
        );

    const absoluteMovement =
        changes.reduce(
            (sum, value) =>
                sum + Math.abs(value),
            0
        );

    if (
        absoluteMovement <= 0
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

const calculateRecentTrendStrength = (
    changes: number[]
): number => {
    if (changes.length < 4) {
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
            (sum, value) =>
                sum + value,
            0
        );

    const movement =
        recent.reduce(
            (sum, value) =>
                sum + Math.abs(value),
            0
        );

    if (movement <= 0) {
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
        )
            .map(Math.abs)
            .filter(
                Number.isFinite
            );

    if (!normalized.length) {
        return 0;
    }

    const sorted =
        [...normalized].sort(
            (a, b) => a - b
        );

    const mean =
        average(normalized);

    const squaredDeviation =
        normalized.map(
            value =>
                Math.pow(
                    value - mean,
                    2
                )
        );

    const standardDeviation =
        Math.sqrt(
            average(
                squaredDeviation
            )
        );

    const p90 =
        sorted[
            Math.min(
                sorted.length - 1,
                Math.floor(
                    sorted.length * 0.90
                )
            )
        ] || 0;

    const meanComponent =
        clamp(
            mean * 1000000,
            0,
            100
        );

    const deviationComponent =
        clamp(
            standardDeviation *
                1000000,
            0,
            100
        );

    const tailComponent =
        clamp(
            p90 * 1000000,
            0,
            100
        );

    return round(
        clamp(
            meanComponent * 0.45 +
            deviationComponent * 0.25 +
            tailComponent * 0.30,
            0,
            100
        )
    );
};

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
    if (changes.length < 6) {
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
            (sum, value) =>
                sum + value,
            0
        );

    const secondMovement =
        secondHalf.reduce(
            (sum, value) =>
                sum + value,
            0
        );

    const firstMagnitude =
        firstHalf.reduce(
            (sum, value) =>
                sum + Math.abs(value),
            0
        );

    const secondMagnitude =
        secondHalf.reduce(
            (sum, value) =>
                sum + Math.abs(value),
            0
        );

    if (
        firstMagnitude <= 0 ||
        secondMagnitude <= 0 ||
        firstMovement === 0 ||
        secondMovement === 0
    ) {
        return {
            up: 0,
            down: 0,
        };
    }

    if (
        Math.sign(firstMovement) ===
        Math.sign(secondMovement)
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
    if (changes.length < 4) {
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
                directional.length - 1
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

const calculateNoiseLevel = (
    changes: number[]
): number => {
    if (changes.length < 4) {
        return 0;
    }

    const directional =
        changes.filter(
            change =>
                change !== 0 &&
                Number.isFinite(change)
        );

    if (!directional.length) {
        return 100;
    }

    let flips = 0;

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
            flips += 1;
        }
    }

    const flipRate =
        (
            flips /
            Math.max(
                1,
                directional.length - 1
            )
        ) * 100;

    const consistency =
        calculateDirectionalConsistency(
            directional
        );

    return round(
        clamp(
            flipRate * 0.60 +
            (
                100 -
                consistency
            ) * 0.40,
            0,
            100
        )
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
// MARKET QUALITY
// ============================================================

const calculateMarketQuality = (
    consistency: number,
    recentConsistency: number,
    trendStrength: number,
    recentTrendStrength: number,
    choppiness: number,
    noiseLevel: number,
    acceleration: number
): number => {
    const directionalQuality =
        consistency * 0.24;

    const recentQuality =
        recentConsistency * 0.22;

    const trendQuality =
        trendStrength * 0.14;

    const recentTrendQuality =
        recentTrendStrength * 0.14;

    const antiChopQuality =
        (
            100 -
            choppiness
        ) * 0.10;

    const antiNoiseQuality =
        (
            100 -
            noiseLevel
        ) * 0.08;

    // Acceleration is centered at 50.
    // We reward strengthening markets rather than treating
    // neutral acceleration as maximum quality.
    const accelerationQuality =
        clamp(
            acceleration,
            0,
            100
        ) * 0.08;

    return round(
        clamp(
            directionalQuality +
            recentQuality +
            trendQuality +
            recentTrendQuality +
            antiChopQuality +
            antiNoiseQuality +
            accelerationQuality,
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
        cleanTicks(rawTicks);

    if (
        ticks.length <
        MINIMUM_TICKS
    ) {
        return {
            state:
                'INSUFFICIENT_DATA',

            direction: 'FLAT',

            momentum: 0,
            recentMomentum: 0,
            acceleration: 0,

            trendStrength: 0,
            recentTrendStrength: 0,

            volatility: 0,
            volatilityLevel: 'LOW',

            consecutiveUp: 0,
            consecutiveDown: 0,

            priceChange: 0,
            normalizedPriceChange: 0,

            confidence: 0,
            tickCount: ticks.length,

            directionalConsistency: 0,
            recentDirectionalConsistency: 0,

            reversalStrength: 0,
            marketQuality: 0,

            choppiness: 0,
            recentChoppiness: 0,
            noiseLevel: 0,

            isChoppy: false,
            isConfirmed: false,

            reasons: [
                `Waiting for at least ${MINIMUM_TICKS} valid ticks.`,
                `Current valid ticks: ${ticks.length}.`,
                'No strategy can be confirmed yet.',
            ],
        };
    }

    const changes =
        getPriceChanges(ticks);

    const normalizedChanges =
        getNormalizedChanges(ticks);

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
                  Math.abs(firstPrice)
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

    const acceleration =
        calculateAcceleration(
            normalizedChanges
        );

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

    const volatility =
        calculateVolatility(
            ticks
        );

    const volatilityLevel =
        classifyVolatility(
            volatility
        );

    const reversal =
        calculateReversalStrength(
            normalizedChanges
        );

    const reversalStrength =
        Math.max(
            reversal.up,
            reversal.down
        );

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
        round(
            fullChoppiness * 0.40 +
            recentChoppiness * 0.60
        );

    const noiseLevel =
        calculateNoiseLevel(
            normalizedChanges.slice(
                -Math.min(
                    RECENT_WINDOW,
                    normalizedChanges.length
                )
            )
        );

    const isChoppy =
        choppiness >=
            MAX_CHOPPY_SCORE ||
        noiseLevel >=
            MAX_NOISE_LEVEL ||
        (
            recentChoppiness >= 65 &&
            recentConsistency < 50
        );

    const marketQuality =
        calculateMarketQuality(
            consistency,
            recentConsistency,
            trendStrength,
            recentTrendStrength,
            choppiness,
            noiseLevel,
            acceleration
        );

    const reasons: string[] = [];

    let state:
        ScannerMarketState =
        'RANGE';

    let confidence = 45;

    // ========================================================
    // REVERSAL UP
    // ========================================================

    if (
        reversal.up >=
            REVERSAL_THRESHOLD &&
        recentDirection === 'UP' &&
        recentMomentum >= 50 &&
        recentConsistency >= 50 &&
        !isChoppy
    ) {
        state =
            'REVERSAL_UP';

        confidence =
            50 +
            reversal.up * 0.25 +
            recentMomentum * 0.15 +
            recentConsistency * 0.10 +
            Math.max(
                0,
                acceleration - 50
            ) * 0.10;

        reasons.push(
            'Potential upward reversal detected.'
        );

        reasons.push(
            `Reversal strength: ${round(
                reversal.up
            )}%.`
        );
    }

    // ========================================================
    // REVERSAL DOWN
    // ========================================================

    else if (
        reversal.down >=
            REVERSAL_THRESHOLD &&
        recentDirection === 'DOWN' &&
        recentMomentum >= 50 &&
        recentConsistency >= 50 &&
        !isChoppy
    ) {
        state =
            'REVERSAL_DOWN';

        confidence =
            50 +
            reversal.down * 0.25 +
            recentMomentum * 0.15 +
            recentConsistency * 0.10 +
            Math.max(
                0,
                acceleration - 50
            ) * 0.10;

        reasons.push(
            'Potential downward reversal detected.'
        );

        reasons.push(
            `Reversal strength: ${round(
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
            momentum * 0.18 +
            recentMomentum * 0.25 +
            consistency * 0.10 +
            recentConsistency * 0.10 +
            trendStrength * 0.08 +
            Math.max(
                0,
                acceleration - 50
            ) * 0.10;

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
            momentum * 0.18 +
            recentMomentum * 0.25 +
            consistency * 0.10 +
            recentConsistency * 0.10 +
            trendStrength * 0.08 +
            Math.max(
                0,
                acceleration - 50
            ) * 0.10;

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
        recentTrendStrength >= 50 &&
        consistency >= 50 &&
        recentConsistency >= 50 &&
        !isChoppy
    ) {
        state =
            'UPTREND';

        confidence =
            42 +
            trendStrength * 0.25 +
            recentTrendStrength * 0.20 +
            consistency * 0.15 +
            recentConsistency * 0.10 +
            Math.max(
                0,
                acceleration - 50
            ) * 0.10;

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
        recentTrendStrength >= 50 &&
        consistency >= 50 &&
        recentConsistency >= 50 &&
        !isChoppy
    ) {
        state =
            'DOWNTREND';

        confidence =
            42 +
            trendStrength * 0.25 +
            recentTrendStrength * 0.20 +
            consistency * 0.15 +
            recentConsistency * 0.10 +
            Math.max(
                0,
                acceleration - 50
            ) * 0.10;

        reasons.push(
            'Market is showing a sustained downward trend.'
        );
    }

    // ========================================================
    // CHOPPY
    // ========================================================

    else if (isChoppy) {
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
            `Choppiness: ${round(
                choppiness
            )}%.`
        );

        reasons.push(
            `Noise level: ${round(
                noiseLevel
            )}%.`
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
            ) * 0.10 +
            (
                100 -
                choppiness
            ) * 0.05;

        reasons.push(
            'No dominant directional condition detected.'
        );
    }

    // ========================================================
    // CONFIDENCE ADJUSTMENTS
    // ========================================================

    if (isChoppy) {
        confidence -= 20;
    }

    if (
        recentMomentum < 40
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
        round(
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
        (
            state === 'RANGE' ||
            recentConsistency >=
                MINIMUM_DIRECTIONAL_CONSISTENCY
        );

    // ========================================================
    // REASONS
    // ========================================================

    reasons.push(
        `Momentum: ${round(
            momentum
        )}%.`
    );

    reasons.push(
        `Recent momentum: ${round(
            recentMomentum
        )}%.`
    );

    reasons.push(
        `Acceleration: ${round(
            acceleration
        )}%.`
    );

    reasons.push(
        `Trend strength: ${round(
            trendStrength
        )}%.`
    );

    reasons.push(
        `Recent trend strength: ${round(
            recentTrendStrength
        )}%.`
    );

    reasons.push(
        `Directional consistency: ${round(
            consistency
        )}%.`
    );

    reasons.push(
        `Recent directional consistency: ${round(
            recentConsistency
        )}%.`
    );

    reasons.push(
        `Volatility: ${round(
            volatility
        )}% (${volatilityLevel}).`
    );

    reasons.push(
        `Choppiness: ${round(
            choppiness
        )}%.`
    );

    reasons.push(
        `Noise level: ${round(
            noiseLevel
        )}%.`
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

    if (isConfirmed) {
        reasons.push(
            'Market conditions passed scanner confirmation filters.'
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
            round(
                clamp(
                    momentum,
                    0,
                    100
                )
            ),

        recentMomentum:
            round(
                clamp(
                    recentMomentum,
                    0,
                    100
                )
            ),

        acceleration:
            round(
                clamp(
                    acceleration,
                    0,
                    100
                )
            ),

        trendStrength:
            round(
                clamp(
                    trendStrength,
                    0,
                    100
                )
            ),

        recentTrendStrength:
            round(
                clamp(
                    recentTrendStrength,
                    0,
                    100
                )
            ),

        volatility:
            round(
                clamp(
                    volatility,
                    0,
                    100
                )
            ),

        volatilityLevel,

        consecutiveUp:
            consecutive.up,

        consecutiveDown:
            consecutive.down,

        priceChange,

        normalizedPriceChange:
            Number(
                normalizedPriceChange.toFixed(
                    8
                )
            ),

        confidence,

        tickCount:
            ticks.length,

        directionalConsistency:
            round(
                clamp(
                    consistency,
                    0,
                    100
                )
            ),

        recentDirectionalConsistency:
            round(
                clamp(
                    recentConsistency,
                    0,
                    100
                )
            ),

        reversalStrength:
            round(
                clamp(
                    reversalStrength,
                    0,
                    100
                )
            ),

        marketQuality,

        choppiness:
            round(
                clamp(
                    choppiness,
                    0,
                    100
                )
            ),

        recentChoppiness:
            round(
                clamp(
                    recentChoppiness,
                    0,
                    100
                )
            ),

        noiseLevel:
            round(
                clamp(
                    noiseLevel,
                    0,
                    100
                )
            ),

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
        AIStrategy[
            'marketProfile'
        ]['preferredDirection'],
    analysisDirection:
        MarketDirection,
    analysisState:
        ScannerMarketState
): number => {

    // BOTH means the strategy can follow the live direction.
    if (
        strategyDirection ===
        'BOTH'
    ) {
        return 100;
    }

    // NEUTRAL is used by accumulator profiles.
    if (
        strategyDirection ===
        'NEUTRAL'
    ) {
        return (
            analysisDirection ===
            'FLAT'
                ? 100
                : 85
        );
    }

    // Exact direction.
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

    // Reversal profiles are judged by the newly emerging
    // direction.
    if (
        analysisState ===
            'REVERSAL_UP' &&
        strategyDirection ===
            'UP'
    ) {
        return 90;
    }

    if (
        analysisState ===
            'REVERSAL_DOWN' &&
        strategyDirection ===
            'DOWN'
    ) {
        return 90;
    }

    return 20;
};

// ============================================================
// VOLATILITY COMPATIBILITY
// ============================================================

const calculateVolatilityCompatibility = (
    preferred:
        AIStrategy[
            'marketProfile'
        ]['preferredVolatility'],
    actual:
        VolatilityLevel
): number => {

    if (
        preferred === 'ANY'
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
        AIStrategy[
            'marketProfile'
        ]['bias'],
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
    strategy: AIStrategy,
    analysis: MarketAnalysis
): number => {

    const bias =
        strategy.marketProfile.bias;

    switch (
        analysis.state
    ) {
        case 'MOMENTUM_UP':
        case 'MOMENTUM_DOWN':

            if (
                bias === 'MOMENTUM' ||
                bias === 'TREND'
            ) {
                return 100;
            }

            if (
                bias === 'BALANCED'
            ) {
                return 75;
            }

            return 45;

        case 'UPTREND':
        case 'DOWNTREND':

            if (
                bias === 'TREND' ||
                bias === 'MOMENTUM'
            ) {
                return 100;
            }

            if (
                bias === 'BALANCED'
            ) {
                return 80;
            }

            return 55;

        case 'REVERSAL_UP':
        case 'REVERSAL_DOWN':

            if (
                bias === 'REVERSAL'
            ) {
                return 100;
            }

            if (
                bias === 'BALANCED'
            ) {
                return 75;
            }

            return 45;

        case 'RANGE':

            if (
                bias === 'RANGE' ||
                bias === 'BALANCED'
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
            return 20;

        default:
            return 0;
    }
};

// ============================================================
// RISK COMPATIBILITY
// ============================================================

const calculateRiskCompatibility = (
    risk: AIStrategyRisk,
    analysis: MarketAnalysis
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
                analysis.momentum >= 65 &&
                analysis.marketQuality >= 60
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
// BASE COMPATIBILITY
// ============================================================

const calculateBaseCompatibility = (
    strategy: AIStrategy,
    analysis: MarketAnalysis
): number => {

    const biasScore =
        calculateBiasCompatibility(
            strategy.marketProfile.bias,
            analysis
        );

    const directionScore =
        calculateDirectionCompatibility(
            strategy.marketProfile
                .preferredDirection,
            analysis.direction,
            analysis.state
        );

    const volatilityScore =
        calculateVolatilityCompatibility(
            strategy.marketProfile
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

    // State       23%
    // Bias        22%
    // Direction   18%
    // Volatility  10%
    // Risk         7%
    // Confidence  10%
    // Quality     10%
    const score =
        stateScore * 0.23 +
        biasScore * 0.22 +
        directionScore * 0.18 +
        volatilityScore * 0.10 +
        riskScore * 0.07 +
        confidenceScore * 0.10 +
        qualityScore * 0.10;

    return round(
        clamp(
            score,
            0,
            99
        )
    );
};

// ============================================================
// PUBLIC COMPATIBILITY
// ============================================================

export const calculateMarketCompatibility = (
    strategy: AIStrategy,
    analysis: MarketAnalysis
): number => {

    if (
        analysis.state ===
        'INSUFFICIENT_DATA'
    ) {
        return 0;
    }

    const baseScore =
        calculateBaseCompatibility(
            strategy,
            analysis
        );

    // Hard safety cap for noisy markets.
    if (
        analysis.isChoppy
    ) {
        return Math.min(
            49,
            baseScore
        );
    }

    // Penalize poor market quality.
    if (
        analysis.marketQuality <
        MINIMUM_MARKET_QUALITY
    ) {
        return Math.min(
            baseScore,
            54
        );
    }

    return baseScore;
};

// ============================================================
// STRATEGY REASONS
// ============================================================

const buildStrategyReasons = (
    strategy: AIStrategy,
    analysis: MarketAnalysis,
    score: number
): string[] => {

    const reasons: string[] = [];

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
        `Live market direction: ${analysis.direction}.`
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
            'Strategy blocked by choppy/noisy market safety filter.'
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
// RANK ALL STRATEGIES
// ============================================================

export const rankStrategies = (
    analysis: MarketAnalysis
): StrategyCompatibility[] => {

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
                    strategy.marketProfile
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
                    strategy.marketProfile
                        .preferredDirection ===
                        'NEUTRAL' ||
                    strategy.marketProfile
                        .preferredDirection ===
                        'BOTH';

                const marketConfirmed =
                    analysis.isConfirmed;

                const eligible =
                    confidenceEligible &&
                    qualityEligible &&
                    minimumScore &&
                    directionalEligible &&
                    marketConfirmed &&
                    !analysis.isChoppy;

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
            (a, b) =>
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
        analyzeMarket(ticks);

    const rankedStrategies =
        rankStrategies(
            analysis
        );

    // --------------------------------------------------------
    // HARD MARKET STOP
    // --------------------------------------------------------

    if (
        !analysis.isConfirmed
    ) {
        return {
            analysis,
            rankedStrategies,

            selectedProfile:
                undefined,

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

    // --------------------------------------------------------
    // ELIGIBLE STRATEGIES
    // --------------------------------------------------------

    const eligibleStrategies =
        rankedStrategies.filter(
            result =>
                result.eligible
        );

    const best =
        eligibleStrategies[0];

    const secondBest =
        eligibleStrategies[1];

    if (!best) {
        return {
            analysis,
            rankedStrategies,

            selectedProfile:
                undefined,

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
    // WINNER CONFIDENCE
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

    const scoreConfidence =
        bestScore;

    const strategyConfidence =
        round(
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

    // --------------------------------------------------------
    // RESOLVE LIVE DIRECTION
    // --------------------------------------------------------
    //
    // This does not execute anything.
    //
    // It simply changes the selected risefall profile from:
    //
    // CALL -> UP
    // PUT  -> DOWN
    //
    // based on the scanner's confirmed market direction.
    //
    // --------------------------------------------------------

    const resolvedStrategy =
        winnerConfirmed
            ? resolveAIStrategyDirection(
                  best.strategy,
                  analysis.direction
              )
            : undefined;

    return {
        analysis,
        rankedStrategies,

        selectedProfile:
            winnerConfirmed
                ? best.strategy
                : undefined,

        bestStrategy:
            resolvedStrategy,

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
// HELPERS
// ============================================================

export const getBestStrategy = (
    ticks: number[]
): AIStrategy | undefined => {

    return scanMarket(
        ticks
    ).bestStrategy;
};

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

export const isScannerReady = (
    ticks: number[]
): boolean => {

    return scanMarket(
        ticks
    ).scanReady;
};

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default analyzeMarket;
