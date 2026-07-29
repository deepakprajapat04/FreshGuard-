<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bf1b8cbf-bf50-4e9d-95b1-2d440ef0f6c6

## Run Locally

**Prerequisites:** Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`
3. Run the app:
   `npm run dev`

## Deploy to Google Cloud (Cloud Run)

See **[DEPLOY.md](./DEPLOY.md)** for full steps.

Quick deploy (PowerShell, with `gcloud` installed):

```powershell
.\scripts\deploy-gcp.ps1 -ProjectId "YOUR_GCP_PROJECT_ID" -GeminiApiKey "YOUR_GEMINI_KEY"
```

This builds a container, pushes it to Artifact Registry, and deploys to **Cloud Run** with your Gemini key stored in Secret Manager.
