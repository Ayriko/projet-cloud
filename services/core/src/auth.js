// Middleware d'authentification : valide le token en appelant le Auth Service.
// C'est ici qu'a lieu la communication inter-services (Core -> Auth /verify).
const AUTH_URL = process.env.AUTH_URL || "http://localhost:8080";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "token manquant" });
  }
  try {
    const r = await fetch(`${AUTH_URL}/verify`, { headers: { Authorization: header } });
    if (!r.ok) return res.status(401).json({ error: "token invalide" });
    const data = await r.json();
    req.user = data.user;
    next();
  } catch (e) {
    return res.status(502).json({ error: `auth service indisponible: ${e.message}` });
  }
}
