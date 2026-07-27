// ==========================================================================
// DAILYRULES.JS — Version "live" : récupère les bougies depuis Deriv puis
// délègue l'évaluation à la logique pure (dailyRulesFromCandles.js), qui est
// la même utilisée par le backtest — garantit que le live et le backtest
// appliquent EXACTEMENT les mêmes règles.
// ==========================================================================

import { evaluateDailyRulesFromCandles } from './dailyRulesFromCandles.js';

// Granularités Deriv (en secondes)
export const GRANULARITY = {
    D1: 86400,
    H4: 14400,
    M15: 900
};

/**
 * Récupère les bougies D1/H4/M15 courantes pour `symbol` puis évalue les
 * critères Cadre & Filtre + C1/C2/C3 (avec règle de rejet).
 *
 * ⚠️ Le critère "C0.4 : pas de news majeure imminente" N'EST PAS automatisé
 * ici (pas de connexion calendrier économique dans ce bot autonome) — à
 * vérifier manuellement avant toute exécution, comme le fait l'application.
 */
export async function evaluateDailyRules(derivClient, symbol) {
    const [d1Candles, h4Candles, m15Candles] = await Promise.all([
        derivClient.getCandles(symbol, GRANULARITY.D1, 100),
        derivClient.getCandles(symbol, GRANULARITY.H4, 200),
        derivClient.getCandles(symbol, GRANULARITY.M15, 200)
    ]);

    return evaluateDailyRulesFromCandles(d1Candles, h4Candles, m15Candles);
}
