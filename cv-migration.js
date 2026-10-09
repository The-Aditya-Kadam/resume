// One-time copy only. The live API continues to use DATABASE_URL (Render).
const { Pool } = require('pg');
const { createHash } = require('node:crypto');

const tables = ['cv_documents', 'cv_versions'];
const columns = {
  cv_documents: ['id:integer', 'data:jsonb', 'version:integer', 'created_at:timestamp with time zone', 'updated_at:timestamp with time zone'],
  cv_versions: ['id:bigint', 'document_id:integer', 'version:integer', 'data:jsonb', 'created_at:timestamp with time zone']
};
function fail(code) { const error = new Error(code); error.migrationCode = code; throw error; }
function targetConfig(raw) {
  let url;
  try { url = new URL(raw); } catch { fail('INVALID_TARGET_URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !/^ep-muddy-glade-b5ycbay7(?:-pooler)?\.c-7\.us-east-2\.aws\.neon\.tech$/.test(url.hostname) ||
      url.pathname !== '/neondb' || !url.password) fail('UNEXPECTED_TARGET_DATABASE');
  // Explicitly validate the server certificate; URL sslmode must not override this.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'channel_binding']) url.searchParams.delete(key);
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: true }, enableChannelBinding: true,
    max: 1, connectionTimeoutMillis: 15000, application_name: 'cv-data-copy' };
}
async function checkSchema(client, source) {
  const names = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name")).rows.map(r => r.table_name);
  if (names.some(name => !tables.includes(name)) || (source && names.join() !== tables.join())) fail('UNEXPECTED_DATABASE_TABLES');
  for (const table of names) {
    const actual = (await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position", [table])).rows.map(r => r.column_name + ':' + r.data_type);
    if (JSON.stringify(actual) !== JSON.stringify(columns[table])) fail('UNEXPECTED_TABLE_SCHEMA');
  }
}
async function snapshot(client) {
  const timestamp = name => `to_char(${name} AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.US') || '+00' AS ${name}`;
  const documents = (await client.query(`SELECT id::text, data::text, version::text, ${timestamp('created_at')}, ${timestamp('updated_at')} FROM public.cv_documents ORDER BY id`)).rows;
  const versions = (await client.query(`SELECT id::text, document_id::text, version::text, data::text, ${timestamp('created_at')} FROM public.cv_versions ORDER BY id`)).rows;
  return { documents, versions };
}
function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
async function copyCV(sourcePool, targetPool) {
  const source = await sourcePool.connect();
  let target, sourceTransaction = false, targetTransaction = false;
  try {
    await source.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'); sourceTransaction = true;
    await source.query("SET LOCAL TIME ZONE 'UTC'");
    await source.query("SET LOCAL statement_timeout = '30s'");
    await checkSchema(source, true);
    const original = await snapshot(source);
    if (!original.documents.some(row => row.id === '1') || !original.versions.length) fail('SOURCE_CV_OR_HISTORY_EMPTY');
    const sequence = (await source.query('SELECT last_value::text, is_called FROM public.cv_versions_id_seq')).rows[0];
    if (!sequence) fail('SOURCE_SEQUENCE_MISSING');
    target = await targetPool.connect();
    await target.query('BEGIN'); targetTransaction = true;
    await target.query("SET LOCAL TIME ZONE 'UTC'");
    await target.query("SET LOCAL statement_timeout = '30s'");
    await target.query("SET LOCAL lock_timeout = '5s'");
    await checkSchema(target, false);
    await target.query(`CREATE TABLE IF NOT EXISTS public.cv_documents (
      id INTEGER PRIMARY KEY, data JSONB NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await target.query(`CREATE TABLE IF NOT EXISTS public.cv_versions (
      id BIGSERIAL PRIMARY KEY, document_id INTEGER NOT NULL REFERENCES public.cv_documents(id) ON DELETE CASCADE,
      version INTEGER NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await target.query('LOCK TABLE public.cv_documents, public.cv_versions IN EXCLUSIVE MODE');
    const existing = await snapshot(target);
    let copied = false;
    if (existing.documents.length || existing.versions.length) {
      if (digest(existing) !== digest(original)) fail('TARGET_NOT_EMPTY_OR_IDENTICAL');
    } else {
      for (const row of original.documents) await target.query(
        'INSERT INTO public.cv_documents (id,data,version,created_at,updated_at) VALUES ($1,$2::jsonb,$3,$4::timestamptz,$5::timestamptz)',
        [row.id, row.data, row.version, row.created_at, row.updated_at]);
      for (const row of original.versions) await target.query(
        'INSERT INTO public.cv_versions (id,document_id,version,data,created_at) VALUES ($1,$2,$3,$4::jsonb,$5::timestamptz)',
        [row.id, row.document_id, row.version, row.data, row.created_at]);
      copied = true;
    }
    const verified = await snapshot(target);
    if (digest(verified) !== digest(original)) fail('COPY_VERIFICATION_FAILED');
    if (copied) {
      const maxId = original.versions.reduce((n, row) => BigInt(row.id) > n ? BigInt(row.id) : n, 0n);
      const last = BigInt(sequence.last_value);
      const value = last > maxId ? last : maxId;
      // Sequence changes are not transactional; only touch it after all row checks pass.
      await target.query("SELECT setval('public.cv_versions_id_seq', $1::bigint, $2::boolean)",
        [value.toString(), value === last ? sequence.is_called : true]);
    }
    await target.query('COMMIT'); targetTransaction = false;
    await source.query('COMMIT'); sourceTransaction = false;
    // Independent read after COMMIT confirms durability, not only transactional visibility.
    const committed = await snapshot(target);
    if (digest(committed) !== digest(original)) fail('COMMITTED_COPY_VERIFICATION_FAILED');
    return { copied, documents: original.documents.length, versions: original.versions.length,
      publishedVersion: original.documents.find(row => row.id === '1').version, sha256: digest(original) };
  } finally {
    if (targetTransaction) await target.query('ROLLBACK').catch(() => {});
    if (sourceTransaction) await source.query('ROLLBACK').catch(() => {});
    target?.release(); source.release();
  }
}
async function runConfiguredCopy(sourcePool, raw) {
  const targetPool = new Pool(targetConfig(raw));
  try { return await copyCV(sourcePool, targetPool); } finally { await targetPool.end(); }
}
module.exports = { copyCV, targetConfig, digest, runConfiguredCopy };
