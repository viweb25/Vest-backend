import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import requirementRoutes from './routes/requirement.routes';
import { errorHandler } from './middleware/error.middleware';
import { apiRateLimiter } from './middleware/rate-limit.middleware';
import { NotFoundError } from './utils/errors';
import { prisma } from './lib/prisma';
import { testConnection } from './lib/db';

const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Health Check
app.get('/health', async (req, res) => {
  try {
    const pgStatus = await testConnection();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      postgresql: pgStatus.connected ? 'connected' : 'disconnected',
    });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Health check failed' });
  }
});

// Apply rate limiter to all API routes
app.use('/api', apiRateLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/requirements', requirementRoutes);

// 404 Handler
app.use('*', (req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
});

// Error Handling
app.use(errorHandler);

export default app;
