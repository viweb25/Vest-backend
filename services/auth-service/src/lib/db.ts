import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Ensure environment variables are loaded
dotenv.config();

const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
const dbName = process.env.DB_NAME || 'vest_db';
const dbUser = process.env.DB_USER || 'vest_user';
const dbPassword = process.env.DB_PASSWORD || '';

const poolConfig: PoolConfig = {
  host: dbHost,
  port: dbPort,
  database: dbName,
  user: dbUser,
  password: dbPassword,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

// Reusable PostgreSQL Connection Pool for Hostzop VPS
export const pool = new Pool(poolConfig);

// Pool-level error handling for idle clients
pool.on('error', (err) => {
  logger.error({ message: 'Unexpected error on idle PostgreSQL client', error: err.message });
});

/**
 * Execute a query with the pool
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.info({ message: 'Executed query', query: text, duration: `${duration}ms`, rows: res.rowCount });
    return res;
  } catch (error: any) {
    logger.error({ message: 'Database query execution failed', query: text, error: error.message });
    throw error;
  }
}

/**
 * Acquire a client from the pool (for transactions)
 */
export async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Test PostgreSQL database connection
 */
export async function testConnection(): Promise<{
  connected: boolean;
  database?: string;
  user?: string;
  timestamp?: string;
  error?: string;
}> {
  try {
    const result = await pool.query('SELECT current_database(), current_user, NOW();');
    const row = result.rows[0];
    return {
      connected: true,
      database: row.current_database,
      user: row.current_user,
      timestamp: row.now,
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err.message,
    };
  }
}

/**
 * Gracefully close the PostgreSQL connection pool
 */
export async function closePool(): Promise<void> {
  try {
    await pool.end();
    logger.info({ message: 'PostgreSQL connection pool closed.' });
  } catch (err: any) {
    logger.error({ message: 'Error closing PostgreSQL pool', error: err.message });
  }
}

export default pool;
