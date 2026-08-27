// AI Strategy Library
// 30 selectable strategy profiles built on the existing Quick Strategy engines.
//
// IMPORTANT:
// These are strategy PROFILES. They reuse the existing bot engines.
// They do not create new Blockly blocks.

export type AIStrategy = {
    id: string;
    name: string;
    description: string;

    // Existing Quick Strategy engine
    engine: string;

    // Default trading configuration
    symbol: string;
    tradetype: string;
    type: string;

    stake: number;
    durationtype: string;
    duration: number;

    profit: number;
    loss: number;

    // Used by progressive strategies
    size?: number;
    unit?: number;

    // Scanner metadata
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
};

export const AI_STRATEGIES: AIStrategy[] = [

    // ============================================================
    // CLASSIC STRATEGIES
    // ============================================================

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
    },

    // ============================================================
    // ACCUMULATOR STRATEGIES
    // ============================================================

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
    },

    {
        id: 'accumulator-dalembert',
        name: 'Accumulator D’Alembert',
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
    },

    {
        id: 'accumulator-reverse-dalembert',
        name: 'Accumulator Reverse D’Alembert',
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
    },

    {
        id: 'accumulator-dalembert-reset',
        name: 'Accumulator D’Alembert Reset',
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
    },

    {
        id: 'accumulator-reverse-dalembert-reset',
        name: 'Accumulator Reverse D’Alembert Reset',
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
    },

    // ============================================================
    // AI PROFILES
    // These are different selectable profiles using the existing
    // engines with different configurations.
    // ============================================================

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
    },
];

// ============================================================
// HELPERS
// ============================================================

export const getAIStrategy = (id: string): AIStrategy | undefined => {
    return AI_STRATEGIES.find(strategy => strategy.id === id);
};

export const getAIStrategiesByRisk = (
    risk: AIStrategy['risk']
): AIStrategy[] => {
    return AI_STRATEGIES.filter(strategy => strategy.risk === risk);
};

export const getRandomAIStrategy = (): AIStrategy => {
    return AI_STRATEGIES[
        Math.floor(Math.random() * AI_STRATEGIES.length)
    ];
};

export default AI_STRATEGIES;
