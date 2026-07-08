# Synchronisation MySQL ⇄ Cloud Firestore — SMG IMMOBILIER

Ajoute Firestore et une **synchronisation bidirectionnelle** au backend Node existant,
**sans rien changer** au frontend web, à l'API ou à MySQL. Le mobile Flutter lit/écrit
Firestore (temps réel) ; MySQL reste la base maîtresse côté serveur.

## 1. Architecture

```
Flutter (mobile)  ──lit/écrit──►  Cloud Firestore  ◄──onSnapshot──  Node.js (sync)  ──►  MySQL
        ▲                                                  │
        └────────── temps réel (streams) ◄────────────────┘   hooks Sequelize (MySQL ► Firestore)
```

- **MySQL ► Firestore** : hooks Sequelize (`afterCreate/Update/Save/Destroy`) sur 6 modèles →
  `pushDoc()` écrit le document Firestore.
- **Firestore ► MySQL** : un `onSnapshot` par collection → `applyChange()` écrit dans MySQL.
- **Anti-boucle** : chaque doc porte `sourceSystem` ('mysql' | 'firestore') ; on mémorise nos
  propres écritures pendant 15 s (échos ignorés) ; les écritures issues de la synchro passent
  l'option Sequelize `_fromSync:true` (les hooks ne re-propagent pas).
- **Conflits** : `updatedAt` (le dernier qui écrit gagne) ; en cas d'égalité, on privilégie
  l'origine `firestore`. (`sync.service.js → firestoreWins`).
- **Doublons** : l'**id MySQL est l'id du document Firestore** (`doc(id)`), donc 1 ligne ⇄ 1 doc.

Fichiers : `src/sync/firebase.js` (init), `mapping.js` (collections↔modèles), `sync.service.js`
(moteur), `hooks.js` (MySQL►Firestore), `index.js` (démarrage), `backfill.js` (réinjection).

## 2. Collections Firestore (FR) ↔ tables MySQL
| Collection   | Table MySQL  | Modèle       |
|--------------|--------------|--------------|
| locataires   | tenants      | Tenant       |
| proprietes   | properties   | Property     |
| contrats     | leases       | Lease        |
| paiements    | payments     | Payment      |
| depenses     | expenses     | Expense      |
| notifications| notifications| Notification |

> Pour ajouter une collection : une ligne dans `MAPPINGS` (`src/sync/mapping.js`). Rien d'autre.

## 3. Configuration (une fois)

1. **Projet Firebase** : console.firebase.google.com → créez le projet → **Firestore Database**
   (mode production) → choisissez une région.
2. **Clé de service** : Paramètres du projet → *Comptes de service* → **Générer une clé privée** →
   enregistrez le JSON sous **`backend/firebase-service-account.json`** (NE PAS committer ;
   ajoutez-le au `.gitignore`).
3. **`backend/.env`** :
   ```
   FIREBASE_ENABLED=true
   FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json
   FIREBASE_BACKFILL=false        # mettez true UNE fois pour la 1ère injection (voir §4)
   ```
4. **Règles de sécurité** : déployez `backend/firestore.rules`
   (`firebase deploy --only firestore:rules`, ou collez-les dans la console).
5. Redémarrez le backend : `cd backend && npm run dev`. Au log vous verrez
   `[sync] Synchro bidirectionnelle MySQL <-> Firestore ACTIVE.`

> Tant que `FIREBASE_ENABLED!=true` ou que la clé est absente, la synchro reste **inactive**
> et l'app fonctionne exactement comme avant (zéro régression).

## 4. Première injection (backfill MySQL → Firestore)
Pour copier les données MySQL déjà présentes vers Firestore :
```
# option A : ponctuel
npm run firestore:backfill
# option B : au démarrage, mettez FIREBASE_BACKFILL=true (puis remettez false)
```

## 5. Custom claims (pour les règles)
Les règles utilisent deux **claims** du token Firebase Auth : `role` et `mysql_user_id`.
Posez-les à la création/connexion du compte (Cloud Function ou script admin) :
```js
const admin = require('firebase-admin');
await admin.auth().setCustomUserClaims(firebaseUid, { role: 'manager', mysql_user_id: 12 });
```
Sans ces claims, un locataire ne pourra pas lire ses propres documents.

## 6. Côté Flutter (extraits à intégrer)
Dépendances : `firebase_core`, `firebase_auth`, `cloud_firestore`.

```dart
// Flux temps réel des paiements d'un locataire
Stream<List<Map<String, dynamic>>> paiementsDuLocataire(int userId) {
  return FirebaseFirestore.instance
    .collection('paiements')
    .where('tenant_id', isEqualTo: userId)
    .orderBy('payment_date', descending: true)
    .snapshots()
    .map((s) => s.docs.map((d) => {'id': d.id, ...d.data()}).toList());
}

// Créer / modifier (le serveur Node répercutera vers MySQL)
Future<void> declarerPaiement(Map<String, dynamic> data) {
  return FirebaseFirestore.instance.collection('paiements').add({
    ...data,
    'sourceSystem': 'firestore',                 // IMPORTANT pour l'anti-boucle + les règles
    'updatedAt': DateTime.now().toUtc().toIso8601String(),
  });
}

Future<void> majPropriete(String id, Map<String, dynamic> patch) {
  return FirebaseFirestore.instance.collection('proprietes').doc(id).set({
    ...patch, 'sourceSystem': 'firestore',
    'updatedAt': DateTime.now().toUtc().toIso8601String(),
  }, SetOptions(merge: true));
}
```
> **Règle d'or côté Flutter** : à chaque écriture, mettez `sourceSystem:'firestore'` et un
> `updatedAt` ISO récent — c'est ce qui pilote la résolution de conflits et empêche les boucles.

## 7. (Bonus) Scanner des documents en Flutter
Pour scanner/insérer des documents avec l'appareil photo (pas besoin de Kotlin natif) :
- Prendre une photo / choisir une image : **`image_picker`**.
- Scan de document (détection des bords + recadrage) : **`cunning_document_scanner`** ou
  **`flutter_doc_scanner`**.
- OCR (extraction de texte) : **`google_mlkit_text_recognition`**.
Les fichiers générés s'envoient ensuite vers **Firebase Storage** (ou, pour les photos de
chantier « légères », via le partage WhatsApp comme dans la web app).

## 8. Sécurité
- Clé de service **jamais** committée / exposée côté client (serveur uniquement).
- Validation des écritures côté Node (les modèles Sequelize valident les types/en/contraintes
  avant l'insertion MySQL ; une donnée Firestore invalide est rejetée et loggée).
- Accès Firestore contrôlé par `firestore.rules` + Firebase Auth (claims `role`/`mysql_user_id`).
- Les écritures sensibles (validation paiement, etc.) restent gouvernées par MySQL/Node.
