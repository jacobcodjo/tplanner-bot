// ==========================================================================
// INDEX.JS — Scanner de la Routine Daily (3C Trading Planner) sur Deriv
// ==========================================================================
// Mode par défaut : SCANNER / ALERTE UNIQUEMENT. Ce bot n'exécute AUCUN trade
// réel — il évalue les critères Cadre & Filtre + C1/C2/C3 en continu et
// t'alerte quand un setup est validé, pour que tu passes l'ordre toi-même
// (ou pour brancher l'exécution automatique plus tard, une fois la logique
// validée par un vrai backtest).
// ==========================================================================

import 'dotenv/config';
import { DerivClient } from './derivClient.js';
import { evaluateDailyRules } from './dailyRules.js';
import { logSetup, sendWebhookAlert, sendTelegramAlert } from './notify.js';

const APP_ID = process.env.DERIV_APP_ID || '1089';
const TOKEN = process.env.DERIV_API_TOKEN || '';
const SYMBOL = process.env.SYMBOL || 'R_75';
const SCAN_INTERVAL_MS = (parseInt(process.env.SCAN_INTERVAL_SECONDS, 10) || 60) * 1000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

async function runScanCycle(client) {
    try {
        const evaluation = await evaluateDailyRules(client, SYMBOL);
        logSetup(SYMBOL, evaluation);
        if (WEBHOOK_URL) await sendWebhookAlert(WEBHOOK_URL, SYMBOL, evaluation);
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            await sendTelegramAlert(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SYMBOL, evaluation);
        }
    } catch (err) {
        console.error('❌ Erreur pendant le cycle de scan :', err.message);
    }
}

async function main() {
    console.log('🤖 Scanner "Routine Daily" — 3C Trading Planner');
    console.log(`   Symbole : ${SYMBOL} | Intervalle : ${SCAN_INTERVAL_MS / 1000}s`);
    console.log('   Rappel : le critère "pas de news majeure imminente" (C0.4)');
    console.log('   n\'est PAS automatisé ici — vérifie le calendrier économique toi-même.');
    console.log('');

    const client = new DerivClient({ appId: APP_ID, token: TOKEN });
    await client.connect();

    await runScanCycle(client);
    setInterval(() => runScanCycle(client), SCAN_INTERVAL_MS);
}

main().catch((err) => {
    console.error('❌ Erreur fatale au démarrage du bot :', err);
    process.exit(1);
});
