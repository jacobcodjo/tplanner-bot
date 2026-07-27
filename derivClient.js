// ==========================================================================
// DERIV CLIENT — petit wrapper autour du WebSocket API de Deriv
// Documentation officielle : https://developers.deriv.com/docs/websockets
// ==========================================================================

import WebSocket from 'ws';

const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3';

export class DerivClient {
    constructor({ appId, token }) {
        this.appId = appId;
        this.token = token;
        this.ws = null;
        this.reqId = 0;
        this.pending = new Map(); // req_id -> { resolve, reject }
        this.authorized = false;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(`${DERIV_WS_URL}?app_id=${this.appId}`);

            this.ws.on('open', async () => {
                console.log('✅ Connecté au WebSocket Deriv.');
                try {
                    if (this.token) {
                        await this._send({ authorize: this.token });
                        this.authorized = true;
                        console.log('🔑 Authentifié avec succès (token API).');
                    } else {
                        console.log('ℹ️  Aucun token fourni : mode lecture seule (données publiques uniquement).');
                    }
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });

            this.ws.on('message', (raw) => this._handleMessage(raw));

            this.ws.on('error', (err) => {
                console.error('❌ Erreur WebSocket Deriv :', err.message);
                reject(err);
            });

            this.ws.on('close', () => {
                console.warn('⚠️  Connexion WebSocket Deriv fermée.');
                this.authorized = false;
            });
        });
    }

    _handleMessage(raw) {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch (e) {
            console.error('Message Deriv illisible :', raw.toString());
            return;
        }

        if (msg.error) {
            const pending = this.pending.get(msg.req_id);
            if (pending) {
                pending.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
                this.pending.delete(msg.req_id);
            } else {
                console.error('Erreur Deriv (sans req_id correspondant) :', msg.error);
            }
            return;
        }

        const pending = this.pending.get(msg.req_id);
        if (pending) {
            pending.resolve(msg);
            this.pending.delete(msg.req_id);
        }
    }

    _send(payload) {
        return new Promise((resolve, reject) => {
            const req_id = ++this.reqId;
            this.pending.set(req_id, { resolve, reject });
            this.ws.send(JSON.stringify({ ...payload, req_id }));

            // Sécurité : si Deriv ne répond jamais, on ne bloque pas indéfiniment.
            setTimeout(() => {
                if (this.pending.has(req_id)) {
                    this.pending.delete(req_id);
                    reject(new Error(`Timeout en attente de réponse Deriv (req_id=${req_id})`));
                }
            }, 15000);
        });
    }

    /**
     * Récupère un historique de bougies OHLC pour un symbole/granularité donnés.
     * @param {string} symbol - ex: "R_75"
     * @param {number} granularitySeconds - 60=M1, 300=M5, 900=M15, 3600=H1, 14400=H4, 86400=D1
     * @param {number} count - nombre de bougies à récupérer
     * @returns {Promise<Array<{open:number, high:number, low:number, close:number, epoch:number}>>}
     */
    async getCandles(symbol, granularitySeconds, count = 200) {
        const response = await this._send({
            ticks_history: symbol,
            adjust_start_time: 1,
            count,
            end: 'latest',
            start: 1,
            style: 'candles',
            granularity: granularitySeconds
        });
        return (response.candles || []).map(c => ({
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close),
            epoch: c.epoch
        }));
    }

    disconnect() {
        if (this.ws) this.ws.close();
    }
}
