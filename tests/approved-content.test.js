const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {publishApprovedContent}=require('../cv-approved-content');
const draft=require('../cv-drafts/assistant-technical-pm-20261013.json');
async function setup(t,version=7){
 const db=new PGlite();await db.waitReady;t.after(()=>db.close());
 const query=(sql,args)=>db.query(sql,args),pool={query,connect:async()=>({query,release(){}})};
 await query('CREATE TABLE cv_documents(id INTEGER PRIMARY KEY,data JSONB,version INTEGER,updated_at TIMESTAMPTZ DEFAULT NOW())');
 await query('CREATE TABLE cv_versions(id SERIAL PRIMARY KEY,document_id INTEGER,version INTEGER,data JSONB)');
 const data={summary:'Original summary',competencies:[{title:'Original',text:'Saved'}],experience:[{company:'Preserved',proof:'https://example.com'}],ui:{knowledgeEdited:false},attachments:{resume:null},optional:''};
 await query('INSERT INTO cv_documents(id,data,version) VALUES(1,$1,$2)',[data,version]);
 await query('INSERT INTO cv_versions(document_id,version,data) VALUES(1,6,$1),(1,$2,$1)',[data,version]);
 return {pool,data};
}
test('approved publication changes only two fields, appends history and never replays over edits',async t=>{
 const {pool,data}=await setup(t);const prior=(await pool.query('SELECT * FROM cv_versions ORDER BY id')).rows;
 assert.deepEqual(await publishApprovedContent(pool),{status:'published',version:8});
 const current=(await pool.query('SELECT * FROM cv_documents')).rows[0];
 assert.equal(current.version,8);assert.deepEqual(current.data,{...data,summary:draft.summary,competencies:draft.competencies});
 const history=(await pool.query('SELECT * FROM cv_versions ORDER BY id')).rows;assert.deepEqual(history.slice(0,2),prior);assert.deepEqual(history[2].data,current.data);
 await pool.query('UPDATE cv_documents SET data=$1,version=9 WHERE id=1',[{...current.data,summary:'Later owner edit'}]);
 assert.deepEqual(await publishApprovedContent(pool),{status:'already-published'});
 assert.equal((await pool.query('SELECT data FROM cv_documents')).rows[0].data.summary,'Later owner edit');
 assert.equal((await pool.query('SELECT COUNT(*) AS n FROM cv_versions')).rows[0].n,3);
});
test('a newer CV blocks publication without modifying data or history',async t=>{
 const {pool,data}=await setup(t,9);const prior=(await pool.query('SELECT * FROM cv_versions ORDER BY id')).rows;
 assert.deepEqual(await publishApprovedContent(pool),{status:'version-conflict'});
 assert.deepEqual((await pool.query('SELECT data FROM cv_documents')).rows[0].data,data);
 assert.deepEqual((await pool.query('SELECT * FROM cv_versions ORDER BY id')).rows,prior);
});
