# projet-cloud

Application web cloud-native en microservices (projet fin de module).

## Architecture
- **frontend/** — SPA React + Vite (Tiptap, wiki style Notion), servie par Nginx
- **services/auth/** — microservice Auth/User (Node/Express, JWT, table `users` Neon)
- **services/core/** — microservice Core (Node/Express, notes/wiki + fichiers `.md` S3)
- **terraform/** — IaC : 3 services Cloud Run, secrets, scaling, monitoring
- **.github/workflows/** — CI/CD (build → Artifact Registry → déploiement)
- **loadtest/** — tests de charge k6
- **docs/** — documentation

> Stack : Google Cloud Run · Terraform · Neon (PostgreSQL) · AWS S3 · GitHub Actions
