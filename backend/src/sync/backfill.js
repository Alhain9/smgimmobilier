// Script autonome : pousse toutes les données MySQL existantes vers Firestore (one-shot).
// Usage : FIREBASE_ENABLED=true npm run firestore:backfill
require('dotenv').config();
const { connectDB } = require('../config/database');
require('../models');
const firebase = require('./firebase');
const sync = require('./sync.service');

(async () => {
  await connectDB();
  if (!firebase.init()) {
    console.error('Firebase non configuré : renseignez FIREBASE_ENABLED=true et FIREBASE_SERVICE_ACCOUNT.');
    process.exit(1);
  }
  await sync.backfill();
  console.log('✅ Backfill MySQL -> Firestore terminé.');
  process.exit(0);
})().catch((e) => { console.error('Backfill échoué :', e.message); process.exit(1); });
