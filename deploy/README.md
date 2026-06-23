# Deploy FreshGuard to Google Cloud Platform

FreshGuard runs as **two Cloud Run services** plus **Cloud SQL (PostgreSQL)**:

| Service | Folder | Role |
|---------|--------|------|
| `freshguard-backend` | `backend/` | API, Prisma, auth, SMTP |
| `freshguard-app` | `main/` | React SPA + Express proxy + Gemini QC |

CI/CD uses **Cloud Build** (`cloudbuild.yaml`) → **Artifact Registry** → **Cloud Run**.

---

## Prerequisites

1. [Google Cloud account](https://cloud.google.com/) with billing enabled
2. [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed
3. GitHub repo pushed (`deepakprajapat04/FreshGuard-`)

```bash
gcloud auth login
gcloud auth application-default login
```

---

## Step 1 — One-time GCP setup

```bash
chmod +x deploy/gcp-setup.sh
./deploy/gcp-setup.sh YOUR_GCP_PROJECT_ID
```

This enables APIs, creates Artifact Registry, and grants Cloud Build permissions.

---

## Step 2 — Cloud SQL (PostgreSQL)

```bash
export PROJECT_ID=YOUR_GCP_PROJECT_ID
export REGION=us-central1

gcloud sql instances create freshguard-db \
  --project=$PROJECT_ID \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --root-password='CHOOSE_A_STRONG_PASSWORD'

gcloud sql databases create freshguard --instance=freshguard-db
gcloud sql users create freshguard \
  --instance=freshguard-db \
  --password='CHOOSE_APP_PASSWORD'
```

**DATABASE_URL** for Cloud Run + Cloud SQL (Unix socket):

```
postgresql://freshguard:APP_PASSWORD@/freshguard?host=/cloudsql/PROJECT_ID:us-central1:freshguard-db
```

Store it as a secret:

```bash
echo -n 'postgresql://freshguard:...@/freshguard?host=/cloudsql/...' | \
  gcloud secrets create DATABASE_URL --data-file=-
```

---

## Step 3 — Secret Manager

Create all secrets (paste real values from your local `.env` files):

```bash
echo -n 'postgresql://...' | gcloud secrets create DATABASE_URL --data-file=-
echo -n 'your@gmail.com'     | gcloud secrets create SMTP_USER --data-file=-
echo -n 'app-password'       | gcloud secrets create SMTP_PASS --data-file=-
echo -n 'key'                | gcloud secrets create OPENWEATHER_API_KEY --data-file=-
echo -n 'key'                | gcloud secrets create NEWS_API_KEY --data-file=-
echo -n 'key'                | gcloud secrets create RAZORPAY_KEY_ID --data-file=-
echo -n 'secret'              | gcloud secrets create RAZORPAY_KEY_SECRET --data-file=-
echo -n 'key'                | gcloud secrets create GEMINI_API_KEY --data-file=-
echo -n 'key'                | gcloud secrets create GOOGLE_MAPS_PLATFORM_KEY --data-file=-
```

To update an existing secret:

```bash
echo -n 'NEW_VALUE' | gcloud secrets versions add SECRET_NAME --data-file=-
```

---

## Step 4 — Connect GitHub → Cloud Build trigger

1. Open [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. **Connect repository** → GitHub → authorize → select `deepakprajapat04/FreshGuard-`
3. Create trigger:
   - **Event:** Push to branch `main`
   - **Config:** Cloud Build configuration file → `cloudbuild.yaml`
   - **Substitutions** (optional):
     - `_CLOUDSQL_INSTANCE` = `YOUR_PROJECT:us-central1:freshguard-db`

Or run the setup script (after GitHub is connected):

```bash
CLOUDSQL_INSTANCE="YOUR_PROJECT:us-central1:freshguard-db" \
  ./deploy/gcp-setup.sh YOUR_GCP_PROJECT_ID
```

---

## Step 5 — Deploy

### Automatic (recommended)

Push to `main` on GitHub — the trigger runs `cloudbuild.yaml`.

### Manual

From repo root:

```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_CLOUDSQL_INSTANCE=YOUR_PROJECT:us-central1:freshguard-db
```

---

## Step 6 — Verify

```bash
# Frontend URL (your public app)
gcloud run services describe freshguard-frontend \
  --region=us-central1 --format='value(status.url)'

# Backend health
curl "$(gcloud run services describe freshguard-backend \
  --region=us-central1 --format='value(status.url)')/api/health"
```

---

## Architecture

```
GitHub (push main)
       │
       ▼
 Cloud Build (cloudbuild.yaml)
       │
       ├── build backend Docker → push → deploy freshguard-backend (Cloud Run)
       │                                      │
       │                                      ├── Cloud SQL (PostgreSQL)
       │                                      └── Secret Manager
       │
       └── build frontend Docker → push → deploy freshguard-frontend (Cloud Run)
                                              └── BACKEND_URL = backend service URL
```

---

## Customization

Edit substitutions at the top of `cloudbuild.yaml`:

| Variable | Default | Description |
|----------|---------|-------------|
| `_REGION` | `us-central1` | GCP region |
| `_AR_REPO` | `freshguard` | Artifact Registry repo name |
| `_BACKEND_SERVICE` | `freshguard-backend` | Cloud Run backend name |
| `_FRONTEND_SERVICE` | `freshguard-frontend` | Cloud Run frontend name |
| `_CLOUDSQL_INSTANCE` | *(empty)* | Cloud SQL connection name |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Permission denied` on deploy | Re-run `deploy/gcp-setup.sh` to grant IAM roles |
| Backend `database: DOWN` | Check `DATABASE_URL` secret and `_CLOUDSQL_INSTANCE` |
| Frontend 502 on `/api/*` | Confirm `BACKEND_URL` on frontend service points to backend URL |
| Maps not loading | Ensure `GOOGLE_MAPS_PLATFORM_KEY` secret exists (used at Docker build) |
| QC always fails | Set `GEMINI_API_KEY` secret on frontend Cloud Run service |

View build logs: [Cloud Build history](https://console.cloud.google.com/cloud-build/builds)
