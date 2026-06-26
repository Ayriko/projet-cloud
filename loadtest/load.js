// Test de charge k6 — démontre le scaling horizontal de Cloud Run.
// Usage : k6 run -e TARGET=https://auth-xxxx-ew.a.run.app loadtest/load.js
// Cible /healthz/live (public, sans DB) pour générer du trafic pur.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.TARGET || "http://localhost:8080";

export const options = {
  stages: [
    { duration: "30s", target: 50 }, // montée en charge
    { duration: "60s", target: 50 }, // palier (déclenche le scale-out)
    { duration: "15s", target: 0 }, // descente
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const res = http.get(`${BASE}/healthz/live`);
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(0.3);
}
