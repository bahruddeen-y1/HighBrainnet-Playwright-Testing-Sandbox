require('dotenv').config();

const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.string().url().default('http://localhost:4000'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  BUNNY_API_KEY: z.string().optional(),
  BUNNY_LIBRARY_ID: z.string().optional(),
  BUNNY_CDN_HOSTNAME: z.string().optional(),
  BUNNY_STREAM_TOKEN_KEY: z.string().optional(),

  GBP_MERCHANT_ID: z.string().optional(),
  GBP_API_KEY: z.string().optional(),
  GBP_SECRET_KEY: z.string().optional(),
  GBP_WEBHOOK_SECRET: z.string().optional(),

  LINE_NOTIFY_TOKEN: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

module.exports = {
  ...env,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  corsOrigins: env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
};
