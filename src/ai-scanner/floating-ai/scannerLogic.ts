// ============================================================
// AI SCANNER LOGIC
// ============================================================
//
// Purpose:
// - Analyze a sequence of market ticks.
// - Detect basic market conditions.
// - Produce a market state that can later be matched
//   against the 30 AI strategy profiles.
//
// IMPORTANT:
// - This file does NOT connect to Deriv.
// - This file does NOT place trades.
// - This file does NOT load Blockly.
// - This file does NOT modify Quick Strategy.
//
// Later:
// Deriv live ticks → this module → FloatingAI.tsx
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

export type MarketAnalysis = {
    state: ScannerMarketState;

    direction: 'UP' | 'DOWN' | 'FLAT';

    momentum: number;
    trendStrength: number;
    volatility: number;

    consecutiveUp: number;
    consecutiveDown: number;

    priceChange: number;

    confidence: number;

    reasons: string[];
};

// ============================================================
// CONFIGURATION
// ============================================================

const MINIMUM_TICKS = 10;

const TREND_THRESHOLD = 0.55;
const MOMENTUM_THRESHOLD = 0.65;
const REVERSAL_THRESHOLD = 0.60;

// ============================================================
// BASIC HELPERS
// ============================================================

const clamp = (
    value: number,
    minimum: number,
    maximum: number
): number => {
    return Math.min(maximum, Math.max(minimum, value));
};

const average = (values: number[]): number => {
    if (values.length === 0) {
        return 0;
    }

    return (
        values.reduce((sum, value) => sum + value, 0) /
        values.length
    );
};

// ============================================================
// PRICE CHANGES
// ============================================================

const getPriceChanges = (ticks: number[]): number[] => {
    const changes: number[] = [];

    for (let i = 1; i < ticks.length; i += 1) {
        changes.push(ticks[i] - ticks[i - 1]);
    }

    return changes;
};

// ============================================================
// DIRECTION
// ============================================================

