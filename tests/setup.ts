// Test-wide setup. Runs once before all tests.
// Provide a stable ENCRYPTION_KEY for crypto tests; individual tests can override.
process.env.ENCRYPTION_KEY ??=
  "test-encryption-key-do-not-use-in-production-test-test-test-1234";
