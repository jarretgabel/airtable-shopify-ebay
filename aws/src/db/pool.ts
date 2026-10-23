import pg from 'pg';

let pool: pg.Pool | undefined;

/** Shared pool for the Postgres backend. Short timeouts so a slow database never stalls a request for long. */
export function getPostgresPool(env: NodeJS.ProcessEnv = process.env): pg.Pool {
  if (pool) return pool;

  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the Postgres data backend.');
  }

  const useTls = !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(connectionString);
  pool = new pg.Pool({
    connectionString,
    ssl: useTls ? { rejectUnauthorized: false } : false,
    max: 2,
    connectionTimeoutMillis: 3000,
    query_timeout: 5000,
    idleTimeoutMillis: 10000,
  });
  pool.on('error', () => undefined);
  return pool;
}
