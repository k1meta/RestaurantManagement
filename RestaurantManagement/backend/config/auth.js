require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const ENABLE_LOGIN_PROFILES = process.env.ENABLE_LOGIN_PROFILES === 'true';

let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (isTest) {
    JWT_SECRET = 'test-jwt-secret';
  } else {
    throw new Error('JWT_SECRET environment variable is required');
  }
}

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  ENABLE_LOGIN_PROFILES,
};
