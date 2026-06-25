import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { pool, initDb } from "./db.js";
import { requireAuth } from "./auth.js";
import {
  listFiles,
  getFileText,
  getFileBytes,
  putFileText,
  putFileBytes,
  BUCKET,
} from "./s3.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
const upload = multer({ storage: multer.memoryStorage() });

// --- Health (public) ---
app.get("/healthz/live", (_req, res) => res.json({ status: "alive" }));
app.get("/healthz/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ready" });
  } catch (e) {
    res.status(503).json({ status: "not ready", error: e.message });
  }
});

// --- À partir d'ici, tout exige un token valide (vérifié via le Auth Service) ---
app.use(requireAuth);

// --- Pages / wiki (Neon) ---
app.get("/pages", async (req, res) => {
  const { search } = req.query;
  try {
    const { rows } = search
      ? await pool.query(
          "SELECT id, title, updated_at FROM pages WHERE user_id=$1 AND title ILIKE $2 ORDER BY updated_at DESC",
          [req.user.id, `%${search}%`]
        )
      : await pool.query(
          "SELECT id, title, updated_at FROM pages WHERE user_id=$1 ORDER BY updated_at DESC",
          [req.user.id]
        );
    res.json({ pages: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/pages", async (req, res) => {
  const { title, content } = req.body || {};
  if (!title) return res.status(400).json({ error: "title requis" });
  try {
    const { rows } = await pool.query(
      "INSERT INTO pages (user_id, title, content) VALUES ($1,$2,$3) RETURNING id, title, content, updated_at",
      [req.user.id, title, JSON.stringify(content || {})]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/pages/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, content, created_at, updated_at FROM pages WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "page introuvable" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/pages/:id", async (req, res) => {
  const { title, content } = req.body || {};
  try {
    const { rows } = await pool.query(
      "UPDATE pages SET title=COALESCE($1,title), content=COALESCE($2,content), updated_at=NOW() WHERE id=$3 AND user_id=$4 RETURNING id, title, content, updated_at",
      [title ?? null, content != null ? JSON.stringify(content) : null, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "page introuvable" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/pages/:id", async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM pages WHERE id=$1 AND user_id=$2", [
      req.params.id,
      req.user.id,
    ]);
    if (!rowCount) return res.status(404).json({ error: "page introuvable" });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Fichiers .md (S3) ---
app.get("/files", async (_req, res) => {
  try {
    res.json({ files: await listFiles() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/file/:name", async (req, res) => {
  try {
    res.json({ content: await getFileText(req.params.name) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/file/:name", async (req, res) => {
  const { content } = req.body || {};
  if (content == null) return res.status(400).json({ error: "content requis" });
  if (!req.params.name.endsWith(".md")) return res.status(400).json({ error: "seuls les .md sont acceptés" });
  try {
    await putFileText(req.params.name, content);
    res.json({ message: "sauvegardé", status: "ok" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/download/:name", async (req, res) => {
  try {
    const bytes = await getFileBytes(req.params.name);
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.name}"`);
    res.setHeader("Content-Type", "text/markdown");
    res.send(bytes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "aucun fichier" });
  if (!req.file.originalname.endsWith(".md")) return res.status(400).json({ error: "seuls les .md sont acceptés" });
  try {
    await putFileBytes(req.file.originalname, req.file.buffer);
    await pool.query("INSERT INTO documents (user_id, name, size) VALUES ($1,$2,$3)", [
      req.user.id,
      req.file.originalname,
      req.file.size,
    ]);
    res.json({ message: "uploadé", status: "ok" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/documents", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, size, uploaded_at FROM documents WHERE user_id=$1 ORDER BY uploaded_at DESC",
      [req.user.id]
    );
    res.json({ documents: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default app;

// Démarrage (sauf en test)
if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 8080;
  initDb()
    .then(() => app.listen(PORT, () => console.log(`core service on :${PORT} (bucket ${BUCKET})`)))
    .catch((e) => {
      console.error("initDb failed:", e.message);
      app.listen(PORT, () => console.log(`core service on :${PORT} (db init KO)`));
    });
}
