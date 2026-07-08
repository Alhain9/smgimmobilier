# Assistant IA SMG IMMOBILIER

Assistant interne (moteur **Groq**, palier gratuit) intégré à la plateforme : **répond / analyse**,
**agit** (avec confirmation), **alerte** proactivement et **rédige** des documents.
Présenté en **barre de commande** (Ctrl/Cmd + K). Réservé au personnel.

## 1. Configuration

Dans `backend/.env` :

```
GROQ_API_KEY=gsk_...                       # votre clé Groq (vide = assistant désactivé, barre masquée + 503 clair)
GROQ_MODEL=llama-3.3-70b-versatile         # modèle Groq supportant le tool-use (cf. GET /openai/v1/models)
GROQ_BASE_URL=https://api.groq.com/openai/v1   # API Groq (compatible OpenAI)
SMG_API_URL=http://localhost:5000/api
```

> Le moteur utilise l'API Groq **compatible OpenAI** (`/chat/completions`, function calling)
> via le `fetch` natif de Node — **aucune dépendance** à installer. Groq propose un **palier
> gratuit** (limité en débit). Pour changer de modèle, ajustez `GROQ_MODEL`
> (liste réelle : `GET https://api.groq.com/openai/v1/models`).

`JWT_SECRET` et `PORT` sont déjà ceux de la plateforme (l'assistant est **intégré**,
pas un service séparé). Démarrage : `cd backend && npm run dev` (rien d'autre à lancer).

## 2. Principe (sécurité)

- **Réservé au personnel** : tout rôle interne ; les **locataires reçoivent 403**.
- **RBAC automatique** : l'assistant n'a aucun privilège propre. Chaque outil appelle
  l'API SMG **avec le JWT de l'utilisateur connecté** (`src/services/assistant/smg-client.js`).
  Lecture comme écriture passent par les permissions existantes.
- **Confirmation avant toute écriture** : un outil d'écriture ne s'exécute **jamais**
  sans un « oui » explicite (bouton Confirmer dans la barre). Garde côté serveur :
  l'agent renvoie `action_en_attente` ; l'exécution n'a lieu qu'avec `confirmer:true`.
- **L'IA n'invente pas** : toute donnée provient d'un appel d'outil réel.

## 3. Endpoints

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/assistant/chat` | `{ message, historique?, confirmer?, action? }` → `{ reponse, action_en_attente? }` |
| GET  | `/api/assistant/alertes` | Alertes proactives filtrées par le rôle de l'utilisateur |
| POST | `/api/relances` | Relance d'un locataire (notification) — réservé gestion/finance |

## 4. Outils de l'agent (`src/services/assistant/tools.js`)

**Lecture / analyse** : `detail_chiffre_affaires`, `lister_loyers_impayes`,
`lister_incidents`, `lister_biens_vacants`, `synthese_periode`.
**Écriture (confirmation)** : `enregistrer_paiement` (méthode par défaut *espèces*),
`declarer_incident`, `changer_statut_bien`, `envoyer_relance`.
**Document** : `rediger_document` (quittance / relance / rapport) — l'IA rédige le
texte à partir des données réelles ; export PDF via les utilitaires front (`PDF.document`).

> **Ajouter une capacité** : un objet dans `TOOLS` (avec une `description` claire)
> + un `case` dans `executeTool`. Rien d'autre.

## 5. Mapping vers l'API SMG existante

Les chemins « génériques » de la spec sont mappés sur les vrais endpoints :
`paiements/impayes`→`/payments/debts`, `paiements/detail`→calculé depuis `/payments`,
`incidents`→`/maintenance`(+`/expenses`), `biens?statut=vacant`→`/apartments?status=free`,
`stats`→`/dashboard/period`, `biens/:id`→**PUT** `/apartments/:id`. Le filtrage par mois
se fait côté outil (aucun endpoint modifié).

## 6. Front — barre de commande

`frontend/js/modules/assistant-bar.js` (chargé dans `pages/dashboard.html`) :
- **Ctrl/Cmd + K** ouvre / ferme (Échap ferme). Bouton flottant également.
- Champ unique + **micro** (Web Speech `fr-FR` ; caché si l'API est absente).
- À l'ouverture : zone **« À votre attention »** (alertes) + suggestions ; navigation clavier.
- Réponses sous le champ, conversation continue, encart **Confirmer / Annuler** pour les actions.
- **Zéro ressource externe** (CSS + SVG inline, jsPDF déjà bundlé localement).
- Caché pour les locataires.

## 7. Vérification rapide

```
node _verify_asst.js   # (script de test fourni pendant le dev ; supprimé après recette)
```
Couvre : 403 locataire, 503 si clé absente, alertes filtrées par RBAC,
confirmation d'écriture, et RBAC sur les écritures.
```
