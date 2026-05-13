module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  moduleDirectories: ['node_modules', 'src'],
  collectCoverageFrom: ['src/**/*.js', '!src/liff/**'],
  verbose: true
};
