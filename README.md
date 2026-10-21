# LOTO509 - Sistèm Bòlèt POS | New York • Florida • Georgia 🎟️
### Système de Borlette & Loterie POS pour Terminaux et Caisses (Kreyòl & Français)

Un système complet et moderne de point de vente (POS) et de gestion de loterie/borlette adapté pour **New York**, **Florida (Floride)** et **Georgia (Géorgie)**, avec interface bilingue réactive en **Kreyòl Ayisyen** et **Français**, simulation et impression de billets thermiques standard **58mm** et **80mm** (ESC/POS), codes QR, code-barres et gestion complète des tirages et paiements.

---

## 🌟 Karakteristik Prensipal / Fonctionnalités Clés

### 1. Tiraj Sipòte / Tirages Disponibles (Midi & Soir)
* **New York (NY)** :
  * *Nouyòk Midi / New York Midi* (Clôture : 14:15, Tirage : 14:30 EDT)
  * *Nouyòk Swè / New York Soir* (Clôture : 22:15, Tirage : 22:30 EDT)
* **Floride (FL)** :
  * *Florid Midi / Floride Midi* (Clôture : 13:15, Tirage : 13:30 EDT)
  * *Florid Swè / Floride Soir* (Clôture : 21:15, Tirage : 21:45 EDT)
* **Géorgie (GA)** :
  * *Jòdja Midi / Géorgie Midi* (Clôture : 12:15, Tirage : 12:29 EDT)
  * *Jòdja Swè / Géorgie Soir* (Clôture : 18:45, Tirage : 19:00 EDT)

### 2. Kalite Jwèt / Types de Paris & Règles de Borlette
* **Bòlèt (2 Chif / 2 Chiffres, 00-99)** :
  * **1er Lot (Premye Lo)** : multiplicateur par défaut `50x` (configurable)
  * **2ème Lot (Dezyèm Lo)** : multiplicateur par défaut `20x` (configurable)
  * **3ème Lot (Twazyèm Lo)** : multiplicateur par défaut `10x` (configurable)
* **Maryaj / Mariage** :
  * Combinaison de deux numéros à 2 chiffres (ex : `28 x 65`). Si les deux numéros sortent parmi les 3 lots gagnants : multiplicateur par défaut `1000x` (configurable).
* **Loto 3 Chif (Pick 3)** : multiplicateur par défaut `500x` (ex : `428`).
* **Loto 4 Chif (Pick 4)** : multiplicateur par défaut `5000x` (ex : `9165`).

### 3. Eksperyans POS Taktil & Klavye / Interface Caisse Optimisée
* **Clavier virtuel tactile** optimisé pour terminaux tactiles (Sunmi V2, Pax A920, tablettes Android, écrans tactiles).
* **Raccourcis clavier physiques** :
  * Raccourcis modes de jeu : `1` = Bòlèt, `2` = Maryaj, `3` = Loto 3, `4` = Loto 4.
  * Touche `Enter` : ajout instantané du pari et retour automatique du curseur.
  * Touche `F2` : validation immédiate et impression du billet.
  * Touche `Escape` : réinitialisation du panier.
* Boutons rapides de montants : `+5 G`, `+10 G`, `+25 G`, `+50 G`, `+100 G`, `+250 G`, `+500 G`.
* Effets sonores synthétisés via l'API Web Audio (bips de saisie, carillon d'impression, fanfare de gain).

### 4. Enpresyon Resi Tèmik / Impression Thermique (58mm & 80mm)
* Format conforme aux standards **ESC/POS** de tickets de loterie haïtienne :
  * En-tête avec nom de compagnie, succursale, terminal POS et téléphone.
  * Date, heure et tirage sélectionné.
  * Numéro unique de billet (`TK-YYYYMMDD-XXXX`) et code de sécurité (`SEC-XXXX-XX`).
  * Tableau détaillé des paris (Jeu, Numéro, Mise).
  * Montant total et devises configurables (`MXN - Pesos Mexicains / Peso Mexicano`, `HTG - Gourdes`, `USD - Dollars`, `DOP - Pesos`).
  * **Code QR haute définition** contenant les données cryptographiques de vérification.
  * **Code-barres** pour lecteur optique.
  * Mentions légales et règles d'expiration (90 jours) en Kreyòl ou Français.
  * Règle CSS `@media print` garantissant une impression directe sans marges ni dialogues parasites.

### 5. Verifikasyon Tikè & Pèyman / Contrôle & Paiement des Gains
* Recherche instantanée par code-barres, identifiant de billet ou code de sécurité.
* Détection automatique des gains et calcul au centime près par lot gagné.
* Bouton d'enregistrement du paiement du gain avec traçabilité (agent, date et heure).
* Délai d'annulation configurable (ex : 15 minutes) avant le tirage.

### 6. Jesyon Rezilta & Rapò / Gestion des Résultats & Rapports
* **Module Résultats** : saisie des résultats officiels (1er, 2e, 3e lot, Pick 3, Pick 4).
* Évaluation rétroactive automatique de tous les billets actifs avec mise à jour du statut des gagnants.
* **Rapports Financiers** :
  * Ventes totales, gains distribués, bénéfice net de la caisse.
  * Répartition des ventes par tirage et par type de jeu.
  * Impression du rapport de clôture de caisse au format thermique.

---

