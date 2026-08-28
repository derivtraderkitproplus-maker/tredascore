// ============================================================
// AI SCANNER LOGIC
// ============================================================
//
// Purpose:
// - Analyze a sequence of Deriv market ticks.
// - Detect market conditions.
// - Measure direction, momentum, trend, volatility and reversal.
// - Score the 30 AI strategy profiles against the current market.
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
// analyzeMarket()
//      ↓
// rankStrategies()
//      ↓
// best matching AIStrategy
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

    trendStrength: number;

    volatility: number;

    consecutiveUp: number;

    consecutiveDown: number;

    priceChange: number;

    confidence: number;

    volatilityLevel: VolatilityLevel;

    tickCount: number;

    directionalConsistency: number;

    reversalStrength: number;

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

    scanReady: boolean;
};

// ============================================================
// CONFIGURATION
// ============================================================

const MINIMUM_TICKS = 10;

const MAX_ANALYSIS_TICKS = 100;

const TREND_THRESHOLD = 55;

const MOMENTUM_THRESHOLD = 65;

const REVERSAL_THRESHOLD = 60;

const LOW_VOLATILITY_MAX = 30;

const HIGH_VOLATILITY_MIN = 70;

const MINIMUM_SCAN_CONFIDENCE = 50;

// ============================================================
// BASIC HELPERS
// ============================================================

