import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: new URL('../.env', import.meta.url).pathname });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000, ssl: { rejectUnauthorized: false } });
try {
  const target = await pool.query(`SELECT current_database() AS db, current_schema() AS schema, current_user AS role`);
  const existing = await pool.query(`SELECT to_regclass('public.menu_resep_bahan') AS recipe_table`);
  const migrationLedger = await pool.query(`SELECT to_regclass('supabase_migrations.schema_migrations') AS ledger`);
  console.log(JSON.stringify({ connected: true, database: target.rows[0].db, schema: target.rows[0].schema, role: target.rows[0].role, recipeTableExists: Boolean(existing.rows[0].recipe_table), migrationLedgerExists: Boolean(migrationLedger.rows[0].ledger) }));
} catch (err) {
  console.log(JSON.stringify({ connected: false, error: String(err?.code || err?.name || 'connection-error') }));
  process.exitCode = 1;
} finally { await pool.end(); }
