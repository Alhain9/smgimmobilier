# Cahier des charges — Plateforme SMG IMMOBILIER

> Ce document consolide, en une version unique et à jour, l'ensemble des règles fonctionnelles et de sécurité définies pour la plateforme de gestion et de maintenance immobilière (projet SMG IMMOBILIER). Chaque nouvelle fonctionnalité ajoutée doit être intégrée directement ici, pour que ce fichier reste la référence unique et complète du projet.

---

## 1. Contexte et objectif

SMG IMMOBILIER est une entreprise de **gestion locative et de maintenance technique immobilière**. L'objectif est de concevoir une plateforme unique qui couvre trois domaines métiers interconnectés et qui applique un contrôle d'accès strict par rôle (RBAC), avec une **traçabilité complète** de chaque opération, de la demande initiale jusqu'au rapport final.

La plateforme répond à quatre exigences transversales fondamentales :
1. **Cohérence des données** : une même information (immeuble, intervention, dépense) est unique en base et simplement filtrée selon le rôle qui la consulte — pas de duplication de données par profil.
2. **Cloisonnement strict** : chaque profil ne voit que ce qui relève de son périmètre, sans exception ni fuite d'information (ex. un bailleur ne peut jamais accéder, même indirectement, aux données de stock interne ou aux marges de l'entreprise).
3. **Traçabilité de bout en bout** : chaque action (demande, intervention, sortie de stock, dépense, paiement) est horodatée, attribuée à un utilisateur, et reliée aux entités qu'elle affecte dans un journal d'audit immuable (`audit_logs`).
4. **Sécurité et résistance aux attaques** : chiffrement fort des mots de passe (bcrypt 12 rounds), règles de complexité strictes, protection anti-brute-force par limitation de requêtes, masquage des bannières serveur et architecture 100% compatible hébergement VPS de production (Nginx/Apache).

---

## 2. Architecture fonctionnelle — 3 domaines

### 2.1 Gestion immobilière
Gère le patrimoine, les baux et les flux financiers liés à la location.
- **Bailleurs** → patrimoine par bailleur : immeubles, appartements, locataires, contrats, loyers, paiements, impayés, reçus, rapports de gestion avec solde net reversé.
- **Locataires** → profil, logement, contrat, loyer, échéances, paiements Mobile Money (CamPay) et espèces, quittances/reçus officiels, factures d'eau/électricité, demandes de maintenance.

### 2.2 Maintenance & Chantiers
Gère toutes les interventions physiques, qu'elles concernent les biens gérés ou des clients externes.
- **Maintenance des biens gérés** : demandes, interventions, tâches, techniciens assignés, matériel consommé, dépenses, photos avant/pendant/après, clôture et rapports.
- **Chantiers internes** (travaux sur les immeubles/appartements gérés par SMG) : projet, tâches, budget prévisionnel vs réel, matériel de stock, outillage emprunté, techniciens, photos par phase, procès-verbal de réception.
- **Chantiers externes** (prestations pour des clients tiers) : client tiers, devis, tâches, budget, consommables, engins, photos, rapport de chantier.

### 2.3 Stock & Matériel
Gère l'ensemble des ressources physiques de l'entreprise.
- Multi-entrepôts géographiques (magasins de stockage par ville/secteur).
- Catalogue d'articles consommables et outillage avec code article automatique et seuil d'alerte critique.
- Fournisseurs, bons de commande d'achat (`ACH-YYYY-XXXXX`), bordereaux de réception avec mise à jour automatique des stocks et recalcul du PUMP (Prix Unitaire Moyen Pondéré).
- Parc d'équipements et outillage durable : affectations nominatives aux ouvriers, prêts de matériel sur chantiers avec date limite de restitution et alertes de retard.

---

## 3. Modèle de rôles — 8 profils

### 3.1 Super Admin — administration technique
- Accès total et sans restriction à l'ensemble du système, configuration technique, base de données et gestion des incidents.

### 3.2 Manager — vision globale & direction
- **Voit** : la totalité du système — gestion immobilière, bailleurs, immeubles, locataires, loyers, paiements, transactions, maintenance, chantiers internes et externes, stock, équipements, achats, dépenses, recettes, rapports, statistiques, performance de l'entreprise.
- **Actions spécifiques** : création des comptes utilisateurs du personnel et attribution des rôles/permissions (administration RBAC).

### 3.3 Directeur Administratif — juridique & gestion locative
- **Voit et gère** : baux, locataires, immeubles, appartements, contrats de bail (génération Word DOCX / PDF), gestion documentaire (GED) et suivi des relances locataires.

### 3.4 Directeur Technique — opérations & logistique
- **Voit et gère** : interventions, tâches, techniciens, travaux, chantiers, matériel nécessaire, équipements disponibles/affectés/en maintenance, progression des travaux.
- **Arbitrage temps réel** : vérifie immédiatement la disponibilité du matériel et de l'outillage avant d'ordonner une intervention.

