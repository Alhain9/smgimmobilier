# 🏢 SMG IMMOBILIER — Plateforme de gestion immobilière

Application web professionnelle de gestion immobilière pour **SMG IMMOBILIER**.
Backend Node.js/Express + MySQL (Clean Architecture, JWT, RBAC) — Frontend HTML/CSS/JS Vanilla.

## ✨ Fonctionnalités

- 🏢 Gestion immeubles & appartements (statut d'occupation)
- 👤 Gestion locataires (CNI, photo, historique)
- 📄 Contrats de bail + upload PDF signé
- 💰 Paiements (Orange Money, MTN MoMo, virement…) + justificatifs + suivi des impayés
- 🔧 Maintenances (tickets, assignation technicien, photos avant/pendant/après)
- 🛠 Dépenses & équipements (stock, quantités, coûts)
- ✅ Tâches & 📅 Calendrier interne (vue mensuelle)
- 📊 Tableaux de bord adaptés à chaque rôle
- 🔐 8 rôles RBAC + authentification JWT
- 🌗 **Mode clair / sombre** (basculable, mémorisé)

## 🏗 Architecture

```
smg_immobilier/
├── backend/           Node.js + Express + Sequelize (MySQL)
│   └── src/
│       ├── config/        database, seed, migrate
│       ├── models/        13 modèles + relations
│       ├── repositories/  couche d'accès données
│       ├── services/      logique métier
│       ├── controllers/   contrôleurs HTTP
│       ├── routes/        routes API REST
│       ├── middlewares/   auth JWT, RBAC, upload, erreurs
│       └── utils/         JWT, réponses, références
└── frontend/          HTML / CSS / JS (Vanilla)
    ├── css/               theme (clair/sombre), style, landing, dashboard
    ├── js/utils/          api, auth, theme, toast, modal, helpers
    ├── js/modules/        layout (sidebar+routeur), crud-page
    ├── js/pages/          1 module par section
    ├── index.html         landing page
    └── pages/             login.html, dashboard.html
```

## 🚀 Installation

### 1. Base de données
Créez une base MySQL nommée `smg_immobilier` :
```sql
CREATE DATABASE smg_immobilier CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env      # puis renseignez DB_USER / DB_PASSWORD
npm run seed              # crée les tables + données de démo
npm run dev               # démarre l'API sur http://localhost:5000
```

### 3. Frontend
Servez le dossier `frontend/` (ne pas ouvrir en file://) :
```bash
cd frontend
npx serve .               # ou: python -m http.server 3000
```
Puis ouvrez `http://localhost:3000`.

## 👥 Comptes de démonstration

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@smg.com | admin123 |
| Manager | manager@smg.com | manager123 |
| Directeur Admin | admin.dir@smg.com | admin123 |
| Directeur Technique | tech.dir@smg.com | tech123 |
| Gestionnaire | gestion@smg.com | gestion123 |
| Comptable | compta@smg.com | compta123 |
| Technicien | technicien@smg.com | tech123 |
| Locataire | locataire@smg.com | loc123 |

## 📡 API REST

`/api/auth` · `/api/users` · `/api/properties` · `/api/apartments` · `/api/tenants`
`/api/leases` · `/api/payments` · `/api/maintenance` · `/api/expenses` · `/api/equipment`
`/api/tasks` · `/api/calendar` · `/api/dashboard`

Toutes les routes (sauf `/auth/login`) exigent un header `Authorization: Bearer <token>`.

## 🎨 Charte graphique
Bleu ciel · Blanc · Gris — design moderne, responsive, sidebar professionnelle.
