const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');
const logger = require('./utils/logger');

async function start() {
  try {
    await prisma.$connect();
    logger.info('✅ Connected to PostgreSQL');
  } catch (err) {
    logger.error(`Database connection failed: ${err.message}`);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 HighBrainnet API listening on http://localhost:${env.PORT}`);
    logger.info(`   env=${env.NODE_ENV}  cors=[${env.corsOrigins.join(', ')}]`);
  });

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
