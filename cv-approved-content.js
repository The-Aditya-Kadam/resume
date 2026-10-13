// Owner-approved 2026-10-13 publication. Runs once; never reapplies over later edits.
const draft=require('./cv-drafts/assistant-technical-pm-20261013.json');
const ID='20261013-assistant-technical-pm-summary-skills';
async function publishApprovedContent(pool){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('CREATE TABLE IF NOT EXISTS cv_content_publications(id TEXT PRIMARY KEY,version INTEGER NOT NULL,published_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const result=await client.query('SELECT data,version FROM cv_documents WHERE id=1 FOR UPDATE');
    if((await client.query('SELECT id FROM cv_content_publications WHERE id=$1',[ID])).rows.length){await client.query('COMMIT');return {status:'already-published'};}
    const current=result.rows[0];
    if(!current||Number(current.version)!==draft.sourceVersion){await client.query('ROLLBACK');return {status:'version-conflict'};}
    const next=Number(current.version)+1;
    if((await client.query('SELECT id FROM cv_versions WHERE document_id=1 AND version>=$1',[next])).rows.length){await client.query('ROLLBACK');return {status:'history-conflict'};}
    const updated={...current.data,summary:draft.summary,competencies:draft.competencies};
    await client.query('INSERT INTO cv_versions(document_id,version,data) SELECT 1,$1,$2::jsonb WHERE NOT EXISTS(SELECT 1 FROM cv_versions WHERE document_id=1 AND version=$1)',[current.version,JSON.stringify(current.data)]);
    await client.query('UPDATE cv_documents SET data=$1::jsonb,version=$2,updated_at=NOW() WHERE id=1',[JSON.stringify(updated),next]);
    await client.query('INSERT INTO cv_versions(document_id,version,data) VALUES(1,$1,$2::jsonb)',[next,JSON.stringify(updated)]);
    await client.query('INSERT INTO cv_content_publications(id,version) VALUES($1,$2)',[ID,next]);
    await client.query('COMMIT');
    return {status:'published',version:next};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
module.exports={publishApprovedContent};
