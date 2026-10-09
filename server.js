const http = require("http");
const { Pool } = require("pg");
const CVAttachments = require("./cv-attachments");

const PORT = process.env.PORT || 10000;
const DATABASE_URL = process.env.DATABASE_URL;

if (require.main === module && !DATABASE_URL) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}

const pool = DATABASE_URL ? new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}) : null;

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

function normalizeData(input) {
  const d = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const out = { ...d };
  out.attachments=CVAttachments.normalize(d.attachments);

  out.site = {
    title: d.site?.title ?? d.siteTitle ?? "Aditya Kadam | Assistant Technical Project Manager",
    description: d.site?.description ?? d.metaDescription ?? ""
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
  out.ui.heroMetrics = Array.isArray(d.ui?.heroMetrics) ? d.ui.heroMetrics.map(x => ({value: x?.value ?? "", label: x?.label ?? ""})) : uiDefaults.heroMetrics;
  out.ui.orbitChips = Array.isArray(d.ui?.orbitChips) ? d.ui.orbitChips.map(x => String(x ?? "")) : uiDefaults.orbitChips;
  out.ui.knowledgeIntro = d.ui?.knowledgeIntro ?? uiDefaults.knowledgeIntro;
  out.ui.knowledgeGithubLabel = d.ui?.knowledgeGithubLabel ?? uiDefaults.knowledgeGithubLabel;
  out.ui.themeId = d.ui?.themeId ?? uiDefaults.themeId;

  out.name = d.name || "";
  out.role = d.role || "";
  out.location = d.location || "";
  out.phone = d.phone || "";
  out.email = d.email || "";
  out.linkedin = d.linkedin || "";
  out.github = d.github || "";
  out.portfolio = d.portfolio || "";
  out.targetLocations = d.targetLocations || "";
  out.summary = d.summary ?? d.intro ?? "";

  out.competencies = Array.isArray(d.competencies) ? d.competencies.map(x => ({
    ...x,
    title: x.title ?? x.category ?? "",
    text: x.text ?? x.skills ?? ""
  })) : [];

  out.experience = Array.isArray(d.experience) ? d.experience.map(x => ({
    ...x,
    role: x.role ?? x.job ?? "",
    company: x.company || "",
    dates: x.dates ?? x.period ?? "",
    bullets: Array.isArray(x.bullets) ? x.bullets : [],
    achievement: x.achievement || "",
    proof: x.proof ?? "",
    orbitTags: x.orbitTags || ""
  })) : [];

  out.education = Array.isArray(d.education) ? d.education.map(x => ({
    ...x,
    qualification: x.qualification ?? x.degree ?? "",
    institution: x.institution || "",
    dates: x.dates ?? x.year ?? "",
    details: x.details || ""
  })) : [];

  out.certifications = Array.isArray(d.certifications) ? d.certifications.map(x => ({
    ...x,
    title: x.title ?? x.name ?? "",
    issuer: x.issuer || "",
    date: x.date ?? x.year ?? "",
    details: x.details || ""
  })) : [];

  out.awards = Array.isArray(d.awards) ? d.awards.map(x => ({
    ...x,
    title: x.title || "",
    issuer: x.issuer || "",
    date: x.date || ""
  })) : [];

  out.customSections = Array.isArray(d.customSections) ? d.customSections : [];
  out.cards = Array.isArray(d.cards) ? d.cards : [];
  const repositoryDefaults = [
    {label:"REPO 01",source:"Simplilearn",path:"The-Aditya-Kadam / Natural-Language-Processing",title:"Natural Language Processing",description:"NLP coursework and projects.",tags:["NLP","Text analytics"],url:"https://github.com/The-Aditya-Kadam/Natural-Language-Processing"},
    {label:"REPO 02",source:"Simplilearn",path:"The-Aditya-Kadam / Data-Science-with-R",title:"Data Science with R",description:"Analysis and modeling in R.",tags:["R","Modeling"],url:"https://github.com/The-Aditya-Kadam/Data-Science-with-R"},
    {label:"REPO 03",source:"Simplilearn",path:"The-Aditya-Kadam / Data-Science-Capstone",title:"Data Science Capstone",description:"End-to-end data analysis and visualization.",tags:["Capstone","Visualization"],url:"https://github.com/The-Aditya-Kadam/Data-Science-Capstone"},
    {label:"REPO 04",source:"Simplilearn",path:"The-Aditya-Kadam / Machine-Learning",title:"Machine Learning",description:"Machine-learning coursework and models.",tags:["ML","Models"],url:"https://github.com/The-Aditya-Kadam/Machine-Learning"},
    {label:"REPO 05",source:"Simplilearn",path:"The-Aditya-Kadam / Tableau-Training",title:"Tableau Training",description:"Dashboards and visual analytics in Tableau.",tags:["Tableau","Dashboards"],url:"https://github.com/The-Aditya-Kadam/Tableau-Training"},
    {label:"REPO 06",source:"Simplilearn",path:"The-Aditya-Kadam / Applied-Data-Science-with-Python",title:"Applied Data Science with Python",description:"Python for data analysis and machine learning.",tags:["Python","ML"],url:"https://github.com/The-Aditya-Kadam/Applied-Data-Science-with-Python"}
  ];
  out.repositories = Array.isArray(d.repositories) ? d.repositories.map(x => ({
    ...x,
    label: x.label || "",
    source: x.source || "",
    path: x.path || "",
    title: x.title || "",
    description: x.description || "",
    tags: Array.isArray(x.tags) ? x.tags.filter(Boolean) : [],
    url: x.url || ""
  })) : repositoryDefaults;

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

function createServer(pool) {
return http.createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;

  if (req.method === "OPTIONS") {
    send(res, 204, {});
    return;
  }

  if (pathname === "/health") {
    send(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && pathname === "/api/cv") {
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

  if (req.method === "POST" && pathname === "/api/cv") {
    try {
      const body = await readBody(req);
      const rawData = body && body.data;

      if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
        send(res, 400, { error: "A CV data object is required." });
        return;
      }

      for (const key of ["education","experience","certifications","awards","competencies","repositories","customSections"]) {
        if(rawData[key]!=null && (!Array.isArray(rawData[key]) || rawData[key].some(x=>!x||typeof x!=="object"||Array.isArray(x)))) {
          send(res,400,{error:"Invalid "+key+" list."});return;
        }
      }
      let data;
      try{data=normalizeData(rawData);}catch(error){send(res,400,{error:error.message});return;}
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const current = await client.query(
          "SELECT version FROM cv_documents WHERE id = 1 FOR UPDATE"
        );

        if(body.expectedVersion!=null && Number(body.expectedVersion)!==Number(current.rows[0]?.version||0)) {
          await client.query("ROLLBACK");send(res,409,{error:"The CV was updated elsewhere. Load Published before saving again."});return;
        }

        const nextVersion = current.rowCount
          ? Number(current.rows[0].version || 1) + 1
          : 1;

        await client.query(
          `INSERT INTO cv_documents (id, data, version)
           VALUES (1, $1::jsonb, $2)
           ON CONFLICT (id) DO UPDATE
           SET data = EXCLUDED.data, version = EXCLUDED.version, updated_at = NOW()`,
          [JSON.stringify(data), nextVersion]
        );

        await client.query(
          "INSERT INTO cv_versions (document_id, version, data) VALUES (1, $1, $2::jsonb)",
          [nextVersion, JSON.stringify(data)]
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
        send(res, 200, { ok: true, version: nextVersion, data });
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

  if (req.method === "POST" && pathname === "/api/cv/rollback") {
    try {
      const body=await readBody(req);
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

        if(body.expectedVersion!=null && Number(body.expectedVersion)!==Number(current.rows[0].version)) {
          await client.query("ROLLBACK");send(res,409,{error:"The CV was updated elsewhere. Load Published before rollback."});return;
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
}

async function start() {
  await ensureDatabase();
  createServer(pool).listen(PORT, "0.0.0.0", () => {
    console.log("CV API listening on port " + PORT);
    if (process.env.CV_MIGRATION_MODE === "copy" && process.env.CV_MIGRATION_TARGET_URL) {
      require("./cv-migration").runConfiguredCopy(pool, process.env.CV_MIGRATION_TARGET_URL)
        .then(result => console.log("CV_MIGRATION_VERIFIED " + JSON.stringify(result)))
        .catch(error => console.error("CV_MIGRATION_FAILED " + (error.migrationCode || error.code || "COPY_ERROR")));
    }
  });
}

if(require.main===module)start().catch((error) => {
  console.error("Startup failed:", error);
  process.exit(1);
});

module.exports={createServer,normalizeData};
