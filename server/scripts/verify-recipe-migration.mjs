import dotenv from 'dotenv';

dotenv.config();
const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) {
  console.log(JSON.stringify({ verified: false, error: 'missing_supabase_config' }));
  process.exit(1);
}
const table = 'menu_resep_bahan';
const columns = 'id,menu,bahan_id,jumlah_per_porsi,satuan,created_at,updated_at';
try {
  const response = await fetch(new URL(`/rest/v1/${table}?select=${columns}&limit=0`, base), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  let detail = {};
  try { detail = await response.json(); } catch {}
  if (!response.ok) {
    console.log(JSON.stringify({ verified: false, table, status: response.status, code: detail.code || null, message: detail.message || null }));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ verified: true, table, expectedColumnsPresent: true }));
  }
} catch (error) {
  console.log(JSON.stringify({ verified: false, table, error: error?.code || error?.name || 'request_failed' }));
  process.exitCode = 1;
}
