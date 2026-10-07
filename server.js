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

  const result = await pool.query("SELECT id FROM cv_documents WHERE id = 1 LIMIT 1");

  if (result.rowCount === 0) {
    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    await pool.query(
      "INSERT INTO cv_documents (id, data, version) VALUES (1, $1::jsonb, 1)",
      [JSON.stringify(data)]
    );
    console.log("Current CV data uploaded to PostgreSQL.");
  } else {
    console.log("CV data already exists; no seed overwrite performed.");
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
