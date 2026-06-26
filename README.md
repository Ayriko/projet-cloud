# projet-cloud

[![CI/CD](https://github.com/Ayriko/projet-cloud/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/Ayriko/projet-cloud/actions/workflows/ci-cd.yml)

Application web cloud-native en **microservices**, hébergée sur **Google Cloud Run**, provisionnée en **Terraform** et déployée en continu via **GitHub Actions**. Wiki de notes (éditeur Tiptap, style Notion) + gestion de fichiers `.md`, derrière une authentification.

---

## Architecture

```
                    Navigateur
                        │
                        ▼
      ┌──────────────────────────────────┐
      │  frontend-app (Nginx · Cloud Run) │   SPA React + Vite (Tiptap)
      └──────────────────────────────────┘
            │ login/register            │ notes, wiki, fichiers .md
            ▼                           ▼
   ┌───────────────────┐      ┌────────────────────┐
   │  auth (Cloud Run) │◀─────│  core (Cloud Run)  │   core appelle auth /verify
   │  Node/Express     │ /verify  Node/Express      │   (communication inter-services)
   └───────────────────┘      └────────────────────┘
            │                      │            │
            ▼                      ▼            ▼
        PostgreSQL (Neon)     PostgreSQL    AWS S3 (.md)
        table users          tables pages/documents
```

**3 conteneurs applicatifs** (+ persistance) :
| Service | Rôle | Stack | Données |
|---------|------|-------|---------|
| **frontend-app** | SPA (login = page d'entrée, wiki Tiptap, fichiers `.md`) | React + Vite, servie par Nginx | — |
| **auth** | Authentification : `register` / `login` (JWT), `verify` | Node + Express | `users` (Neon) |
| **core** | Notes/wiki + fichiers `.md` ; valide chaque requête via `auth /verify` | Node + Express | `pages`, `documents` (Neon) + S3 |

**Communication inter-services** : le `core` ne connaît pas le secret JWT. À chaque requête protégée, son middleware appelle **`auth /verify`** (HTTP) pour valider le token et récupérer l'utilisateur → couplage faible, vraie communication entre microservices.

---

## Stack & cloud
- **Compute** : Google Cloud Run (1 service par conteneur)
- **IaC** : Terraform (state distant sur GCS)
- **Registre** : Google Artifact Registry (privé)
- **Secrets** : Google Secret Manager + auth keyless **Workload Identity Federation** (OIDC, aucune clé JSON)
- **DB** : Neon (PostgreSQL managé)
- **Stockage fichiers** : AWS S3
- **CI/CD** : GitHub Actions
- **Observabilité** : Cloud Monitoring (dashboard, uptime checks, alertes email) + Cloud Logging / Cloud Trace

---

## Endpoints

**auth**
| Méthode | Route | Description |
|---|---|---|
| POST | `/register` | Crée un compte, renvoie un JWT |
| POST | `/login` | Authentifie, renvoie un JWT |
| GET | `/verify` | Valide un Bearer token (appelé par `core`) |
| GET | `/healthz/live` · `/healthz/ready` | Liveness / readiness (DB) |

**core** (toutes les routes métier exigent un Bearer token, validé via `auth /verify`)
| Méthode | Route | Description |
|---|---|---|
| GET/POST | `/pages` | Liste / crée une page wiki |
| GET/PUT/DELETE | `/pages/:id` | Lit / met à jour / supprime une page |
| GET | `/files` · `/file/:name` · `/download/:name` | Fichiers `.md` (S3) |
| PUT | `/file/:name` · POST `/upload` | Sauvegarde / upload `.md` |
| GET | `/documents` | Uploads enregistrés en base |
| GET | `/healthz/live` · `/healthz/ready` | Liveness / readiness (DB) |

---

## Infrastructure (Terraform)

Tout le cloud est dans [`terraform/`](terraform/) :
- 3 services Cloud Run (`auth`, `core`, `frontend-app`) avec **probes** et **scaling** (`min=0`, `max=4`)
- accès public (`allUsers` → `run.invoker`) sur les 3
- **Secret Manager** : `DATABASE_URL`, `JWT_SECRET`, clés AWS → injectés dans Cloud Run via `value_source`
- câblage des URLs entre services (`AUTH_URL`, `CORE_URL`) directement par Terraform
- **monitoring** : 1 uptime check + 1 alert policy par service, 1 dashboard, 1 canal de notification email

State distant : bucket GCS `cloud-ynov-494711-tfstate` (prefix `projet-cloud`).

---

## CI/CD

Workflow : [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml).

**Branches** : on développe sur **`dev`**, on déploie via **`prod`**.

| Événement | Tests + lint + build | Build & push images | Deploy (Terraform) |
|---|:--:|:--:|:--:|
| push/PR `dev` | ✅ | ❌ | ❌ |
| push `prod` | ✅ | ✅ | ✅ |

À chaque push sur `prod` : `test-services` (auth/core) + `build-frontend` → `build-push` (3 images taguées **SHA** + `latest` → Artifact Registry) → `deploy` (`terraform apply` avec la nouvelle image).

- **Runners isolés** : `ubuntu-latest` (VM éphémère par job)
- **Least privilege** : `contents: read` par défaut, `id-token: write` seulement pour build/deploy
- **Auth keyless** : Workload Identity Federation (aucune clé stockée)

---

## Scaling

Cloud Run fait du **scaling horizontal automatique** : il **ajoute des instances** (jusqu'à `max_instance_count = 4`) quand la concurrence des requêtes monte, et redescend jusqu'à `min_instance_count = 0` (**scale-to-zero**) quand il n'y a plus de trafic. Ce n'est pas du scaling vertical (on n'agrandit pas une instance, on en ajoute). Démo : voir [Tests de charge](#tests-de-charge--démos).

---

## Observabilité

Chaque microservice est monitoré :
- **Métriques** Cloud Run (trafic, latence, instances) + **dashboard** dédié
- **Uptime check** + **alert policy** par service (email si un service tombe)
- **Logs** centralisés (Cloud Logging), traces (Cloud Trace)

---

## Développement local

Pré-requis : Node 20+, un fichier `.env` par service (voir les `.env.example`).

```bash
cd services/auth && npm install && npm start
```
```bash
cd services/core && npm install && npm start
```
```bash
cd frontend && npm install && npm run dev
```
auth → `:8080`, core → `:8081` (`AUTH_URL=http://localhost:8080`), frontend → `:5173`.
Tests + lint d'un service : `npm test` puis `npm run lint`.

---

## Déploiement

Aucune commande manuelle : **merge sur `prod`** → la CI build et déploie. URLs de prod : `terraform output`.

---

## Tests de charge & démos

Script k6 : [`loadtest/load.js`](loadtest/load.js).

**Démo scaling horizontal :**
```bash
k6 run -e TARGET=https://auth-xxxx-ew.a.run.app loadtest/load.js
```
Pendant la charge, observer la montée d'instances : Cloud Run → service `auth` → onglet **Metrics → Container instance count**.

**Crash test (zéro-downtime) :** déployer une mauvaise `DATABASE_URL` sur `core` sans toucher au secret →
```bash
gcloud run services update core --region europe-west1 \
  --update-env-vars "DATABASE_URL=postgresql://x:x@127.0.0.1:1/nope"
# → le startup probe (/healthz/ready) échoue, la révision est rejetée,
#   le trafic reste sur la révision saine : aucune coupure.
```
Restaurer :
```bash
gcloud run services update core --region europe-west1 \
  --update-secrets DATABASE_URL=projet-cloud-database_url:latest
```

---

## Couverture du sujet (projet fin de module)

| Exigence | Réalisé |
|---|---|
| 1. Architecture microservices (≥ 3 conteneurs + persistance) | frontend-app + auth + core + Neon/S3 |
| 2. Tout en Infrastructure as Code (Terraform) | services, secrets, monitoring, IAM |
| 3. Orchestration : déploiement + env/secrets + scaling | Cloud Run + Secret Manager + scaling horizontal |
| 4. CI/CD complet (push → build → Artifact Registry → prod) | GitHub Actions + WIF |
| 5. Monitoring/observabilité de chaque microservice | dashboard + uptime + alertes email par service |