const calculateDirection = (
    priceChange: number
): 'UP' | 'DOWN' | 'FLAT' => {
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

    for (let i = changes.length - 1; i >= 0; i -= 1) {
        if (changes[i] > 0) {
            if (down > 0) {
                break;
            }

            up += 1;
        } else if (changes[i] < 0) {
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
// MOMENTUM
// ============================================================
//
// Measures how consistently recent ticks have moved in one
// direction.
//
// 0   = no directional momentum
// 100 = very strong directional momentum
// ============================================================

const calculateMomentum = (
    changes: number[]
): number => {
    if (changes.length === 0) {
        return 0;
    }

    const directionalMoves = changes.filter(
        change => change !== 0
    );

    if (directionalMoves.length === 0) {
        return 0;
    }

    const positiveMoves = directionalMoves.filter(
        change => change > 0
    ).length;

    const negativeMoves = directionalMoves.filter(
        change => change < 0
    ).length;

    const dominantDirection = Math.max(
        positiveMoves,
        negativeMoves
    );

    return clamp(
        (dominantDirection / directionalMoves.length) * 100,
        0,
        100
    );
};

// ============================================================
// TREND STRENGTH
// ============================================================
//
// Compares the first and second half of the observation window.
// This gives us a simple indication of whether movement is
// becoming stronger or weaker.
// ============================================================

const calculateTrendStrength = (
    ticks: number[]
): number => {
    if (ticks.length < 4) {
        return 0;
    }

    const midpoint = Math.floor(ticks.length / 2);

    const firstHalf = ticks.slice(0, midpoint);
    const secondHalf = ticks.slice(midpoint);

    const firstChange =
        firstHalf[firstHalf.length - 1] -
        firstHalf[0];

    const secondChange =
        secondHalf[secondHalf.length - 1] -
        secondHalf[0];

    const totalChange =
        ticks[ticks.length - 1] - ticks[0];

    if (totalChange === 0) {
        return 0;
    }

    const consistency =
        Math.abs(secondChange) /
        (Math.abs(firstChange) +
            Math.abs(secondChange) +
            Number.EPSILON);

    return clamp(consistency * 100, 0, 100);
};

// ============================================================
// VOLATILITY
// ============================================================
//
// This is a relative tick-movement measure.
// It is NOT a financial volatility indicator such as ATR.
// We can replace/expand this later when more market data is
// available.
// ============================================================

const calculateVolatility = (
    changes: number[]
): number => {
    if (changes.length === 0) {
        return 0;
    }

    const absoluteChanges = changes.map(change =>
        Math.abs(change)
    );

    const averageMovement = average(
        absoluteChanges
    );

    const maximumMovement = Math.max(
        ...absoluteChanges
    );

    if (maximumMovement === 0) {
        return 0;
    }

    return clamp(
        (averageMovement / maximumMovement) * 100,
        0,
        100
    );
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

    const recentWindow = changes.slice(-6);

    const firstHalf = recentWindow.slice(0, 3);
    const secondHalf = recentWindow.slice(3);

    const firstMovement = firstHalf.reduce(
        (sum, change) => sum + change,
        0
    );

    const secondMovement = secondHalf.reduce(
        (sum, change) => sum + change,
        0
    );

    let reversalUp = 0;
    let reversalDown = 0;

    if (
        firstMovement < 0 &&
        secondMovement > 0
    ) {
        reversalUp = 100;
    }

    if (
        firstMovement > 0 &&
        secondMovement < 0
    ) {
        reversalDown = 100;
    }

    return {
        up: reversalUp,
        down: reversalDown,
    };
};

// ============================================================
// MAIN MARKET ANALYSIS
// ============================================================

export const analyzeMarket = (
    ticks: number[]
): MarketAnalysis => {
    if (
        !Array.isArray(ticks) ||
        ticks.length < MINIMUM_TICKS
    ) {
        return {
            state: 'INSUFFICIENT_DATA',

            direction: 'FLAT',

            momentum: 0,
            trendStrength: 0,
            volatility: 0,

            consecutiveUp: 0,
            consecutiveDown: 0,

            priceChange: 0,

            confidence: 0,

            reasons: [
                `Waiting for at least ${MINIMUM_TICKS} ticks.`,
            ],
        };
    }

    const changes = getPriceChanges(ticks);

    const firstPrice = ticks[0];
    const lastPrice = ticks[ticks.length - 1];

    const priceChange = lastPrice - firstPrice;

    const direction =
        calculateDirection(priceChange);

    const momentum =
        calculateMomentum(changes);

    const trendStrength =
        calculateTrendStrength(ticks);

    const volatility =
        calculateVolatility(changes);

    const consecutive =
        calculateConsecutiveMovement(changes);

    const reversal =
        calculateReversalStrength(changes);

    const reasons: string[] = [];

    let state: ScannerMarketState =
        'RANGE';

    let confidence = 50;

    // ========================================================
    // MOMENTUM UP
    // ========================================================

    if (
        direction === 'UP' &&
        momentum >= MOMENTUM_THRESHOLD * 100 &&
        consecutive.up >= 3
    ) {
        state = 'MOMENTUM_UP';

        confidence =
            60 +
            momentum * 0.25 +
            trendStrength * 0.15;

        reasons.push(
            'Strong recent upward directional movement.'
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
        momentum >= MOMENTUM_THRESHOLD * 100 &&
        consecutive.down >= 3
    ) {
        state = 'MOMENTUM_DOWN';

        confidence =
            60 +
            momentum * 0.25 +
            trendStrength * 0.15;

        reasons.push(
            'Strong recent downward directional movement.'
        );

        reasons.push(
            `${consecutive.down} consecutive downward ticks.`
        );
    }

    // ========================================================
    // REVERSAL UP
    // ========================================================

    else if (
        reversal.up >= REVERSAL_THRESHOLD * 100
    ) {
        state = 'REVERSAL_UP';

        confidence = 70;

        reasons.push(
            'Recent downward movement appears to have reversed upward.'
        );
    }

    // ========================================================
    // REVERSAL DOWN
    // ========================================================

    else if (
        reversal.down >= REVERSAL_THRESHOLD * 100
    ) {
        state = 'REVERSAL_DOWN';

        confidence = 70;

        reasons.push(
            'Recent upward movement appears to have reversed downward.'
        );
    }

    // ========================================================
    // UPTREND
    // ========================================================

    else if (
        direction === 'UP' &&
        trendStrength >= TREND_THRESHOLD * 100
    ) {
        state = 'UPTREND';

        confidence =
            55 +
            trendStrength * 0.25;

        reasons.push(
            'Market is showing a sustained upward bias.'
        );
    }

    // ========================================================
    // DOWNTREND
    // ========================================================

    else if (
        direction === 'DOWN' &&
        trendStrength >= TREND_THRESHOLD * 100
    ) {
        state = 'DOWNTREND';

        confidence =
            55 +
            trendStrength * 0.25;

        reasons.push(
            'Market is showing a sustained downward bias.'
        );
    }

    // ========================================================
    // CHOPPY MARKET
    // ========================================================

    else if (
        momentum < 45 &&
        volatility > 55
    ) {
        state = 'CHOPPY';

        confidence = 35;

        reasons.push(
            'Price movement is inconsistent and noisy.'
        );
    }

    // ========================================================
    // RANGE
    // ========================================================

    else {
        state = 'RANGE';

        confidence = 45;

        reasons.push(
            'No strong directional condition detected.'
        );
    }

    // ========================================================
    // GENERAL INFORMATION
    // ========================================================

    if (volatility > 70) {
        reasons.push(
            'Tick movement is relatively volatile.'
        );
    } else if (volatility < 30) {
        reasons.push(
            'Tick movement is relatively stable.'
        );
    }

    if (priceChange !== 0) {
        reasons.push(
            `Net price direction: ${direction}.`
        );
    }

    return {
        state,

        direction,

        momentum: Math.round(
            clamp(momentum, 0, 100)
        ),

        trendStrength: Math.round(
            clamp(trendStrength, 0, 100)
        ),

        volatility: Math.round(
            clamp(volatility, 0, 100)
        ),

        consecutiveUp:
            consecutive.up,

        consecutiveDown:
            consecutive.down,

        priceChange,

        confidence: Math.round(
            clamp(confidence, 0, 99)
        ),

        reasons,
    };
};

// ============================================================
// SIMPLE STRATEGY COMPATIBILITY
// ============================================================
//
// This is intentionally generic for now.
//
// Later we will add explicit scanner metadata to AIStrategy,
// allowing every profile to define its preferred conditions.
// ============================================================

export const calculateMarketCompatibility = (
    strategy: {
        type?: string;
        risk?: 'LOW' | 'MEDIUM' | 'HIGH';
    },
    analysis: MarketAnalysis
): number => {
    if (
        analysis.state ===
        'INSUFFICIENT_DATA'
    ) {
        return 0;
    }

    let score = 50;

    // ========================================================
    // DIRECTION MATCH
    // ========================================================

    if (
        strategy.type === 'CALL' &&
        (
            analysis.state === 'UPTREND' ||
            analysis.state === 'MOMENTUM_UP' ||
            analysis.state === 'REVERSAL_UP'
        )
    ) {
        score += 20;
    }

    if (
        strategy.type === 'PUT' &&
        (
            analysis.state === 'DOWNTREND' ||
            analysis.state === 'MOMENTUM_DOWN' ||
            analysis.state === 'REVERSAL_DOWN'
        )
    ) {
        score += 20;
    }

    // ========================================================
    // RISK COMPATIBILITY
    // ========================================================

    if (
        strategy.risk === 'LOW' &&
        analysis.volatility <= 60
    ) {
        score += 10;
    }

    if (
        strategy.risk === 'MEDIUM' &&
        analysis.volatility <= 75
    ) {
        score += 8;
    }

    if (
        strategy.risk === 'HIGH' &&
        analysis.momentum >= 60
    ) {
        score += 8;
    }

    // ========================================================
    // MARKET CONFIDENCE
    // ========================================================

    score +=
        analysis.confidence * 0.12;

    return Math.round(
        clamp(score, 0, 99)
    );
};

export default analyzeMarket;
