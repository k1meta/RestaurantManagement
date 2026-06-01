/**
 * In-memory Firestore mock for unit/integration/E2E API tests.
 */

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

class MockDocumentSnapshot {
  constructor(exists, id, data, ref) {
    this.exists = exists;
    this.id = id;
    this._data = data;
    this.ref = ref;
  }

  data() {
    return this._data == null ? undefined : cloneDeep(this._data);
  }
}

class MockQuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }
}

class MockDocumentReference {
  constructor(store, collectionName, docId) {
    this._store = store;
    this._collectionName = collectionName;
    this._docId = String(docId);
    this.id = this._docId;
    this.path = `${collectionName}/${this._docId}`;
  }

  get() {
    return Promise.resolve(this._store._getDocSnapshot(this._collectionName, this._docId));
  }

  set(data, options = {}) {
    this._store._setDoc(this._collectionName, this._docId, data, options);
    return Promise.resolve();
  }

  update(data) {
    this._store._updateDoc(this._collectionName, this._docId, data);
    return Promise.resolve();
  }

  delete() {
    this._store._deleteDoc(this._collectionName, this._docId);
    return Promise.resolve();
  }
}

class MockQuery {
  constructor(store, collectionName, filters = [], limitCount = null) {
    this._store = store;
    this._collectionName = collectionName;
    this._filters = filters;
    this._limitCount = limitCount;
  }

  where(field, op, value) {
    if (op !== '==') {
      throw new Error(`Mock Firestore only supports == queries, got ${op}`);
    }
    return new MockQuery(this._store, this._collectionName, [...this._filters, { field, value }], this._limitCount);
  }

  limit(count) {
    return new MockQuery(this._store, this._collectionName, this._filters, count);
  }

  get() {
    return Promise.resolve(this._store._getQuerySnapshot(this._collectionName, this._filters, this._limitCount));
  }
}

class MockCollectionReference {
  constructor(store, collectionName) {
    this._store = store;
    this._collectionName = collectionName;
  }

  doc(docId) {
    return new MockDocumentReference(this._store, this._collectionName, docId);
  }

  get() {
    return Promise.resolve(this._store._getQuerySnapshot(this._collectionName, [], null));
  }

  where(field, op, value) {
    return new MockQuery(this._store, this._collectionName, [{ field, value }], null);
  }

  limit(count) {
    return new MockQuery(this._store, this._collectionName, [], count);
  }
}

class MockTransaction {
  constructor(store) {
    this._store = store;
    this._pending = [];
  }

  get(refOrQuery) {
    if (refOrQuery instanceof MockDocumentReference) {
      const snap = this._store._getDocSnapshot(refOrQuery._collectionName, refOrQuery._docId);
      return Promise.resolve(snap);
    }
    if (refOrQuery instanceof MockQuery) {
      return Promise.resolve(
        this._store._getQuerySnapshot(
          refOrQuery._collectionName,
          refOrQuery._filters,
          refOrQuery._limitCount
        )
      );
    }
    if (refOrQuery instanceof MockCollectionReference) {
      return Promise.resolve(
        this._store._getQuerySnapshot(refOrQuery._collectionName, [], null)
      );
    }
    throw new Error('MockTransaction.get: unsupported reference type');
  }

  set(ref, data, options = {}) {
    if (!(ref instanceof MockDocumentReference)) {
      throw new Error('MockTransaction.set: expected document reference');
    }
    this._pending.push({ type: 'set', collection: ref._collectionName, id: ref._docId, data, options });
    return this;
  }
}

class MockFirestoreStore {
  constructor() {
    this._collections = {};
  }

  reset() {
    this._collections = {};
  }

  seedCollection(collectionName, docs) {
    if (!this._collections[collectionName]) {
      this._collections[collectionName] = {};
    }
    for (const doc of docs) {
      const id = String(doc.id);
      this._collections[collectionName][id] = cloneDeep(doc);
    }
  }

  getCollectionData(collectionName) {
    const col = this._collections[collectionName] || {};
    return Object.values(col).map((doc) => cloneDeep(doc));
  }

  getDoc(collectionName, docId) {
    const col = this._collections[collectionName] || {};
    return col[String(docId)] ? cloneDeep(col[String(docId)]) : null;
  }

  collection(name) {
    return new MockCollectionReference(this, name);
  }

  runTransaction(fn) {
    const tx = new MockTransaction(this);
    return fn(tx).then((result) => {
      for (const op of tx._pending) {
        if (op.type === 'set') {
          this._setDoc(op.collection, op.id, op.data, op.options);
        }
      }
      return result;
    });
  }

  _getDocSnapshot(collectionName, docId) {
    const ref = new MockDocumentReference(this, collectionName, docId);
    const data = this.getDoc(collectionName, docId);
    return new MockDocumentSnapshot(data != null, String(docId), data, ref);
  }

  _matchesFilters(doc, filters) {
    return filters.every(({ field, value }) => {
      const docValue = doc[field];
      if (typeof value === 'number' && typeof docValue === 'number') {
        return docValue === value;
      }
      return String(docValue) === String(value);
    });
  }

  _getQuerySnapshot(collectionName, filters, limitCount) {
    const col = this._collections[collectionName] || {};
    let docs = Object.entries(col)
      .filter(([, data]) => this._matchesFilters(data, filters))
      .map(([id, data]) => {
        const ref = new MockDocumentReference(this, collectionName, id);
        return new MockDocumentSnapshot(true, id, cloneDeep(data), ref);
      });

    if (limitCount != null) {
      docs = docs.slice(0, limitCount);
    }

    return new MockQuerySnapshot(docs);
  }

  _setDoc(collectionName, docId, data, options = {}) {
    if (!this._collections[collectionName]) {
      this._collections[collectionName] = {};
    }
    const id = String(docId);
    const existing = this._collections[collectionName][id] || {};
    this._collections[collectionName][id] = options.merge
      ? { ...existing, ...cloneDeep(data) }
      : cloneDeep(data);
  }

  _updateDoc(collectionName, docId, data) {
    this._setDoc(collectionName, docId, data, { merge: true });
  }

  _deleteDoc(collectionName, docId) {
    const col = this._collections[collectionName];
    if (col) {
      delete col[String(docId)];
    }
  }
}

const sharedStore = new MockFirestoreStore();

function createMockDb() {
  return {
    collection: (name) => sharedStore.collection(name),
    runTransaction: (fn) => sharedStore.runTransaction(fn),
    settings: () => {},
  };
}

const db = createMockDb();

function resetMockDb() {
  sharedStore.reset();
}

function seedMockDb(collections) {
  resetMockDb();
  for (const [name, docs] of Object.entries(collections)) {
    sharedStore.seedCollection(name, docs);
  }
}

function getMockStore() {
  return sharedStore;
}

function asDocData(doc) {
  if (!doc || !doc.exists) return null;
  return doc.data();
}

async function nextSequence(counterName, transaction = null) {
  const counterRef = sharedStore.collection('counters').doc(counterName);

  if (transaction) {
    const snap = await transaction.get(counterRef);
    const current = snap.exists ? Number(snap.data().value || 0) : 0;
    const next = current + 1;
    transaction.set(counterRef, { value: next }, { merge: true });
    return next;
  }

  return sharedStore.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists ? Number(snap.data().value || 0) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    return next;
  });
}

async function ensureSeedData() {
  return Promise.resolve();
}

module.exports = {
  db,
  sharedStore,
  createMockDb,
  resetMockDb,
  seedMockDb,
  getMockStore,
  asDocData,
  nextSequence,
  ensureSeedData,
  admin: { apps: [] },
};
