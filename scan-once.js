// ==========================================================================
// SCAN-ONCE.JS — Exécute UN SEUL cycle de scan puis s'arrête.
// ==========================================================================
// Contrairement à index.js (boucle infinie, pensé pour tourner en continu
// sur un ordinateur/VPS), ce script fait un aller-retour unique — c'est ce
// qu'il faut pour GitHub Actions, qui relance le script à intervalle régulier
// (voir .github/workflows/scan.yml) plutôt que de le laisser tourner en boucle.
// ==========================================================================

import 'dotenv/config';
import { DerivClient } from './derivClient.js';
import { evaluateDailyRules } from './dailyRules.js';
import { logSetup, sendWebhookAlert, sendTelegramAlert } from './notify.js';

const APP_ID = process.env.DERIV_APP_ID || '1089';
const TOKEN = process.env.DERIV_API_TOKEN || '';
const SYMBOL = process.env.SYMBOL || 'R_75';
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

async function main() {
    const client = new DerivClient({ appId: APP_ID, token: TOKEN });
    await client.connect();

    const evaluation = await evaluateDailyRules(client, SYMBOL);
    logSetup(SYMBOL, evaluation);

    if (WEBHOOK_URL) await sendWebhookAlert(WEBHOOK_URL, SYMBOL, evaluation);
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        await sendTelegramAlert(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SYMBOL, evaluation);
    }

    client.disconnect();
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Erreur pendant le cycle de scan :', err);
    process.exit(1);
});
