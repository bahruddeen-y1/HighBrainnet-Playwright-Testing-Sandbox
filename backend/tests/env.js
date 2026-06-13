// Test environment — loaded before any module so config/env.js sees these.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://highbrainnet:dev_password@localhost:5432/highbrainnet_test?schema=public';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_xxxxxxxxxxxxxxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_xxxxxxxxxxxxxxx';
process.env.BCRYPT_COST = '10'; // faster tests
process.env.BUNNY_MOCK = 'true';
process.env.GBP_MOCK = 'true';
process.env.GBP_WEBHOOK_SECRET = 'test_webhook_secret';
process.env.LINE_NOTIFY_TOKEN = '';
process.env.RATE_LIMIT_MAX = '10000';
process.env.AUTH_RATE_LIMIT_MAX = '10000';
process.env.CORS_ORIGIN = 'http://localhost:5173';