const clamp = (
    value: number,
    minimum: number,
    maximum: number
): number => {
    return Math.min(
        maximum,
        Math.max(minimum, value)
    );
};

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
//
// Removes invalid values and prevents the scanner from being
// poisoned by malformed WebSocket data.
//
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
                value !== null
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
        changes.push(
            ticks[i] - ticks[i - 1]
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
        const change = changes[i];

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
//
// Measures how consistently ticks move in the dominant
// direction.
//
// 0   = completely mixed
// 100 = completely one-sided
//
// ============================================================

const calculateDirectionalConsistency = (
    changes: number[]
): number => {
    const directionalMoves =
        changes.filter(
            change => change !== 0
        );

    if (!directionalMoves.length) {
        return 0;
    }

    const positive =
        directionalMoves.filter(
            change => change > 0
        ).length;

    const negative =
        directionalMoves.filter(
            change => change < 0
        ).length;

    const dominant =
        Math.max(
            positive,
            negative
        );

    return clamp(
        (dominant /
            directionalMoves.length) *
            100,
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

    const directionalMoves =
        changes.filter(
            change => change !== 0
        );

    if (!directionalMoves.length) {
        return 0;
    }

    const absoluteMovement =
        directionalMoves.map(
            Math.abs
        );

    const totalMovement =
        absoluteMovement.reduce(
            (sum, value) =>
                sum + value,
            0
        );

    if (totalMovement === 0) {
        return 0;
    }

    const positiveMovement =
        directionalMoves
            .filter(
                change => change > 0
            )
            .reduce(
                (sum, value) =>
                    sum + value,
                0
            );

    const negativeMovement =
        directionalMoves
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

    return clamp(
        (dominantMovement /
            totalMovement) *
            100,
        0,
        100
    );
};

// ============================================================
// TREND STRENGTH
// ============================================================
//
// Combines:
// - net price displacement
// - directional consistency
// - second-half confirmation
//
// This is more robust than simply comparing two halves.
//
// ============================================================

const calculateTrendStrength = (
    ticks: number[],
    changes: number[],
    consistency: number
): number => {
    if (ticks.length < 4) {
        return 0;
    }

    const firstPrice = ticks[0];

    const lastPrice =
        ticks[ticks.length - 1];

    const netMovement =
        Math.abs(
            lastPrice -
                firstPrice
        );

    const absoluteMovement =
        changes
            .map(Math.abs)
            .reduce(
                (sum, value) =>
                    sum + value,
                0
            );

    if (absoluteMovement === 0) {
        return 0;
    }

    const efficiency =
        clamp(
            (netMovement /
                absoluteMovement) *
                100,
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
        ticks.slice(midpoint);

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
        Math.sign(firstChange) ===
            Math.sign(secondChange);

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
// VOLATILITY
// ============================================================
//
// Measures movement intensity relative to the observation
// window.
//
// This is a scanner score, not ATR.
//
// ============================================================

const calculateVolatility = (
    changes: number[]
): number => {
    if (!changes.length) {
        return 0;
    }

    const absoluteChanges =
        changes.map(Math.abs);

    const mean =
        average(
            absoluteChanges
        );

    if (mean === 0) {
        return 0;
    }

    const squaredDeviation =
        absoluteChanges.map(
            value =>
                Math.pow(
                    value - mean,
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
        standardDeviation /
        mean;

    const intensity =
        clamp(
            mean * 100000,
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
            intensity * 0.7 +
                irregularity * 0.3,
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
        firstHalf
            .map(Math.abs)
            .reduce(
                (sum, value) =>
                    sum + value,
                0
            );

    const secondMagnitude =
        secondHalf
            .map(Math.abs)
            .reduce(
                (sum, value) =>
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
// MARKET BIAS
// ============================================================

const getMarketBias = (
    analysis: MarketAnalysis
): AIStrategy['marketProfile']['bias'] => {
    switch (analysis.state) {
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

            trendStrength: 0,

            volatility: 0,

            consecutiveUp: 0,

            consecutiveDown: 0,

            priceChange: 0,

            confidence: 0,

            volatilityLevel:
                'LOW',

            tickCount:
                ticks.length,

            directionalConsistency:
                0,

            reversalStrength: 0,

            reasons: [
                `Waiting for at least ${MINIMUM_TICKS} valid ticks.`,
            ],
        };
    }

    const changes =
        getPriceChanges(
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

    const direction =
        calculateDirection(
            priceChange
        );

    const consecutive =
        calculateConsecutiveMovement(
            changes
        );

    const consistency =
        calculateDirectionalConsistency(
            changes
        );

    const momentum =
        calculateMomentum(
            changes
        );

    const trendStrength =
        calculateTrendStrength(
            ticks,
            changes,
            consistency
        );

    const volatility =
        calculateVolatility(
            changes
        );

    const volatilityLevel =
        classifyVolatility(
            volatility
        );

    const reversal =
        calculateReversalStrength(
            changes
        );

    const reversalStrength =
        Math.max(
            reversal.up,
            reversal.down
        );

    const reasons: string[] =
        [];

    let state:
        ScannerMarketState =
        'RANGE';

    let confidence = 45;

    // ========================================================
    // MOMENTUM UP
    // ========================================================

    if (
        direction === 'UP' &&
        momentum >=
            MOMENTUM_THRESHOLD &&
        consecutive.up >= 3 &&
        consistency >= 60
    ) {
        state =
            'MOMENTUM_UP';

        confidence =
            50 +
            momentum * 0.25 +
            consistency * 0.15 +
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
        momentum >=
            MOMENTUM_THRESHOLD &&
        consecutive.down >= 3 &&
        consistency >= 60
    ) {
        state =
            'MOMENTUM_DOWN';

        confidence =
            50 +
            momentum * 0.25 +
            consistency * 0.15 +
            trendStrength * 0.10;

        reasons.push(
            'Strong downward momentum detected.'
        );

        reasons.push(
            `${consecutive.down} consecutive downward ticks.`
        );
    }

    // ========================================================
    // REVERSAL UP
    // ========================================================

    else if (
        reversal.up >=
        REVERSAL_THRESHOLD
    ) {
        state =
            'REVERSAL_UP';

        confidence =
            60 +
            reversal.up * 0.25;

        reasons.push(
            'Downward movement has shown signs of an upward reversal.'
        );
    }

    // ========================================================
    // REVERSAL DOWN
    // ========================================================

    else if (
        reversal.down >=
        REVERSAL_THRESHOLD
    ) {
        state =
            'REVERSAL_DOWN';

        confidence =
            60 +
            reversal.down * 0.25;

        reasons.push(
            'Upward movement has shown signs of a downward reversal.'
        );
    }

    // ========================================================
    // UPTREND
    // ========================================================

    else if (
        direction === 'UP' &&
        trendStrength >=
            TREND_THRESHOLD &&
        consistency >= 50
    ) {
        state =
            'UPTREND';

        confidence =
            50 +
            trendStrength * 0.30 +
            consistency * 0.15;

        reasons.push(
            'Market is showing a sustained upward trend.'
        );
    }

    // ========================================================
    // DOWNTREND
    // ========================================================

    else if (
        direction === 'DOWN' &&
        trendStrength >=
            TREND_THRESHOLD &&
        consistency >= 50
    ) {
        state =
            'DOWNTREND';

        confidence =
            50 +
            trendStrength * 0.30 +
            consistency * 0.15;

        reasons.push(
            'Market is showing a sustained downward trend.'
        );
    }

    // ========================================================
    // CHOPPY
    // ========================================================

    else if (
        consistency < 48 &&
        volatility >= 55
    ) {
        state =
            'CHOPPY';

        confidence = 35;

        reasons.push(
            'Market movement is inconsistent and noisy.'
        );
    }

    // ========================================================
    // RANGE
    // ========================================================

    else {
        state =
            'RANGE';

        confidence =
            45 +
            (100 -
                consistency) *
                0.10;

        reasons.push(
            'No dominant directional condition detected.'
        );
    }

    // ========================================================
    // GENERAL MARKET INFORMATION
    // ========================================================

    reasons.push(
        `Momentum: ${Math.round(momentum)}%.`
    );

    reasons.push(
        `Trend strength: ${Math.round(trendStrength)}%.`
    );

    reasons.push(
        `Volatility: ${Math.round(volatility)}% (${volatilityLevel}).`
    );

    reasons.push(
        `Directional consistency: ${Math.round(consistency)}%.`
    );

    if (
        priceChange !== 0
    ) {
        reasons.push(
            `Net direction: ${direction}.`
        );
    }

    return {
        state,

        direction,

        momentum: Math.round(
            clamp(
                momentum,
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

        confidence:
            Math.round(
                clamp(
                    confidence,
                    0,
                    99
                )
            ),

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

        reversalStrength:
            Math.round(
                clamp(
                    reversalStrength,
                    0,
                    100
                )
            ),

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
        return analysisDirection ===
            'FLAT'
            ? 100
            : 75;
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
    actual: VolatilityLevel
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
        AIStrategy['marketProfile']['bias'],
    analysis: MarketAnalysis
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

    // BALANCED profiles can operate in several conditions.
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

    // Recovery strategies should not be treated as a direct
    // prediction of price direction.
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

    // Accumulator strategies prefer stable conditions.
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

    switch (analysis.state) {
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

            return 50;

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

            return 50;

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
                return 70;
            }

            return 35;

        default:
            return 0;
    }
};

// ============================================================
// RISK COMPATIBILITY
// ============================================================

const calculateRiskCompatibility = (
    risk: AIStrategy['risk'],
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
//
// This is the main bridge between the scanner and the
// 30 strategy profiles.
//
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

    const biasScore =
        calculateBiasCompatibility(
            strategy.marketProfile
                .bias,
            analysis
        );

    const directionScore =
        calculateDirectionCompatibility(
            strategy.marketProfile
                .preferredDirection,
            analysis.direction
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

    // ========================================================
    // WEIGHTING
    // ========================================================
    //
    // Market state and strategy bias are the strongest signals.
    //
    // ========================================================

    const score =
        stateScore * 0.25 +
        biasScore * 0.25 +
        directionScore * 0.20 +
        volatilityScore * 0.10 +
        riskScore * 0.08 +
        confidenceScore * 0.12;

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
    strategy: AIStrategy,
    analysis: MarketAnalysis,
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
        `Current market confidence: ${analysis.confidence}%.`
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

    return reasons;
};

// ============================================================
// RANK ALL 30 STRATEGIES
// ============================================================

export const rankStrategies = (
    analysis: MarketAnalysis
): StrategyCompatibility[] => {
    if (
        analysis.state ===
        'INSUFFICIENT_DATA'
    ) {
        return [];
    }

    return AI_STRATEGIES
        .map(
            strategy => {
                const score =
                    calculateMarketCompatibility(
                        strategy,
                        analysis
                    );

                const confidenceEligible =
                    analysis.confidence >=
                    strategy.marketProfile
                        .minimumConfidence;

                const minimumScore =
                    score >=
                    MINIMUM_SCAN_CONFIDENCE;

                const eligible =
                    confidenceEligible &&
                    minimumScore;

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
//
// This is the main function FloatingAI.tsx can call.
//
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

    const eligibleStrategies =
        rankedStrategies.filter(
            result =>
                result.eligible
        );

    const best =
        eligibleStrategies[0];

    return {
        analysis,

        rankedStrategies,

        bestStrategy:
            best?.strategy,

        bestScore:
            best?.score || 0,

        scanReady:
            Boolean(best) &&
            analysis.confidence >=
                MINIMUM_SCAN_CONFIDENCE,
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