### 3.5 Gestionnaire — exploitation terrain des biens
- **Voit et gère** : immeubles et logements attribués en priorité via la table pivot `manager_properties` (affichage en tête de liste avec badge « Mes immeubles »), avec possibilité de consultation des autres immeubles, visites, états des lieux, relevés des index de compteurs (eau/électricité), saisie des paiements locataires, signalements d'incidents.
- **Attribution d'immeubles** : configurable dynamiquement par les administrateurs/managers depuis la gestion des utilisateurs.

### 3.6 Comptable — finances, achats, stock, gestion locative
- **Voit et gère** : achats, fournisseurs, réceptions, entrées/sorties de stock, inventaires, équipements, dépenses générales, sorties de caisse, justificatifs, factures, salaires et paie.
- **Voit et gère également (volet locatif complet)** : gestion des immeubles, des appartements, des locataires, des baux, loyers, paiements des locataires, validation des encaissements, impayés, émission et génération directe des reçus officiels PDF.
- **Attribution d'immeubles** : peut également recevoir une affectation d'immeubles prioritaires pour son portefeuille de suivi.
- **Rôle de suppléance** : peut endosser temporairement le périmètre du Gestionnaire en cas d'absence via une délégation formelle tracée dans le journal d'audit.

### 3.7 Technicien — exécution terrain
- **Voit** : ses interventions et tâches assignées, informations nécessaires à son travail, équipements qui lui sont confiés, photos, instructions.
- **Actions** : démarrer une intervention, pointer les heures, ajouter les photos avant/pendant/après, déclarer le matériel de stock utilisé, restituer les outils.
- **Restriction explicite** : aucun accès à la comptabilité générale, aux prix d'achat fournisseurs ni aux marges internes de l'entreprise.

### 3.8 Bailleur — son patrimoine uniquement
- **Voit** : ses immeubles et appartements, ses locataires, loyers de ses biens, paiements, impayés, maintenances et travaux effectués sur ses biens, dépenses d'entretien déduites, photos des travaux, rapports de gestion périodiques avec solde net à reverser.
- **Restriction explicite** : aucun accès au stock général, à l'entrepôt, aux équipements internes de l'entreprise, aux fournisseurs, aux prix d'achat des matériaux, aux chantiers externes ni aux finances globales de SMG.

### 3.9 Locataire — son logement uniquement
- **Voit** : profil, contrat de bail, loyer, échéances, paiements effectués, quittances et reçus officiels téléchargeables directement en PDF, factures de charges avec index relevés, ses demandes de maintenance et leur avancement.
- **Actions** : déclaration de paiement (espèces ou Mobile Money CamPay), signalement de pannes avec photos.
- **Restriction explicite** : cloisonnement strict à son seul logement.

---

## 4. Politique de sécurité, chiffrement et protection (Anti-Piratage)

La plateforme intègre des défenses multicouches assurant une étanchéité totale face aux tentatives de piratage, tout en garantissant un fonctionnement fluide et sans blocage sur un serveur VPS de production :

