import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool, initDb } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES = "12h";

// --- Health ---
app.get("/healthz/live", (_req, res) => res.json({ status: "alive" }));
app.get("/healthz/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ready" });
  } catch (e) {
    res.status(503).json({ status: "not ready", error: e.message });
  }
});

// --- Register ---
app.post("/register", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email et password requis" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, hash]
    );
    const token = jwt.sign({ sub: rows[0].id, email: rows[0].email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.status(201).json({ token, user: rows[0] });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "email déjà utilisé" });
    res.status(500).json({ error: e.message });
  }
});

// --- Login ---
app.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email et password requis" });
  try {
    const { rows } = await pool.query("SELECT id, email, password_hash FROM users WHERE email = $1", [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "identifiants invalides" });
    }
    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Verify (appelé par le Core = communication inter-services) ---
app.get("/verify", (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ valid: false, error: "token manquant" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: { id: payload.sub, email: payload.email } });
  } catch {
    res.status(401).json({ valid: false, error: "token invalide" });
  }
});

export default app;

// Démarrage (sauf en test)
if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 8080;
  initDb()
    .then(() => app.listen(PORT, () => console.log(`auth service on :${PORT}`)))
    .catch((e) => {
      console.error("initDb failed:", e.message);
      app.listen(PORT, () => console.log(`auth service on :${PORT} (db init KO)`));
    });
}
