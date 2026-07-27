// ==========================================================================
// NOTIFY.JS — Alertes console + webhook optionnel (Telegram, Discord, Slack...)
// ==========================================================================

export function logSetup(symbol, evaluation) {
    const timestamp = new Date().toLocaleString('fr-FR');

    if (evaluation.tradeAllowed) {
        console.log('');
        console.log('🟢 ================================================');
        console.log(`🟢  SETUP VALIDÉ — ${symbol} — ${timestamp}`);
        console.log(`🟢  Direction : ${evaluation.direction.toUpperCase()}`);
        console.log(`🟢  Prix actuel : ${evaluation.details.currentPrice}`);
        console.log(`🟢  ${evaluation.reason}`);
        console.log('🟢 ================================================');
        console.log('');
    } else {
        console.log(`⏳ [${timestamp}] ${symbol} — Rejeté à l'étape "${evaluation.rejectedAt}" : ${evaluation.reason}`);
    }
}

/**
 * Envoie une alerte vers un webhook générique (Discord/Slack-compatible :
 * un simple champ JSON "content" ou "text"). Configure WEBHOOK_URL dans .env
 * pour l'activer — sinon cette fonction ne fait rien.
 */
export async function sendWebhookAlert(webhookUrl, symbol, evaluation) {
    if (!webhookUrl || !evaluation.tradeAllowed) return;

    const message = [
        `🟢 **Setup validé — ${symbol}**`,
        `Direction : ${evaluation.direction.toUpperCase()}`,
        `Prix : ${evaluation.details.currentPrice}`,
        evaluation.reason
    ].join('\n');

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message, text: message })
        });
    } catch (err) {
        console.warn("⚠️ Échec de l'envoi de l'alerte webhook :", err.message);
    }
}

/**
 * Envoie une alerte via l'API Telegram (Bot API — différente d'un webhook
 * générique, Telegram a son propre format). Configure TELEGRAM_BOT_TOKEN et
 * TELEGRAM_CHAT_ID dans .env pour l'activer.
 */
export async function sendTelegramAlert(botToken, chatId, symbol, evaluation) {
    if (!botToken || !chatId || !evaluation.tradeAllowed) return;

    const message = [
        `🟢 *Setup validé — ${symbol}*`,
        `Direction : ${evaluation.direction.toUpperCase()}`,
        `Prix : ${evaluation.details.currentPrice}`,
        evaluation.reason
    ].join('\n');

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
        });
        const data = await response.json();
        if (!data.ok) {
            console.warn('⚠️ Telegram a refusé le message :', data.description);
        }
    } catch (err) {
        console.warn("⚠️ Échec de l'envoi de l'alerte Telegram :", err.message);
    }
}
