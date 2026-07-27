// ==========================================================================
// DAILYRULESFROMCANDLES.JS — Logique pure d'évaluation des règles, à partir
// de tableaux de bougies déjà récupérés (utilisé par dailyRules.js en live
// ET par backtest.js sur des données historiques).
// ==========================================================================

import {
    detectStructureBias,
    detectBOS,
    detectOrderBlocks,
    detectFairValueGaps,
    isPriceReactingAtZone
} from './smc.js';

/**
 * Évalue les critères Cadre & Filtre + C1/C2/C3 à partir de bougies D1/H4/M15
 * déjà fournies (aucun appel réseau ici). Applique la RÈGLE DE REJET : dès
 * qu'un critère échoue, on s'arrête et on renvoie tradeAllowed:false.
 *
 * ⚠️ Le critère "C0.4 : pas de news majeure imminente" n'est pas automatisé.
 */
export function evaluateDailyRulesFromCandles(d1Candles, h4Candles, m15Candles) {
    const currentPrice = m15Candles[m15Candles.length - 1].close;
    const details = { currentPrice };

    // ----- C-1 CADRE : biais D1 clairement identifié -----
    const d1Structure = detectStructureBias(d1Candles);
    details.d1Structure = d1Structure;
    const direction = d1Structure.bias;

    if (direction === 'neutral') {
        return rejected('C-1 CADRE', d1Structure.reason, direction, details);
    }

    // ----- C0 FILTRE : POI majeur (Order Block ou FVG) sur H4, dans le sens du biais -----
    const h4OrderBlocks = detectOrderBlocks(h4Candles, direction);
    const h4FVGs = detectFairValueGaps(h4Candles, direction);
    const majorPOIs = [...h4OrderBlocks, ...h4FVGs];
    details.majorPOIs = majorPOIs;

    if (majorPOIs.length === 0) {
        return rejected('C0 FILTRE', 'Aucun Order Block ni Fair Value Gap H4 identifié dans le sens du biais D1.', direction, details);
    }

    // ----- C1 CONFLUENCE : le prix réagit ACTUELLEMENT sur un de ces POI -----
    const reactingAtPOI = isPriceReactingAtZone(currentPrice, majorPOIs);
    details.reactingAtPOI = reactingAtPOI;

    if (!reactingAtPOI) {
        return rejected('C1 CONFLUENCE', 'Le prix ne réagit pas actuellement sur un POI majeur H4.', direction, details);
    }

    // ----- C2 TRIGGER : Break of Structure confirmé sur M15 -----
    const bos = detectBOS(m15Candles, direction);
    details.bos = bos;

    if (!bos.confirmed) {
        return rejected('C2 TRIGGER', bos.reason, direction, details);
    }

    // ----- C3 ENTRÉE : retest du niveau cassé OU comblement d'un FVG M15 -----
    const m15FVGs = detectFairValueGaps(m15Candles, direction);
    const entryTolerance = Math.abs(bos.level) * 0.001;
    const entryZones = [
        { high: bos.level + entryTolerance, low: bos.level - entryTolerance },
        ...m15FVGs
    ];
    const atEntryZone = isPriceReactingAtZone(currentPrice, entryZones, 0.3);
    details.entryZones = entryZones;

    if (!atEntryZone) {
        return rejected('C3 ENTRÉE', "En attente du retest du niveau cassé ou du comblement d'un Fair Value Gap M15.", direction, details);
    }

    return {
        tradeAllowed: true,
        direction,
        rejectedAt: null,
        reason: 'Tous les critères Cadre + Filtre + C1/C2/C3 sont validés.',
        details
    };
}

function rejected(stage, reason, direction, details) {
    return { tradeAllowed: false, direction, rejectedAt: stage, reason, details };
}