## 🚀 Enstalasyon & Demaraj / Installation & Démarrage

### Prérequis
* Node.js v18 ou plus récent
* npm v9 ou plus récent

### Démarrage rapide

```bash
# Cloner le dépôt
git clone https://github.com/Beeshech93/lotery.git
cd lotery-1

# Installer les dépendances (racine, serveur et client)
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Lancer le serveur et le client simultanément
npm run dev
```

L'application sera accessible immédiatement :
* **POS Frontend (Client Vite)** : `http://localhost:5173`
* **API Backend (Express)** : `http://localhost:4000`

---

## 🛠️ Estrikti Pwojè a / Architecture du Projet

```
lotery-1/
├── client/                     # Application Frontend React (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── PosScreen.jsx          # Écran de vente POS & clavier tactile
│   │   │   ├── ThermalReceipt.jsx     # Billet thermique (58mm/80mm, QR, Barcode)
│   │   │   ├── VerifyScreen.jsx       # Vérification et paiement des gains
│   │   │   ├── ResultsManagerScreen.jsx # Saisie des résultats officiels NY/FL/GA
│   │   │   ├── DailyReportScreen.jsx  # Rapports des ventes et clôture de caisse
│   │   │   └── SettingsScreen.jsx     # Paramètres, multiplicateurs et plafonds
│   │   ├── i18n.js                    # Dictionnaire complet Kreyòl / Français
│   │   ├── soundEffects.js            # Synthétiseur audio POS (Web Audio API)
│   │   ├── App.jsx                    # Navigation et orchestration globale
│   │   └── index.css                  # Design system sombre & règles d'impression
│   └── vite.config.js                 # Proxy API vers localhost:4000
│
├── server/                     # Serveur Backend Node.js & Express
│   ├── db.js                   # Moteur de règles Borlette, persistance JSON & calculs
│   ├── index.js                # Endpoints REST API
│   └── package.json
│
└── package.json                # Script d'orchestration 'npm run dev'
```

---

## 🌐 Endpoints API

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/draws` | Liste des tirages (NY, FL, GA) et statuts (ouvert/fermé) |
| `POST` | `/api/draws/:id/override` | Forcer l'ouverture ou la fermeture d'un tirage |
| `POST` | `/api/tickets` | Création d'un billet de loterie avec validation des plafonds |
| `POST` | `/api/tickets/verify` | Vérification d'un billet via code de sécurité ou code-barres |
| `POST` | `/api/tickets/:id/payout` | Enregistrement du paiement d'un billet gagnant |
| `POST` | `/api/tickets/:id/cancel` | Annulation d'un billet dans le délai autorisé |
| `GET` | `/api/results` | Historique des résultats officiels publiés |
| `POST` | `/api/results` | Publication de résultats et calcul automatique des gains |
| `GET` | `/api/reports/daily` | Rapport financier et statistique de la journée |
| `GET / PUT`| `/api/config` | Consultation et mise à jour des paramètres de la caisse |
| `GET` | `/api/database/status` | Statut de la connexion Neon PostgreSQL (AWS us-east-1) |
| `GET` | `/api/storage/status` | Statut du stockage objet S3 / Cloudflare R2 / MinIO |
| `POST` | `/api/storage/upload` | Téléversement d'objet vers S3 avec URL pré-signée |
| `GET` | `/api/storage/view` | Génération d'une URL de visualisation pré-signée S3 |

---

## ☁️ Stockage Objet S3 & Base de Données Neon PostgreSQL
* **Base de données** : Neon PostgreSQL (`neondb`), tables relationnelles, intégrité et transactions instantanées.
* **Stockage S3** : SDK `@aws-sdk/client-s3` et `@aws-sdk/s3-request-presigner` installés et configurés.
  * Pour tester le script S3 : `npm run test:s3`
  * Variables dans `.env` :
    ```env
    AWS_REGION=us-east-1
    S3_BUCKET=assets
    AWS_ACCESS_KEY_ID=your_access_key
    AWS_SECRET_ACCESS_KEY=your_secret_key
    AWS_ENDPOINT_URL_S3=https://... (optionnel si MinIO, Cloudflare R2 ou Supabase)
    ```


---

## 🖨️ Konfigirasyon Enprimant / Configuration des Imprimantes Thermiques
1. **Sur PC / Mac** : Dans la boîte de dialogue d'impression du navigateur (`Cmd+P` / `Ctrl+P`), sélectionnez votre imprimante thermique (ex: Epson TM-T20, Xprinter, Rongta), réglez la taille du papier sur **58mm** ou **80mm**, et activez l'option "Graphismes d'arrière-plan".
2. **Sur terminaux Android POS (Sunmi, PAX, Nexgo)** : L'application web s'affiche en plein écran dans Chrome ou WebView, et le bouton d'impression déclenche le service d'impression thermique direct du terminal.

---

## 🇭🇹 🇫🇷 Sipò Lang / Support Linguistique
Le bouton en haut à droite permet de basculer instantanément à chaud toute l'application entre :
* **Kreyòl Ayisyen** (Nouyòk Swè, Premye Lo, Maryaj, Tikè Gayan, Peye Kounye a)
* **Français** (New York Soir, 1er Lot, Mariage, Billet Gagnant, Payer Maintenant)
La préférence est automatiquement sauvegardée dans le stockage local de l'appareil.