const fs = require('fs');
const admin = require('firebase-admin');
require('dotenv').config();

function parseJsonCredential(rawValue, sourceName) {
  try {
    return JSON.parse(rawValue);
  } catch (error) {
    throw new Error(`Invalid ${sourceName}: ${error.message}`);
  }
}

function parseBase64Credential(rawValue, sourceName) {
  const decoded = Buffer.from(String(rawValue).trim(), 'base64').toString('utf8');
  return parseJsonCredential(decoded, sourceName);
}

function getCredential() {
  const base64Json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_B64;
  if (base64Json) {
    const parsed = parseBase64Credential(
      base64Json,
      'FIREBASE_SERVICE_ACCOUNT_JSON_B64 (base64-encoded service account JSON)',
    );
    return admin.credential.cert(parsed);
  }

  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    const trimmed = String(rawJson).trim();
    const parsed = trimmed.startsWith('{')
      ? parseJsonCredential(trimmed, 'FIREBASE_SERVICE_ACCOUNT_JSON')
      : parseBase64Credential(trimmed, 'FIREBASE_SERVICE_ACCOUNT_JSON (detected as base64)');
    return admin.credential.cert(parsed);
  }

  const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (jsonPath) {
    const file = fs.readFileSync(jsonPath, 'utf8');
    const parsed = parseJsonCredential(file, `FIREBASE_SERVICE_ACCOUNT_PATH (${jsonPath})`);
    return admin.credential.cert(parsed);
  }

  return admin.credential.applicationDefault();
}

function initializeFirebase() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || undefined;
  return admin.initializeApp({
    credential: getCredential(),
    projectId,
  });
}

const app = initializeFirebase();
const db = admin.firestore(app);
db.settings({ ignoreUndefinedProperties: true });

function isIsoDateString(value) {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function toIsoString(value) {
  if (!value) return value;
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (isIsoDateString(value)) {
    return value;
  }
  return value;
}

function normalizeTimestamps(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeTimestamps(entry));
  }

  if (!value || typeof value !== 'object') {
    return toIsoString(value);
  }

  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = normalizeTimestamps(entry);
  }
  return out;
}

function asDocData(doc) {
  if (!doc || !doc.exists) return null;
  return normalizeTimestamps(doc.data());
}

async function nextSequence(counterName, transaction = null) {
  const counterRef = db.collection('counters').doc(counterName);

  if (transaction) {
    const snap = await transaction.get(counterRef);
    const current = snap.exists ? Number(snap.data().value || 0) : 0;
    const next = current + 1;
    transaction.set(counterRef, { value: next }, { merge: true });
    return next;
  }

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists ? Number(snap.data().value || 0) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    return next;
  });
}

async function ensureSeedData() {
  const existingUsers = await db.collection('users').limit(1).get();
  if (!existingUsers.empty) return;

  const now = new Date().toISOString();
  const passwordHash =
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; // password123

  const batch = db.batch();
  batch.set(db.collection('locations').doc('1'), {
    id: 1,
    name: 'Downtown Branch',
    address: '123 Main St',
    created_at: now,
  });
  batch.set(db.collection('locations').doc('2'), {
    id: 2,
    name: 'Uptown Branch',
    address: '456 Hill Ave',
    created_at: now,
  });

  const users = [
    { id: 1, name: 'Owner Ali', email: 'owner@restaurant.com', role: 'owner', location_id: null },
    { id: 2, name: 'Manager Sara', email: 'manager@restaurant.com', role: 'manager', location_id: 1 },
    { id: 3, name: 'Waiter Tom', email: 'waiter@restaurant.com', role: 'waiter', location_id: 1 },
    { id: 4, name: 'Chef Marco', email: 'kitchen@restaurant.com', role: 'kitchen', location_id: 1 },
  ];

  for (const user of users) {
    batch.set(db.collection('users').doc(String(user.id)), {
      ...user,
      email_lc: user.email.toLowerCase(),
      password_hash: passwordHash,
      created_at: now,
    });
  }

  const counterSeeds = {
    locations: 2,
    users: 4,
    menu_items: 0,
    ingredients: 0,
    inventory: 0,
    orders: 0,
    order_items: 0,
    sales: 0,
    menu_item_ingredients: 0,
  };

  for (const [name, value] of Object.entries(counterSeeds)) {
    batch.set(db.collection('counters').doc(name), { value });
  }

  await batch.commit();
  console.log('✅ Firestore seed data initialized.');
}

module.exports = {
  admin,
  db,
  asDocData,
  nextSequence,
  ensureSeedData,
};
