const { db, asDocData } = require('../config/db');

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function byNameAsc(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''));
}

function byCreatedAtDesc(a, b) {
  return String(b.created_at || '').localeCompare(String(a.created_at || ''));
}

async function listCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  return snap.docs
    .map((doc) => asDocData(doc))
    .filter(Boolean);
}

async function getById(collectionName, id) {
  const parsed = toNumber(id);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  const snap = await db.collection(collectionName).doc(String(parsed)).get();
  return asDocData(snap);
}

async function deleteById(collectionName, id) {
  const parsed = toNumber(id);
  if (!Number.isInteger(parsed) || parsed <= 0) return false;
  const ref = db.collection(collectionName).doc(String(parsed));
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

function roleRank(role) {
  switch (role) {
    case 'owner':
      return 1;
    case 'manager':
      return 2;
    case 'waiter':
      return 3;
    case 'kitchen':
      return 4;
    default:
      return 5;
  }
}

module.exports = {
  db,
  toNumber,
  byNameAsc,
  byCreatedAtDesc,
  listCollection,
  getById,
  deleteById,
  roleRank,
};
