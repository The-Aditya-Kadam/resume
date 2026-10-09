const test = require('node:test');
const assert = require('node:assert/strict');
const { targetConfig, copyCV } = require('../cv-migration');
const { databaseConfig } = require('../server');

test('Neon cutover is explicit, validates TLS and retains the Render rollback configuration', () => {
  const env = { DATABASE_URL: 'postgresql://source-user:source-test@render-internal/source-db',
    CV_MIGRATION_TARGET_URL: 'postgresql://neondb_owner:target-test@ep-muddy-glade-b5ycbay7-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require' };
  assert.equal(databaseConfig(env).connectionString,env.DATABASE_URL);
  const neon = databaseConfig({...env,CV_DATABASE_MODE:'neon'});
  assert.equal(new URL(neon.connectionString).hostname,'ep-muddy-glade-b5ycbay7-pooler.c-7.us-east-2.aws.neon.tech');
  assert.equal(neon.ssl.rejectUnauthorized,true);
  assert.equal(databaseConfig({...env,CV_DATABASE_MODE:''}).connectionString,env.DATABASE_URL);
  assert.throws(()=>databaseConfig({DATABASE_URL:env.DATABASE_URL,CV_DATABASE_MODE:'neon'}),/NEON_DATABASE_URL_NOT_CONFIGURED/);
});

test('migration only accepts the intended Neon database and verifies TLS', () => {
  const raw = 'postgresql://neondb_owner:test-password@ep-muddy-glade-b5ycbay7-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const config = targetConfig(raw);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.enableChannelBinding, true);
  assert.equal(new URL(config.connectionString).searchParams.has('sslmode'), false);
  assert.throws(() => targetConfig(raw.replace('neondb?', 'other?')), /UNEXPECTED_TARGET_DATABASE/);
  assert.throws(() => targetConfig(raw.replace('aws.neon.tech', 'example.com')), /UNEXPECTED_TARGET_DATABASE/);
});

test('source is read-only and released when unexpected tables stop the copy', async () => {
  const commands = [];
  let released = false, targetTouched = false;
  const source = { async query(sql) {
    commands.push(sql);
    return { rows: sql.includes('information_schema.tables') ? [{table_name:'other'}] : [] };
  }, release() { released = true; } };
  await assert.rejects(copyCV({connect:async()=>source}, {connect:async()=>{targetTouched=true;}}), /UNEXPECTED_DATABASE_TABLES/);
  assert.equal(commands[0], 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(commands.at(-1), 'ROLLBACK');
  assert.equal(commands.some(sql => /^(INSERT|UPDATE|DELETE|CREATE|DROP|TRUNCATE)/.test(sql)), false);
  assert.equal(targetTouched, false);
  assert.equal(released, true);
});

// Full transactional PostgreSQL checks can be run with a locally installed PGlite
// module path. It is deliberately not a production dependency.
const modulePath = process.env.PGLITE_TEST_MODULE;
test('PostgreSQL copy preserves history, precise timestamps and sequence; refuses overwrites', { skip: !modulePath }, async () => {
  const {PGlite} = require(modulePath);
  const source = new PGlite(), target = new PGlite();
  const pool = db => ({ connect: async () => ({ query:(sql,args)=>db.query(sql,args), release(){} }) });
  try {
    await source.exec(`CREATE TABLE cv_documents(id INTEGER PRIMARY KEY,data JSONB NOT NULL,version INTEGER NOT NULL DEFAULT 1,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE cv_versions(id BIGSERIAL PRIMARY KEY,document_id INTEGER NOT NULL REFERENCES cv_documents(id) ON DELETE CASCADE,version INTEGER NOT NULL,data JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      INSERT INTO cv_documents VALUES (1,'{"optional":"","attachments":{"resume":{"content":"base64-data"}}}',7,'2026-01-01 00:00:00.123456+00','2026-10-08 11:16:48.126789+00');
      INSERT INTO cv_versions(id,document_id,version,data,created_at) VALUES (2,1,1,'{"optional":"old"}','2026-01-01 00:00:00.987654+00'),(9,1,7,'{"optional":""}','2026-10-08 11:16:48.126789+00');
      SELECT setval('cv_versions_id_seq',17,true);`);
    await target.query("SET TIME ZONE 'America/New_York'");
    const rowSQL = 'SELECT id,data,version,extract(epoch from created_at)::text AS created_at,extract(epoch from updated_at)::text AS updated_at FROM cv_documents';
    const baseline = (await source.query(rowSQL)).rows;
    const result = await copyCV(pool(source), pool(target));
    assert.equal(result.copied, true); assert.equal(result.documents,1); assert.equal(result.versions,2); assert.equal(result.publishedVersion,'7');
    assert.deepEqual((await target.query(rowSQL)).rows,baseline);
    assert.deepEqual((await source.query(rowSQL)).rows,baseline);
    assert.deepEqual((await target.query('SELECT last_value::text,is_called FROM cv_versions_id_seq')).rows,[{last_value:'17',is_called:true}]);
    assert.equal((await copyCV(pool(source),pool(target))).copied,false);
    await target.query("UPDATE cv_documents SET data='{}'");
    const changed = (await target.query('SELECT data::text FROM cv_documents')).rows;
    await assert.rejects(copyCV(pool(source),pool(target)), /TARGET_NOT_EMPTY_OR_IDENTICAL/);
    assert.deepEqual((await target.query('SELECT data::text FROM cv_documents')).rows,changed);
    assert.equal((await target.query('SELECT count(*)::int AS n FROM cv_versions')).rows[0].n,2);
  } finally {await source.close(); await target.close();}
});
