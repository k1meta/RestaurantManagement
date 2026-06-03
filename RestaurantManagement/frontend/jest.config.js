module.exports = {
    preset: 'jest-expo',
    setupFilesAfterEnv: [
        '<rootDir>/jest.setup.js',
        '@testing-library/jest-native/extend-expect',
    ],
    testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
    testTimeout: 30000,
    maxWorkers: 1,
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
    ],
    collectCoverage: process.env.CI === 'true',
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    collectCoverageFrom: [
        'src/**/*.{js,jsx}',
        '!src/constants/**',
        '!src/theme/**',
        '!src/i18n/**'
    ]
};