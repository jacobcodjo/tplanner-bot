// ==========================================================================
// SMC.JS — Détection de concepts Smart Money (Structure, BOS, Order Blocks, FVG)
// ==========================================================================
// ⚠️ IMPORTANT : ce sont des implémentations SIMPLIFIÉES et raisonnables d'un
// point de départ. La détection SMC est en partie une question d'interprétation
// même entre traders humains — backteste et ajuste ces seuils/règles avant de
// leur faire confiance. Ne remplace pas ton propre jugement de trader.
// ==========================================================================

/**
 * Détecte les points pivots (swing highs / swing lows) via une méthode de
 * fractale simple : une bougie est un swing high si son plus haut dépasse
 * celui des `lookback` bougies de chaque côté (idem pour swing low).
 */
export function findSwingPoints(candles, lookback = 2) {
    const swings = [];
    for (let i = lookback; i < candles.length - lookback; i++) {
        const current = candles[i];
        const leftSlice = candles.slice(i - lookback, i);
        const rightSlice = candles.slice(i + 1, i + 1 + lookback);

        const isSwingHigh = [...leftSlice, ...rightSlice].every(c => c.high <= current.high);
        const isSwingLow = [...leftSlice, ...rightSlice].every(c => c.low >= current.low);

        if (isSwingHigh) swings.push({ type: 'high', index: i, price: current.high, epoch: current.epoch });
        if (isSwingLow) swings.push({ type: 'low', index: i, price: current.low, epoch: current.epoch });
    }
    return swings;
}

/**
 * Détermine le biais directionnel à partir de la séquence des swings récents :
 * Higher-Highs + Higher-Lows => haussier ; Lower-Highs + Lower-Lows => baissier ;
 * sinon => neutre/range (pas de structure claire).
 */
export function detectStructureBias(candles, lookback = 2) {
    const swings = findSwingPoints(candles, lookback);
    const highs = swings.filter(s => s.type === 'high').slice(-3);
    const lows = swings.filter(s => s.type === 'low').slice(-3);

    if (highs.length < 2 || lows.length < 2) {
        return { bias: 'neutral', reason: 'Pas assez de swings identifiés pour déterminer une structure.' };
    }

    const higherHighs = highs[highs.length - 1].price > highs[highs.length - 2].price;
    const higherLows = lows[lows.length - 1].price > lows[lows.length - 2].price;
    const lowerHighs = highs[highs.length - 1].price < highs[highs.length - 2].price;
    const lowerLows = lows[lows.length - 1].price < lows[lows.length - 2].price;

    if (higherHighs && higherLows) return { bias: 'bullish', reason: 'Higher-Highs + Higher-Lows.' };
    if (lowerHighs && lowerLows) return { bias: 'bearish', reason: 'Lower-Highs + Lower-Lows.' };
    return { bias: 'neutral', reason: 'Structure mixte (pas de tendance claire).' };
}

/**
 * Break of Structure (BOS) : le prix CLÔTURE au-delà du dernier swing
 * significatif dans le sens attendu (haussier = au-dessus du dernier swing
 * high ; baissier = en-dessous du dernier swing low).
 */
export function detectBOS(candles, direction, lookback = 2) {
    const swings = findSwingPoints(candles, lookback);
    const lastCandle = candles[candles.length - 1];

    if (direction === 'bullish') {
        const lastSwingHigh = [...swings].reverse().find(s => s.type === 'high');
        if (lastSwingHigh && lastCandle.close > lastSwingHigh.price) {
            return { confirmed: true, level: lastSwingHigh.price, reason: `Clôture (${lastCandle.close}) au-dessus du dernier swing high (${lastSwingHigh.price}).` };
        }
    } else if (direction === 'bearish') {
        const lastSwingLow = [...swings].reverse().find(s => s.type === 'low');
        if (lastSwingLow && lastCandle.close < lastSwingLow.price) {
            return { confirmed: true, level: lastSwingLow.price, reason: `Clôture (${lastCandle.close}) en-dessous du dernier swing low (${lastSwingLow.price}).` };
        }
    }
    return { confirmed: false, level: null, reason: 'Aucun Break of Structure confirmé sur les dernières bougies.' };
}

/**
 * Order Blocks (simplifié) : dernière bougie de couleur opposée avant un
 * mouvement impulsif (au moins 2x le corps moyen des bougies précédentes).
 * Renvoie les zones encore "fraîches" (non re-testées depuis leur formation).
 */
export function detectOrderBlocks(candles, direction, impulseMultiplier = 2) {
    const orderBlocks = [];
    const avgBody = candles.reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / candles.length;

    for (let i = 1; i < candles.length - 1; i++) {
        const candle = candles[i];
        const next = candles[i + 1];
        const nextBody = Math.abs(next.close - next.open);
        const isImpulsive = nextBody > avgBody * impulseMultiplier;

        if (direction === 'bullish') {
            const isDownCandle = candle.close < candle.open;
            const nextIsUpImpulse = isImpulsive && next.close > next.open;
            if (isDownCandle && nextIsUpImpulse) {
                orderBlocks.push({ high: candle.high, low: candle.low, index: i, epoch: candle.epoch });
            }
        } else if (direction === 'bearish') {
            const isUpCandle = candle.close > candle.open;
            const nextIsDownImpulse = isImpulsive && next.close < next.open;
            if (isUpCandle && nextIsDownImpulse) {
                orderBlocks.push({ high: candle.high, low: candle.low, index: i, epoch: candle.epoch });
            }
        }
    }

    // Ne garde que les OB pas encore "mitigés" (le prix n'est jamais revenu dedans depuis)
    return orderBlocks.filter(ob => {
        const candlesAfter = candles.slice(ob.index + 2);
        return !candlesAfter.some(c => c.low <= ob.high && c.high >= ob.low);
    });
}

/**
 * Fair Value Gap (FVG) : écart de prix sur 3 bougies où la mèche de la 1ère
 * ne chevauche pas celle de la 3ème (déséquilibre à combler).
 */
export function detectFairValueGaps(candles, direction) {
    const gaps = [];
    for (let i = 0; i < candles.length - 2; i++) {
        const c1 = candles[i];
        const c3 = candles[i + 2];

        if (direction === 'bullish' && c1.high < c3.low) {
            gaps.push({ top: c3.low, bottom: c1.high, index: i + 1, epoch: candles[i + 1].epoch });
        } else if (direction === 'bearish' && c1.low > c3.high) {
            gaps.push({ top: c1.low, bottom: c3.high, index: i + 1, epoch: candles[i + 1].epoch });
        }
    }
    // Ne garde que les FVG pas encore comblés
    return gaps.filter(gap => {
        const candlesAfter = candles.slice(gap.index + 1);
        return !candlesAfter.some(c => c.low <= gap.top && c.high >= gap.bottom);
    });
}

/** Le prix actuel est-il en train de réagir dans une zone d'intérêt (OB ou FVG) ? */
export function isPriceReactingAtZone(currentPrice, zones, toleranceRatio = 0.15) {
    return zones.some(zone => {
        const zoneHeight = zone.high !== undefined ? (zone.high - zone.low) : (zone.top - zone.bottom);
        const top = zone.high !== undefined ? zone.high : zone.top;
        const bottom = zone.high !== undefined ? zone.low : zone.bottom;
        const tolerance = zoneHeight * toleranceRatio;
        return currentPrice <= top + tolerance && currentPrice >= bottom - tolerance;
    });
}
