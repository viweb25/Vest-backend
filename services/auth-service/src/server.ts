import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { prisma } from './lib/prisma';
import { closePool } from './lib/db';
import { logger } from './utils/logger';

// Ensure DATABASE_URL is constructed from VPS DB_* vars if not directly set
if (!process.env.DATABASE_URL && process.env.DB_USER && process.env.DB_NAME) {
  process.env.DATABASE_URL = `postgresql://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME}`;
}

const requiredEnvVars = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error({ message: `Missing critical environment variable: ${envVar}` });
    process.exit(1);
  }
}

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  logger.info({ message: `Auth Service is running on port ${PORT}` });
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ message: `Received ${signal}. Shutting down gracefully...` });
  
  server.close(async () => {
    logger.info({ message: 'HTTP server closed.' });
    try {
      await Promise.allSettled([
        prisma.$disconnect(),
        closePool(),
      ]);
      logger.info({ message: 'Database connections closed.' });
      process.exit(0);
    } catch (err) {
      logger.error({ message: 'Error during database disconnection', error: err });
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error({ message: 'Could not close connections in time, forcefully shutting down' });
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ message: 'Unhandled Rejection', reason, promise });
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ message: 'Uncaught Exception', error: err.message, stack: err.stack });
  shutdown('uncaughtException');
});
