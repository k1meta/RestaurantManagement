/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testTimeout: 15000,
  maxWorkers: 1,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    'constants/**/*.js',
    'config/db.js',
    'app.js',
    '!scripts/**',
    '!functions/**',
  ],
  coverageThreshold: {
    global: {
      lines: 70,
    },
  },
  coverageDirectory: 'coverage',
  verbose: true,
};
