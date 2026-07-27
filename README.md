# Deriv Daily Bot — Scanner "Routine Daily" (3C Trading Planner)

Scanner automatisé qui reproduit la logique **Cadre & Filtre + Séance &
Exécution** de l'application 3C Trading Planner (biais D1, POI H4, C1
Confluence, C2 Trigger, C3 Entrée, règle de rejet), appliquée aux **Indices
Synthétiques Deriv** (Volatility 75 par défaut).

## ⚠️ Ce que ce bot fait et ne fait PAS

- ✅ Surveille le marché en continu et **t'alerte** quand tous les critères
  Cadre + Filtre + C1/C2/C3 sont réunis.
- ✅ Fournit un script de backtest pour voir la fréquence historique des setups.
- ❌ **N'exécute AUCUN trade réel.** C'est un scanner/alerte, pas un exécuteur
  automatique — volontairement, le temps que tu valides la logique.
- ❌ N'intègre PAS le calendrier économique (critère C0.4 "pas de news
  majeure") — à vérifier toi-même avant d'agir sur une alerte.
- ⚠️ La détection Order Block / Fair Value Gap / structure de marché est une
  **implémentation simplifiée** (voir `src/smc.js`) — backteste et ajuste les
  seuils avant de faire confiance aux signaux.

## Installation

Il te faut [Node.js](https://nodejs.org/) (version 18 ou plus récente).

```bash
npm install
cp .env.example .env
```

Ouvre `.env` et renseigne :
- `DERIV_API_TOKEN` : crée un token sur https://app.deriv.com/account/api-token
  (permission "Read" suffit pour le scanner)
- `SYMBOL` : `R_75` pour Volatility 75 par défaut (voir la liste des symboles
  disponibles dans la doc Deriv si tu veux un autre indice)

## Utilisation depuis un téléphone (sans ordinateur, sans coût)

Cette méthode fait tourner le scanner dans le cloud de GitHub (gratuit), et
t'envoie les alertes directement sur Telegram — gérable entièrement depuis
ton téléphone (Android ou iPhone), aucun appareil à laisser allumé.

### Étape 1 — Créer le bot Telegram (2 minutes, depuis l'app Telegram)

1. Dans Telegram, cherche **@BotFather** et démarre une conversation
2. Envoie `/newbot`, choisis un nom puis un identifiant (doit finir par "bot")
3. BotFather te donne un **token** (garde-le, tu en auras besoin) — format
   `123456789:AAExempleDeToken`
4. Cherche ton bot par son identifiant et envoie-lui n'importe quel message
   (ex: "salut") pour démarrer la conversation
5. Ouvre cette adresse dans le navigateur de ton téléphone (remplace
   `<TON_TOKEN>`) :
   `https://api.telegram.org/bot<TON_TOKEN>/getUpdates`
6. Cherche `"chat":{"id":123456789` dans la réponse — ce nombre est ton
   **chat_id**

### Étape 2 — Mettre le code sur GitHub (depuis l'app GitHub ou un navigateur)

1. Crée un compte sur [github.com](https://github.com) si tu n'en as pas
2. Crée un nouveau dépôt (bouton "New repository") — **coche "Public"**
   (nécessaire pour des minutes d'exécution illimitées et gratuites ; tes
   tokens resteront quand même chiffrés et invisibles, voir étape 3)
3. Uploade tous les fichiers de ce projet dedans (sur mobile : dans le
   dépôt, "Add file" → "Upload files")

### Étape 3 — Configurer tes secrets (jamais visibles publiquement)

Dans le dépôt GitHub : **Settings → Secrets and variables → Actions → New
repository secret**. Ajoute un par un :

| Nom du secret | Valeur |
|---|---|
| `DERIV_API_TOKEN` | ton token API Deriv (compte démo recommandé) |
| `TELEGRAM_BOT_TOKEN` | le token de l'étape 1 |
| `TELEGRAM_CHAT_ID` | le chat_id de l'étape 1 |
| `SYMBOL` | `R_75` (ou autre symbole) |

### Étape 4 — C'est parti

Le scan se lance automatiquement toutes les 15 minutes (fichier
`.github/workflows/scan.yml`, déjà inclus). Tu peux aussi le déclencher
manuellement à tout moment : onglet **Actions** du dépôt → "Scan Routine
Daily" → bouton **"Run workflow"**.

Les alertes 🟢 arrivent directement dans ta conversation avec le bot
Telegram, sur n'importe lequel de tes deux téléphones.

⚠️ **Limite à connaître** : GitHub désactive automatiquement les workflows
planifiés après 60 jours sans aucune activité (commit) sur le dépôt — un
détail à surveiller si tu ne touches plus au code pendant longtemps.

---

## Utilisation sur ordinateur/VPS (boucle continue)

**Lancer le scanner en continu :**
```bash
npm start
```
Il vérifie les critères toutes les 60 secondes (réglable via
`SCAN_INTERVAL_SECONDS` dans `.env`) et affiche une alerte 🟢 dans le
terminal dès qu'un setup est validé.

**Recevoir les alertes sur Telegram/Discord/Slack :**
Ajoute `WEBHOOK_URL=...` dans `.env` (URL de webhook Discord/Slack, ou un
webhook Telegram via un petit relais) — l'alerte sera aussi envoyée là-bas.

**Lancer un backtest (fréquence historique des setups) :**
```bash
npm run backtest
```
⚠️ Ça ne simule pas de gains/pertes en R — l'application ne définit pas de
règle de Stop Loss/Take Profit automatique, donc ce script compte uniquement
**combien de fois** un setup valide serait apparu dans l'historique récent.

## Structure du projet

```
.github/workflows/
└── scan.yml                   ← planification GitHub Actions (toutes les 15 min)
src/
├── derivClient.js            ← connexion WebSocket à l'API Deriv
├── smc.js                     ← détection structure/BOS/Order Blocks/FVG
├── dailyRulesFromCandles.js   ← logique PURE des règles (partagée live+backtest)
├── dailyRules.js              ← version live (récupère les bougies puis évalue)
├── notify.js                  ← alertes console + webhook + Telegram
├── index.js                   ← scanner en boucle continue (npm start, ordi/VPS)
├── scan-once.js               ← un seul cycle puis s'arrête (npm run scan, GitHub Actions)
└── backtest.js                ← point d'entrée du backtest (npm run backtest)
```

## Et après ? (passage à l'exécution automatique)

Une fois que tu as backtesté et validé que la logique te convient, on pourra
ajouter l'exécution automatique de trades (via les contrats "Multipliers" de
Deriv, qui fonctionnent comme des CFDs avec Stop Loss/Take Profit). Ça
demandera de définir précisément :
- la taille de position / gestion du risque (équivalent du Calculateur de Lot
  de l'app)
- les règles exactes de Stop Loss et Take Profit (non définies dans
  l'application actuelle, qui se contente d'enregistrer le résultat en R
  après coup)
- démo d'abord, réel ensuite — jamais l'inverse

Dis-moi quand tu es prêt à passer cette étape.
