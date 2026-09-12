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
const SYMBOLS = (process.env.SYMBOLS || 'R_10,R_25,R_50,R_75,R_100,XAUUSD,EURUSD').split(',').map(s => s.trim());
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

async function main() {
    const client = new DerivClient({ appId: APP_ID, token: TOKEN });
    await client.connect();

    console.log(`\n🤖 Scan Daily sur ${SYMBOLS.length} symbole(s) : ${SYMBOLS.join(', ')}\n`);

    for (const symbol of SYMBOLS) {
        try {
            const evaluation = await evaluateDailyRules(client, symbol);
            logSetup(symbol, evaluation);

            if (WEBHOOK_URL) await sendWebhookAlert(WEBHOOK_URL, symbol, evaluation);
            if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
                await sendTelegramAlert(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, symbol, evaluation);
            }
        } catch (err) {
            console.error(`❌ Erreur lors du scan de ${symbol} :`, err.message);
        }
    }

    client.disconnect();
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Erreur pendant le cycle de scan :', err);
    process.exit(1);
});
