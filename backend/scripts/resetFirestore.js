require('dotenv').config();
const { db } = require('../config/db');

const COLLECTIONS = [
  'sales',
  'order_items',
  'orders',
  'menu_item_ingredients',
  'menu_items',
  'inventory',
  'ingredients',
  'users',
  'locations',
  'counters',
];

async function clearCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) return 0;
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snapshot.size;
}

async function run() {
  try {
    for (const name of COLLECTIONS) {
      const count = await clearCollection(name);
      console.log(`Cleared ${name}: ${count} docs`);
    }
    console.log('✅ Firestore reset complete.');
    console.log('ℹ️  Run "npm run db:seed" to recreate demo data.');
  } catch (error) {
    console.error('❌ Failed to reset Firestore:', error.message);
    process.exitCode = 1;
  }
}

run();
