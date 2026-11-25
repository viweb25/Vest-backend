import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    logger.warn({
      message: err.message,
      code: err.code,
      path: req.path,
    });
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: { code: err.code }
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn({ message: 'Prisma Error', code: err.code, meta: err.meta });
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Unique constraint failed',
        error: { code: 'CONFLICT_ERROR', details: err.meta?.target }
      });
    }
    return res.status(400).json({
      success: false,
      message: 'Database request error',
      error: { code: 'DB_ERROR' }
    });
  }

  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
  });

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: { code: 'INTERNAL_SERVER_ERROR' }
  });
};
