import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(root, 'db', 'migrations');
const connectionString = process.env.DEMIAN_DATABASE_URL;
if (!connectionString) {
  console.error('Migration aborted: DEMIAN_DATABASE_URL is not configured.');
  process.exit(1);
}
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 10000 });
try {
  await pool.query(`CREATE TABLE IF NOT EXISTS public.demian_schema_migrations (
    name TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const files = (await readdir(migrationsDir)).filter(name => /^\d+_[a-z0-9_-]+\.sql$/i.test(name)).sort();
  for (const name of files) {
    const sql = await readFile(join(migrationsDir, name), 'utf8');
    const { createHash } = await import('node:crypto');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const previous = await pool.query('SELECT checksum FROM public.demian_schema_migrations WHERE name=$1', [name]);
    if (previous.rows.length) {
      if (previous.rows[0].checksum !== checksum) throw new Error(`Applied migration was edited: ${name}. Add a new migration instead.`);
      console.log(`Already applied: ${name}`);
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO public.demian_schema_migrations(name,checksum) VALUES($1,$2)', [name, checksum]);
      await client.query('COMMIT');
      console.log(`Applied: ${name}`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  console.log('Database migrations completed.');
} catch (error) {
  console.error('Database migration failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
} finally {
  await pool.end();
}
