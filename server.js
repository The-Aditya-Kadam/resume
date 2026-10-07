const http = require("http");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const PORT = process.env.PORT || 10000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const dataPath = path.join(__dirname, "cv-page", "data.json");

async function ensureDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cv_documents (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cv_versions (
      id BIGSERIAL PRIMARY KEY,
      document_id INTEGER NOT NULL REFERENCES cv_documents(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const result = await pool.query("SELECT id, data, version FROM cv_documents WHERE id = 1 LIMIT 1");

  if (result.rowCount === 0) {
    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    await pool.query(
      "INSERT INTO cv_documents (id, data, version) VALUES (1, $1::jsonb, 1)",
      [JSON.stringify(data)]
    );
    await pool.query(
      "INSERT INTO cv_versions (document_id, version, data) VALUES (1, 1, $1::jsonb)",
      [JSON.stringify(data)]
    );
    console.log("Current CV data uploaded to PostgreSQL.");
  } else {
    const history = await pool.query("SELECT 1 FROM cv_versions WHERE document_id = 1 LIMIT 1");
    if (history.rowCount === 0) {
      await pool.query(
        "INSERT INTO cv_versions (document_id, version, data) VALUES (1, $1, $2::jsonb)",
        [result.rows[0].version || 1, JSON.stringify(result.rows[0].data)]
      );
      console.log("Initial CV version added to rollback history.");
    } else {
      console.log("CV data already exists; no seed overwrite performed.");
    }
  }
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 2_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, {});
    return;
  }

  if (req.url === "/health") {
    send(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && req.url === "/api/cv") {
    try {
      const result = await pool.query(
        "SELECT data, version, updated_at FROM cv_documents WHERE id = 1 LIMIT 1"
      );

      if (result.rowCount === 0) {
        send(res, 404, { error: "CV data not found" });
        return;
      }

      send(res, 200, {
        data: result.rows[0].data,
        version: result.rows[0].version,
        updatedAt: result.rows[0].updated_at
      });
    } catch (error) {
      console.error(error);
      send(res, 500, { error: "Database error" });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/cv") {
    try {
      const body = await readBody(req);
      const data = body && body.data;

      if (!data || typeof data !== "object" || Array.isArray(data)) {
        send(res, 400, { error: "A CV data object is required." });
        return;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const current = await client.query(
          "SELECT version FROM cv_documents WHERE id = 1 FOR UPDATE"
        );

        const nextVersion = current.rowCount
          ? Number(current.rows[0].version || 1) + 1
          : 1;

        await client.query(
          "INSERT INTO cv_versions (document_id, version, data) VALUES (1, $1, $2::jsonb)",
          [nextVersion, JSON.stringify(data)]
        );

        await client.query(
          `INSERT INTO cv_documents (id, data, version)
           VALUES (1, $1::jsonb, $2)
           ON CONFLICT (id) DO UPDATE
           SET data = EXCLUDED.data, version = EXCLUDED.version, updated_at = NOW()`,
          [JSON.stringify(data), nextVersion]
        );

        await client.query(
          `DELETE FROM cv_versions
           WHERE document_id = 1
             AND id NOT IN (
               SELECT id FROM cv_versions
               WHERE document_id = 1
               ORDER BY version DESC
               LIMIT 5
             )`
        );

        await client.query("COMMIT");
        send(res, 200, { ok: true, version: nextVersion });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(error);
      send(res, 500, { error: "Unable to save CV data." });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/cv/rollback") {
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const current = await client.query(
          "SELECT version FROM cv_documents WHERE id = 1 FOR UPDATE"
        );

        if (current.rowCount === 0) {
          await client.query("ROLLBACK");
          send(res, 404, { error: "CV data not found." });
          return;
        }

        const previous = await client.query(
          `SELECT version, data
           FROM cv_versions
           WHERE document_id = 1 AND version < $1
           ORDER BY version DESC
           LIMIT 1`,
          [current.rows[0].version]
        );

        if (previous.rowCount === 0) {
          await client.query("ROLLBACK");
          send(res, 409, { error: "No previous CV version available." });
          return;
        }

        const version = previous.rows[0].version;
        const data = previous.rows[0].data;

        await client.query(
          "UPDATE cv_documents SET data = $1::jsonb, version = $2, updated_at = NOW() WHERE id = 1",
          [JSON.stringify(data), version]
        );

        await client.query(
          "DELETE FROM cv_versions WHERE document_id = 1 AND version >= $1",
          [version]
        );

        await client.query("COMMIT");
        send(res, 200, { ok: true, version, data });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(error);
      send(res, 500, { error: "Unable to roll back CV data." });
    }
    return;
  }

  send(res, 404, { error: "Not found" });
});

async function start() {
  await ensureDatabase();
  server.listen(PORT, "0.0.0.0", () => {
    console.log("CV API listening on port " + PORT);
  });
}

start().catch((error) => {
  console.error("Startup failed:", error);
  process.exit(1);
});
