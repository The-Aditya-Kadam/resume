const http = require("http");
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
    throw new Error("CV database is empty. Save an initial CV from /cv-management/.");
  }

  const normalized = normalizeData(result.rows[0].data || {});
  if (JSON.stringify(normalized) !== JSON.stringify(result.rows[0].data || {})) {
    await pool.query(
      "UPDATE cv_documents SET data = $1::jsonb, updated_at = NOW() WHERE id = 1",
      [JSON.stringify(normalized)]
    );
    console.log("Normalized existing CV data to the current schema.");
  }

  const history = await pool.query("SELECT 1 FROM cv_versions WHERE document_id = 1 LIMIT 1");
  if (history.rowCount === 0) {
    await pool.query(
      "INSERT INTO cv_versions (document_id, version, data) VALUES (1, $1, $2::jsonb)",
      [result.rows[0].version || 1, JSON.stringify(normalized)]
    );
    console.log("Initial CV version added to rollback history.");
  } else {
    console.log("CV data already exists; no seed overwrite performed.");
  }
}

function normalizeData(input) {
  const d = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const out = { ...d };

  out.site = {
    title: d.site?.title || d.siteTitle || "Aditya Kadam | Assistant Technical Project Manager",
    description: d.site?.description || d.metaDescription || ""
  };

  const uiDefaults = {
    nav: {summary:"Summary", education:"Education", skills:"Skills", experience:"Experience", knowledge:"Knowledge", contact:"Contact"},
    availability: "Open to opportunities",
    heroEyebrow: "SENIOR WORDPRESS DEVELOPER · TEAM LEADER · DIGITAL MARKETING MANAGER",
    summaryKicker: "01 / Summary", summaryTitle: "PM, TL, SEO & DATA.",
    educationKicker: "02 / Education", educationTitle: "EDUCATION.",
    certificationKicker: "03 / Certification", certificationTitle: "CERTIFICATION.",
    achievementsKicker: "04 / Achievements", achievementsTitle: "ACHIEVEMENTS.",
    skillsKicker: "05 / Additional information", skillsTitle: "SKILLS & TOOLS.",
    experienceKicker: "06 / Work experience", experienceTitle: "TEN YEARS, STACKED.",
    knowledgeKicker: "07 / Knowledge", knowledgeTitle: "KNOWLEDGE.",
    contactKicker: "08 / Thank you", contactTitle: "LET’S BUILD SOMETHING USEFUL.",
    contactAvailability: "Open to remote & relocation",
    footerLeft: "ADITYA S. KADAM · 2026",
    footerRight: "WORDPRESS · TEAM LEADERSHIP · DIGITAL MARKETING · DATA",
    heroMetrics: [
      { value: "10", label: "years web development" },
      { value: "7", label: "years digital marketing" },
      { value: "2024", label: "Purdue PG, Data Science" }
    ],
    orbitChips: ["WORDPRESS", "PYTHON / DATA", "SEO / ANALYTICS", "TEAM LEADERSHIP", "CORE WEB VITALS", "POWER BI"],
    knowledgeIntro: "Coursework and projects from the Simplilearn institution, published on GitHub.",
    knowledgeGithubLabel: "github.com/The-Aditya-Kadam",
    themeId: "orbit"
  };
  out.ui = { ...uiDefaults, ...(d.ui || {}) };
  out.ui.nav = { ...uiDefaults.nav, ...(d.ui?.nav || {}) };
  out.ui.heroMetrics = Array.isArray(d.ui?.heroMetrics) ? d.ui.heroMetrics.map(x => ({value: x?.value || "", label: x?.label || ""})) : uiDefaults.heroMetrics;
  out.ui.orbitChips = Array.isArray(d.ui?.orbitChips) ? d.ui.orbitChips.filter(Boolean) : uiDefaults.orbitChips;
  out.ui.knowledgeIntro = d.ui?.knowledgeIntro || uiDefaults.knowledgeIntro;
  out.ui.knowledgeGithubLabel = d.ui?.knowledgeGithubLabel || uiDefaults.knowledgeGithubLabel;
  out.ui.themeId = d.ui?.themeId || uiDefaults.themeId;

  out.name = d.name || "";
  out.role = d.role || "";
  out.location = d.location || "";
  out.phone = d.phone || "";
  out.email = d.email || "";
  out.linkedin = d.linkedin || "";
  out.github = d.github || "";
  out.portfolio = d.portfolio || "";
  out.targetLocations = d.targetLocations || "";
  out.summary = d.summary || d.intro || "";

  out.competencies = Array.isArray(d.competencies) ? d.competencies.map(x => ({
    title: x.title || x.category || "",
    text: x.text || x.skills || ""
  })) : [];

  out.experience = Array.isArray(d.experience) ? d.experience.map(x => ({
    role: x.role || x.job || "",
    company: x.company || "",
    dates: x.dates || x.period || "",
    bullets: Array.isArray(x.bullets) ? x.bullets : [],
    achievement: x.achievement || "",
    proof: x.proof || "",
    orbitTags: x.orbitTags || ""
  })) : [];

  out.education = Array.isArray(d.education) ? d.education.map(x => ({
    qualification: x.qualification || x.degree || "",
    institution: x.institution || "",
    dates: x.dates || x.year || "",
    details: x.details || ""
  })) : [];

  out.certifications = Array.isArray(d.certifications) ? d.certifications.map(x => ({
    title: x.title || x.name || "",
    issuer: x.issuer || "",
    date: x.date || x.year || "",
    details: x.details || ""
  })) : [];

  out.awards = Array.isArray(d.awards) ? d.awards.map(x => ({
    title: x.title || "",
    issuer: x.issuer || "",
    date: x.date || ""
  })) : [];

  out.customSections = Array.isArray(d.customSections) ? d.customSections : [];
  out.cards = Array.isArray(d.cards) ? d.cards : [];
  out.repositories = Array.isArray(d.repositories) ? d.repositories.map(x => ({
    label: x.label || "",
    source: x.source || "",
    path: x.path || "",
    title: x.title || "",
    description: x.description || "",
    tags: Array.isArray(x.tags) ? x.tags.filter(Boolean) : [],
    url: x.url || ""
  })) : [];

  return out;
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
      const rawData = body && body.data;

      if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
        send(res, 400, { error: "A CV data object is required." });
        return;
      }

      const data = normalizeData(rawData);
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
        const data = normalizeData(previous.rows[0].data);

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
