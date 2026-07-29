# Deploy FreshGuard to Google Cloud Run
#
# Prerequisites:
#   1. Google Cloud SDK (gcloud) installed and logged in
#   2. A GCP project with billing enabled
#   3. A Gemini API key (https://aistudio.google.com/apikey)
#
# Note: use $BUILD_ID (always set). $SHORT_SHA is empty for local source uploads.
#
# Quick path (recommended):
#   .\scripts\deploy-gcp.ps1 -ProjectId YOUR_PROJECT_ID -GeminiApiKey YOUR_KEY
#
# Or follow the manual steps below.

## 1. One-time GCP setup

```bash
# Login & pick project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com

# Create Artifact Registry repo (once)
gcloud artifacts repositories create freshguard \
  --repository-format=docker \
  --location=us-central1 \
  --description="FreshGuard container images"

# Store Gemini key in Secret Manager (once)
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY --data-file=-

# Allow Cloud Run runtime SA to read the secret
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 2. Deploy (build + push + Cloud Run)

From the project root:

```bash
# Build & deploy with Cloud Build (uses cloudbuild.yaml)
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_REGION=us-central1,_SERVICE=freshguard
```

Or build locally and deploy:

```bash
# Local Docker build
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/freshguard/freshguard:latest .

gcloud auth configure-docker us-central1-docker.pkg.dev

docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/freshguard/freshguard:latest

gcloud run deploy freshguard \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/freshguard/freshguard:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --set-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest
```

## 3. Get your URL

```bash
gcloud run services describe freshguard --region=us-central1 --format="value(status.url)"
```

Open that URL in a browser. Health check: `https://YOUR_URL/healthz`

## 4. Update the Gemini secret later

```bash
echo -n "NEW_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
gcloud run services update freshguard --region=us-central1
```

## Cost notes

- Cloud Run scales to **zero** when idle (`min-instances=0`) — you mostly pay for request time.
- Gemini API usage is billed separately via Google AI / Vertex depending on your key.
- Start in `us-central1`; change `_REGION` if you prefer another region.

## Troubleshooting

| Issue | Fix |
|--------|-----|
| Build fails on `npm ci` | Ensure `package-lock.json` is committed |
| Container fails to start | Check logs: `gcloud run services logs read freshguard --region=us-central1` |
| AI QC returns errors | Confirm `GEMINI_API_KEY` secret is set and accessible |
| 403 on secret | Re-run the Secret Manager IAM binding for the compute SA |