### 4.1 Politique de mots de passe renforcée
- Tout mot de passe (création de compte, modification, réinitialisation) doit impérativement respecter les règles de complexité suivantes :
  * Minimum 8 caractères (jusqu'à 100).
  * Au moins une lettre majuscule (`A-Z`).
  * Au moins une lettre minuscule (`a-z`).
  * Au moins un chiffre (`0-9`).
  * Au moins un caractère spécial (`!@#$%^&*()_+-=[]{};':"|,.<>/?`).
- Les mots de passe simples (ex: `123456`, `azerty`, `admin`) sont strictement rejetés dès la validation Joi au niveau de l'API.

### 4.2 Chiffrement fort en base de données
- Aucun mot de passe n'est stocké en clair.
- Le hachage utilise l'algorithme **bcrypt** avec un facteur de coût de **12 tours de salage** (OWASP standard). Ce niveau de salage rend le déchiffrement par force brute ou tables arc-en-ciel (rainbow tables) informatiquement inaccessible, même en cas de fuite du dump de la base de données.
- Les Refresh Tokens JWT sont également hachés avec bcrypt (12 tours) avant stockage dans la table `refresh_tokens`.
- La méthode modèle `toJSON()` supprime systématiquement le champ `password` de tout retour de requête pour empêcher toute fuite accidentelle vers le client.

### 4.3 Défense anti-brute force et limitation de débit (Rate Limiting)
- **Protection de l'authentification (`authLimiter`)** :
  * Endpoint `/api/auth/login` bridé à **5 tentatives par adresse IP sur une fenêtre de 15 minutes**.
  * En cas d'échec répété, l'adresse IP est temporairement bloquée avec un message d'avertissement explicite.
- **Protection des réinitialisations (`forgotLimiter`)** :
  * Endpoint `/api/auth/forgot-password` bridé à **3 demandes par 15 minutes** pour interdire le spamming de boîtes email.
- **Protection globale de l'API (`apiLimiter`)** :
  * Toutes les routes `/api/*` sont protégées contre les attaques par déni de service (DoS) et le scraping massif avec un plafond de **300 requêtes par 15 minutes par IP**.

### 4.4 Sécurisation des en-têtes HTTP et masquage d'empreinte
- **Désactivation de la signature Express** (`app.disable('x-powered-by')`) : les attaquants ne peuvent pas identifier la technologie sous-jacente par l'en-tête `X-Powered-By`.
- **Helmet HTTP Headers** : activation des en-têtes de protection contre le détournement de clics (Clickjacking / X-Frame-Options), les attaques par reniflage MIME (X-Content-Type-Options) et la protection XSS.
- **Réponses à l'aveugle contre l'énumération de comptes** : les messages d'erreur de connexion ("Email ou mot de passe incorrect") et de mot de passe oublié ("Si un compte correspond, un lien a été généré") sont génériques pour empêcher un attaquant de savoir si une adresse email existe dans la base.

### 4.5 Compatibilité totale avec l'hébergement VPS
- Le rate-limiter fonctionne **en mémoire vive native Node.js**, sans dépendance externe obligatoire (pas besoin d'installer ou de configurer Redis sur le VPS).
- L'option `app.set('trust proxy', 1)` est configurée en standard : lorsque la plateforme est hébergée sur un VPS Linux derrière un serveur mandataire inverse (Reverse Proxy **Nginx** ou **Apache** avec `X-Forwarded-For`), l'adresse IP réelle de l'utilisateur est transmise correctement sans jamais bloquer l'IP du serveur lui-même.

---

## 5. Passerelle de paiement Mobile Money & Documents Officiels

- **Solution de paiement : CamPay**
  * Supporte les paiements instantanés Orange Money Cameroun et MTN Mobile Money.
  * Validation automatique par Webhook sécurisé avec clé secrète (`CAMPAY_WEBHOOK_KEY`).
  * Processus de synchronisation en tâche de fond pour réconcilier les règlements en attente.
  * Paiements en espèces tracés avec téléversement obligatoire du justificatif de caisse.
- **Génération documentaire et reçus PDF officiels** :
  * Liens d'accès direct et d'impression PDF (`/api/receipts/:id/pdf?token=...`) pour tous les rôles autorisés sans boîte de dialogue superflue.
  * Suppression de tout cachet/signature généré artificiellement sur le reçu PDF pour permettre l'apposition physique manuelle du cachet et de la signature officielle de l'agence.
  * Formatage rigoureux des devises et montants en FCFA (sans artefacts de typographie).
  * Application PWA enrichie du logo officiel 3D SMG IMMOBILIER (icônes adaptatives 192px, 512px, favicons et support hors-ligne).

---

## 6. Synthèse des permissions par rôle

| Rôle | Périmètre principal | Gestion des utilisateurs | Voit le stock interne ? | Finances & Gestion Locative |
|---|---|---|---|---|
| Super Admin | Tout le système | Oui | Oui | Oui (Total) |
| Manager | Direction générale | Oui | Oui | Oui (Total) |
| Dir. Administratif | Baux, locataires, GED | Non | Non | Gestion baux & locataires |
| Dir. Technique | Maintenance & chantiers | Non | Oui (stocks & outillage) | Dépenses chantiers & travaux |
| Gestionnaire | Gestion terrain des logements | Non | Selon délégation | Saisie & suivi (Immeubles assignés prioritaires) |
| Comptable | Finances, achats, stock, locatif | Non | Oui | Oui (Gestion baux, loyers, reçus PDF, validation) |
| Technicien | Ses interventions | Non | Non (sauf matériel affecté)| Non |
| Bailleur | Son patrimoine seul | Non | Non | Ses loyers & dépenses nettes |
| Locataire | Son logement seul | Non | Non | Ses loyers & reçus PDF |

---

## 7. Traçabilité de bout en bout

```
Locataire signale une panne
  → Ticket de maintenance créé avec photo
  → Validation par le Directeur Technique
  → Technicien affecté avec créneau horaire
  → Sortie de pièces de rechange au magasin (stock débité automatiquement)
  → Réparation sur site + photos Avant / Pendant / Après
  → Clôture de l'intervention et calcul du coût réel
  → Dépense imputée sur l'appartement et l'immeuble
  → Visible sur le rapport de gestion du bailleur (sans exposer le stock interne)
  → Événement consigné dans audit_logs avec horodatage, IP et User ID
```
