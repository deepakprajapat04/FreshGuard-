#!/usr/bin/env bash
# One-time GCP setup for FreshGuard CI/CD (Cloud Build → Cloud Run)
#
# Prerequisites:
#   - gcloud CLI installed and logged in: gcloud auth login
#   - Billing enabled on your GCP project
#
# Usage:
#   chmod +x deploy/gcp-setup.sh
#   ./deploy/gcp-setup.sh YOUR_GCP_PROJECT_ID

set -euo pipefail

PROJECT_ID="${1:-}"
REGION="${REGION:-us-central1}"
AR_REPO="${AR_REPO:-freshguard}"
BACKEND_SERVICE="${BACKEND_SERVICE:-freshguard-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-freshguard-frontend}"
# Optional — set if you create Cloud SQL: PROJECT:REGION:INSTANCE
CLOUDSQL_INSTANCE="${CLOUDSQL_INSTANCE:-}"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: $0 YOUR_GCP_PROJECT_ID"
  exit 1
fi

echo "==> Setting project to $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

echo "==> Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  sql-component.googleapis.com

echo "==> Creating Artifact Registry repository ($AR_REPO)..."
gcloud artifacts repositories describe "$AR_REPO" \
  --location="$REGION" 2>/dev/null || \
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="FreshGuard container images"

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "==> Granting Cloud Build service account permissions..."
for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/secretmanager.secretAccessor \
  roles/iam.serviceAccountUser \
  roles/cloudsql.client; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${CB_SA}" \
    --role="$ROLE" \
    --quiet >/dev/null
done

echo "==> Granting default compute SA Secret Manager access (Cloud Run runtime)..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null

echo ""
echo "==> Create secrets in Secret Manager (run for each, paste value when prompted):"
echo ""
cat <<'SECRETS'
  echo -n 'YOUR_VALUE' | gcloud secrets create DATABASE_URL --data-file=-
  echo -n 'YOUR_VALUE' | gcloud secrets create SMTP_USER --data-file=-
  echo -n 'YOUR_VALUE' | gcloud secrets create SMTP_PASS --data-file=-
  echo -n 'YOUR_VALUE' | gcloud secrets create OPENWEATHER_API_KEY --data-file=-
  echo -n 'YOUR_VALUE' | gcloud secrets create NEWS_API_KEY --data-file=-
  echo -n 'YOUR_VALUE' | gcloud secrets create RAZORPAY_KEY_ID --data-file=-
  echo -n 'YOUR_VALUE' | gcloud secrets create RAZORPAY_KEY_SECRET --data-file=-
  echo -n 'YOUR_VALUE' | gcloud secrets create GEMINI_API_KEY --data-file=-
  echo -n 'YOUR_VALUE' | gcloud secrets create GOOGLE_MAPS_PLATFORM_KEY --data-file=-
SECRETS
echo ""
echo "  If a secret already exists, add a new version:"
echo "  echo -n 'VALUE' | gcloud secrets versions add SECRET_NAME --data-file=-"
echo ""

echo "==> Cloud SQL (PostgreSQL) — create manually or run:"
echo "  gcloud sql instances create freshguard-db \\"
echo "    --database-version=POSTGRES_15 \\"
echo "    --tier=db-f1-micro \\"
echo "    --region=$REGION"
echo ""
echo "  Then set DATABASE_URL secret to Cloud SQL format:"
echo "  postgresql://USER:PASS@/DB?host=/cloudsql/$PROJECT_ID:$REGION:freshguard-db"
echo "  And set CLOUDSQL_INSTANCE=$PROJECT_ID:$REGION:freshguard-db when triggering builds."
echo ""

SUBS="_REGION=$REGION,_AR_REPO=$AR_REPO,_BACKEND_SERVICE=$BACKEND_SERVICE,_FRONTEND_SERVICE=$FRONTEND_SERVICE"
if [ -n "$CLOUDSQL_INSTANCE" ]; then
  SUBS="${SUBS},_CLOUDSQL_INSTANCE=$CLOUDSQL_INSTANCE"
fi

echo "==> Creating Cloud Build trigger (push to main)..."
gcloud builds triggers create github \
  --name="freshguard-deploy-main" \
  --repo-name="FreshGuard-" \
  --repo-owner="deepakprajapat04" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --substitutions="$SUBS" \
  2>/dev/null || echo "  (Trigger may already exist, or connect GitHub first — see deploy/README.md)"

echo ""
echo "==> Setup complete. First deploy:"
echo "  gcloud builds submit --config=cloudbuild.yaml --substitutions=\"$SUBS\""
echo ""
echo "  After deploy, get URLs:"
echo "  gcloud run services describe $FRONTEND_SERVICE --region=$REGION --format='value(status.url)'"
echo "  gcloud run services describe $BACKEND_SERVICE --region=$REGION --format='value(status.url)'"
