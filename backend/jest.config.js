module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/env.js'],
  testTimeout: 15000,
  // run files serially — they share one test database
  maxWorkers: 1,
};
