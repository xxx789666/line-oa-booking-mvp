// tests/setup.js
// Provides per-test re-installable GAS mocks.
const gasMocks = require('./__mocks__/gas');
global.installGasMocks = gasMocks.installGlobals;
