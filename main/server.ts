import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  // Hosting platforms (Render, Railway, etc.) inject their own PORT
  const PORT = Number(process.env.PORT) || 3000;
  const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

  app.use(express.json({ limit: '50mb' }));

  // Database-backed routes are served by the FreshGuard backend (Prisma + PostgreSQL).
  // Forward them so the SPA can keep calling same-origin /api/* paths.
  const proxyToBackend = async (req: express.Request, res: express.Response) => {
    try {
      const response = await fetch(`${BACKEND_URL}${req.originalUrl}`, {
        method: req.method,
        headers: { "Content-Type": "application/json" },
        body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (e: any) {
      res.status(502).json({
        success: false,
        error: "FreshGuard backend unreachable. Start it with `npm start` inside the backend folder.",
        details: e?.message,
      });
    }
  };

  app.use(
    [
      "/api/procurement",
      "/api/logistics",
      "/api/qc",
      "/api/health",
      "/api/evaluate-transit", // live OpenWeatherMap (mock fallback)
      "/api/news",             // live NewsAPI (mock fallback)
      "/api/payments",         // Razorpay (mock fallback)
      "/api/notify",           // Nodemailer email (mock fallback)
      "/api/requirements",     // permanent storage APIs
      "/api/bids",
      "/api/contracts",
      "/api/orders",
      "/api/negotiations",
      "/api/claims",
      "/api/inspections",
      "/api/auth",             // authentication (signup/login/session)
    ],
    proxyToBackend
  );

  // AI produce vision analysis — uses Gemini when GEMINI_API_KEY is set
  app.post("/api/analyze-produce", async (req, res) => {
    try {
      const { image, expectedProduct, poId } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image provided" });
      }

      const { analyzeProduceImage } = await import("./server/analyze-produce");
      const result = await analyzeProduceImage(image, { expectedProduct, poId });
      console.log(`[analyze-produce] ${result.item_name} — ${result.passed_boxes}/10 passed (freshness ${result.freshness_score}/10)`);
      res.json(result);
    } catch (e: any) {
      console.error("[analyze-produce] error:", e?.message);
      res.status(500).json({ error: "Image analysis failed", details: e?.message });
    }
  });

  // NOTE: /api/evaluate-transit moved to the backend (integrations.js) —
  // it now calls OpenWeatherMap live when OPENWEATHER_API_KEY is set.

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
