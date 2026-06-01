const request = require('supertest');
const { seedMockDb, resetMockDb } = require('./mockFirestore');
const { buildDefaultSeed, authHeader, getUserByRole } = require('./fixtures');

let app;

function getApp() {
  if (!app) {
    app = require('../../app');
  }
  return app;
}

function setupTestDb(customSeed) {
  resetMockDb();
  seedMockDb(customSeed || buildDefaultSeed());
}

function api() {
  return request(getApp());
}

function asUser(role, locationId = 1) {
  const seed = buildDefaultSeed();
  const user = getUserByRole(seed, role, locationId);
  if (!user) {
    throw new Error(`No fixture user for role=${role} location=${locationId}`);
  }
  return {
    user,
    headers: authHeader(user),
    token: authHeader(user).Authorization.replace('Bearer ', ''),
  };
}

module.exports = {
  getApp,
  setupTestDb,
  api,
  asUser,
  authHeader,
  getUserByRole,
  buildDefaultSeed,
};
