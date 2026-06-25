import pg from "pg";

const { Pool } = pg;
const isLocal = (process.env.DATABASE_URL || "").includes("localhost");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  // Neon impose SSL ; en local (minikube/localhost) on le désactive.
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
