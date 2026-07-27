// ==========================================================================
// BACKTEST.JS — Rejoue la logique Cadre & Filtre + C1/C2/C3 sur un historique
// ==========================================================================
// ⚠️ Ce backtest compte UNIQUEMENT la fréquence des setups validés dans le
// passé — il ne simule PAS de résultat en R (gain/perte), car l'application
// ne définit pas de règle de Stop Loss/Take Profit automatique : c'est toi
// qui définis ça au moment du trade. Utilise ce script pour juger si la
// fréquence des setups a du sens, pas pour estimer une rentabilité.
// ==========================================================================

import 'dotenv/config';
import { DerivClient } from './derivClient.js';
import { evaluateDailyRulesFromCandles } from './dailyRulesFromCandles.js';
import { GRANULARITY } from './dailyRules.js';

const APP_ID = process.env.DERIV_APP_ID || '1089';
const TOKEN = process.env.DERIV_API_TOKEN || '';
const SYMBOL = process.env.SYMBOL || 'R_75';

// Deriv limite généralement à 5000 bougies par requête ticks_history.
const M15_COUNT = 3000;
const H4_COUNT = 1500;
const D1_COUNT = 300;

async function main() {
    console.log(`📊 Backtest "Routine Daily" — ${SYMBOL}`);
    const client = new DerivClient({ appId: APP_ID, token: TOKEN });
    await client.connect();

    console.log('Téléchargement de l\'historique (D1, H4, M15)...');
    const [d1All, h4All, m15All] = await Promise.all([
        client.getCandles(SYMBOL, GRANULARITY.D1, D1_COUNT),
        client.getCandles(SYMBOL, GRANULARITY.H4, H4_COUNT),
        client.getCandles(SYMBOL, GRANULARITY.M15, M15_COUNT)
    ]);
    console.log(`Reçu : ${d1All.length} D1, ${h4All.length} H4, ${m15All.length} M15.`);

    let validatedCount = 0;
    let rejectionCounts = {};
    const minWindow = 60; // nombre minimal de bougies M15 avant de commencer l'évaluation

    for (let i = minWindow; i < m15All.length; i++) {
        const m15Window = m15All.slice(0, i + 1);
        const currentEpoch = m15Window[m15Window.length - 1].epoch;

        // On ne garde que les bougies D1/H4 antérieures à l'instant simulé
        // (évite le biais de "regarder dans le futur" pendant le backtest).
        const d1Window = d1All.filter(c => c.epoch <= currentEpoch);
        const h4Window = h4All.filter(c => c.epoch <= currentEpoch);
        if (d1Window.length < 10 || h4Window.length < 10) continue;

        const evaluation = evaluateDailyRulesFromCandles(d1Window, h4Window, m15Window);

        if (evaluation.tradeAllowed) {
            validatedCount++;
            const date = new Date(currentEpoch * 1000).toLocaleString('fr-FR');
            console.log(`🟢 Setup validé le ${date} — Direction : ${evaluation.direction} — Prix : ${evaluation.details.currentPrice}`);
        } else {
            rejectionCounts[evaluation.rejectedAt] = (rejectionCounts[evaluation.rejectedAt] || 0) + 1;
        }
    }

    console.log('');
    console.log('--- RÉSUMÉ DU BACKTEST ---');
    console.log(`Bougies M15 évaluées : ${m15All.length - minWindow}`);
    console.log(`Setups validés (Cadre+Filtre+C1/C2/C3) : ${validatedCount}`);
    console.log('Répartition des rejets par étape :');
    Object.entries(rejectionCounts).forEach(([stage, count]) => {
        console.log(`  - ${stage} : ${count}`);
    });

    client.disconnect();
}

main().catch((err) => {
    console.error('❌ Erreur pendant le backtest :', err);
    process.exit(1);
});
