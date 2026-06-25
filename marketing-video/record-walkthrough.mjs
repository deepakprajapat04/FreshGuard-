#!/usr/bin/env node
/**
 * Records one video clip per scene; holds each clip to match voiceover duration.
 */
import { chromium } from 'playwright';
import { mkdir, readdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCENES } from './scenes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'output');
const CLIPS_DIR = path.join(OUT_DIR, 'video-clips');
const BASE = process.env.FRESHGUARD_URL || 'http://localhost:3000';

const DEMO_USER = {
  id: 'demo-marketing-user-001',
  fullName: 'Alex Chen',
  email: 'alex.chen@freshguard.demo',
  phone: null,
  role: 'BUYER',
  emailVerified: true,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function smoothScroll(page, deltaY, durationMs = 1200) {
  await page.evaluate(
    async ({ deltaY, durationMs }) => {
      const start = window.scrollY;
      const startTime = performance.now();
      return new Promise((resolve) => {
        const step = (now) => {
          const t = Math.min(1, (now - startTime) / durationMs);
          const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          window.scrollTo(0, start + deltaY * ease);
          if (t < 1) requestAnimationFrame(step);
          else resolve(undefined);
        };
        requestAnimationFrame(step);
      });
    },
    { deltaY, durationMs }
  );
}

async function kenBurnsZoom(page, scale = 1.06, durationMs = 4000) {
  await page.evaluate(
    async ({ scale, durationMs }) => {
      const root = document.documentElement;
      const start = performance.now();
      return new Promise((resolve) => {
        const step = (now) => {
          const t = Math.min(1, (now - start) / durationMs);
          const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const s = 1 + (scale - 1) * ease;
          root.style.transformOrigin = '50% 35%';
          root.style.transform = `scale(${s})`;
          if (t < 1) requestAnimationFrame(step);
          else resolve(undefined);
        };
        requestAnimationFrame(step);
      });
    },
    { scale, durationMs }
  );
}

async function resetZoom(page) {
  await page.evaluate(() => {
    document.documentElement.style.transform = '';
    document.documentElement.style.transformOrigin = '';
  });
}

async function setupAuth(page) {
  await page.route('**/api/auth/me/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, user: DEMO_USER }),
    })
  );
  await page.addInitScript((user) => {
    localStorage.setItem('freshguard-auth-user', JSON.stringify(user));
  }, DEMO_USER);
}

async function clickNav(page, partial) {
  const link = page.locator('aside a[href]').filter({ hasText: partial }).first();
  if (await link.count()) {
    await link.click();
    await sleep(2000);
    return;
  }
  const routes = {
    Overview: '/dashboard',
    Procurement: '/procurement',
    Logistics: '/logistics',
    'Quality Control': '/qc',
    Store: '/store',
    Claims: '/claims',
    Reports: '/reports',
  };
  for (const [key, route] of Object.entries(routes)) {
    if (partial.includes(key) || key.includes(partial)) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      await resetZoom(page);
      await sleep(2000);
      return;
    }
  }
}

async function setPersona(page, mode) {
  const btn = page.getByRole('button', { name: mode, exact: true });
  if (await btn.count()) {
    await btn.click();
    await sleep(1200);
  }
}

const helpers = {
  go: async (page, route, waitMs = 2000) => {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(600);
    await resetZoom(page);
    await sleep(waitMs);
  },
  sleep,
  resetZoom,
  kenBurnsZoom,
  smoothScroll,
  clickNav,
  setPersona,
};

/** Gentle idle motion so hold frames don't look frozen */
async function holdWithMotion(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const remaining = end - Date.now();
    const chunk = Math.min(2200, remaining);
    if (chunk <= 0) break;
    await kenBurnsZoom(page, 1.012, chunk);
    await sleep(300);
  }
}

async function main() {
  const timingPath = path.join(OUT_DIR, 'scene-timing.json');
  let timing;
  try {
    timing = JSON.parse(await readFile(timingPath, 'utf8'));
  } catch {
    console.error('Missing scene-timing.json — run: npm run voice');
    process.exit(1);
  }

  await mkdir(CLIPS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const recorded = [];

  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];
    const targetSec = timing.scenes[i]?.durationSec || 15;
    const targetMs = Math.ceil(targetSec * 1000) + 800; // pad for slower pacing

    console.log(`Recording ${scene.id} (target ${targetSec.toFixed(1)}s)…`);

    const clipDir = path.join(CLIPS_DIR, scene.id);
    await mkdir(clipDir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: clipDir, size: { width: 1920, height: 1080 } },
      colorScheme: 'light',
    });

    const page = await context.newPage();
    await setupAuth(page);

    const t0 = Date.now();
    await scene.run(page, helpers);
    const elapsed = Date.now() - t0;
    const remaining = targetMs - elapsed;

    if (remaining > 0) {
      await holdWithMotion(page, remaining);
    }

    await context.close();

    const files = await readdir(clipDir);
    const webm = files.find((f) => f.endsWith('.webm'));
    if (webm) {
      const dest = path.join(CLIPS_DIR, `${scene.id}.webm`);
      await rename(path.join(clipDir, webm), dest);
      recorded.push({ id: scene.id, video: dest, durationSec: targetSec });
      console.log(`  ✓ ${scene.id}.webm`);
    }
  }

  await browser.close();

  writeFile(
    path.join(OUT_DIR, 'video-manifest.json'),
    JSON.stringify({ clips: recorded }, null, 2)
  );

  console.log(`\n✓ Recorded ${recorded.length} synced scene clips`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
