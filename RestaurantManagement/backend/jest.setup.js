process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.ENABLE_LOGIN_PROFILES = process.env.ENABLE_LOGIN_PROFILES || 'true';

jest.mock('./config/db', () => require('./__tests__/helpers/mockFirestore'));

beforeEach(() => {
  jest.clearAllMocks();
});
