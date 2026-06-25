/** Scene definitions — one block per voiceover paragraph, synced by measured audio duration. */

import { showAiAgentsOverlay } from './ai-agents.mjs';

export const SCENES = [
  {
    id: '01-intro',
    voice:
      "This is FreshGuard—an end-to-end cold-chain intelligence platform designed to stop fresh produce spoilage before it costs your business. We handle everything from automated bidding to live IoT logistics. Let's log into our secure portal and see how it works.",
    async run(page, h) {
      await h.go(page, '/', 2000);
      await h.kenBurnsZoom(page, 1.06, 5000);
      await h.smoothScroll(page, 300, 1600);
      await h.sleep(1200);
      await h.go(page, '/auth?mode=login', 2000);
      const inputs = page.locator('input.auth-input');
      if ((await inputs.count()) >= 2) {
        await inputs.nth(0).fill('alex.chen@freshguard.demo');
        await inputs.nth(1).fill('••••••••');
      }
      await h.sleep(1800);
      await h.go(page, '/dashboard', 1500);
    },
  },
  {
    id: '02-buyer-dashboard-procurement',
    voice:
      'As a Buyer, the Executive Dashboard monitors shrinkage telemetry and live pipeline risks in real time. Moving to Procurement, buyers can set strict biological parameters and instantly compare competing vendor quotes side-by-side to optimize contract allocation.',
    async run(page, h) {
      await h.setPersona(page, 'Buyer');
      await h.go(page, '/dashboard', 1500);
      await h.kenBurnsZoom(page, 1.05, 4500);
      await h.smoothScroll(page, 280, 1500);
      await h.sleep(1200);
      await h.clickNav(page, 'Procurement');
      await h.resetZoom(page);
      await h.kenBurnsZoom(page, 1.05, 3800);
      await h.smoothScroll(page, 380, 1600);
      await h.sleep(1000);
      const bidRow = page.locator('button, tr, [class*="cursor-pointer"]').filter({ hasText: /quote|bid|cases/i }).first();
      if (await bidRow.count()) {
        try {
          await bidRow.click({ timeout: 2000 });
          await h.sleep(2000);
        } catch {
          /* ok */
        }
      }
    },
  },
  {
    id: '03-vendor',
    voice:
      'Switching to the Vendor view, suppliers receive automated requests and can submit detailed quotes with fleet specs and transit routes. The platform even tracks warehouse pre-cooling readiness before the trucks roll out.',
    async run(page, h) {
      await h.go(page, '/procurement', 1500);
      await h.setPersona(page, 'Vendor');
      await h.sleep(1200);
      await h.smoothScroll(page, 320, 1500);
      await h.sleep(1000);
      const quoteBtn = page.getByRole('button', { name: /submit|quote|respond/i }).first();
      if (await quoteBtn.count()) {
        try {
          await quoteBtn.scrollIntoViewIfNeeded();
          await h.sleep(1500);
        } catch {
          /* ok */
        }
      }
      await h.resetZoom(page);
      await h.kenBurnsZoom(page, 1.04, 3800);
      await h.smoothScroll(page, 220, 1200);
    },
  },
  {
    id: '04-logistics-qc',
    voice:
      'During transit, continuous IoT beacon tracking monitors real-time internal container temperatures. Once shipments arrive at the warehouse, our FreshDetect AI core scans the pallets to instantly grade freshness and flag thermal defects.',
    async run(page, h) {
      await h.setPersona(page, 'Buyer');
      await h.clickNav(page, 'Logistics');
      await h.resetZoom(page);
      const mapBtn = page.getByRole('button', { name: /map view/i }).first();
      if (await mapBtn.count()) await mapBtn.click();
      await h.sleep(1200);
      const queueRow = page.locator('[id^="queue-row-"], [class*="cursor-pointer"]').filter({ hasText: /PO-/i }).first();
      if (await queueRow.count()) {
        try {
          await queueRow.click();
          await h.sleep(2000);
        } catch {
          /* ok */
        }
      }
      await h.kenBurnsZoom(page, 1.08, 5000);
      await h.sleep(1200);
      await h.clickNav(page, 'Quality Control');
      await h.resetZoom(page);
      const loadBatch = page.locator('[id^="queue-row-"]').first();
      if (await loadBatch.count()) {
        try {
          await loadBatch.click();
          await h.sleep(5500);
        } catch {
          /* ok */
        }
      }
      await h.kenBurnsZoom(page, 1.06, 3800);
    },
  },
  {
    id: '05-store-claims',
    voice:
      'Approved batches are routed to retail nodes using a secure blockchain ledger. If any compliance slip-ups happen, the Claims module automatically flags the issue, providing identical transparency to both buyers and vendors to quickly resolve financial disputes.',
    async run(page, h) {
      await h.clickNav(page, 'Store');
      await h.resetZoom(page);
      await h.smoothScroll(page, 260, 1400);
      await h.kenBurnsZoom(page, 1.05, 3500);
      await h.sleep(1000);
      await h.clickNav(page, 'Claims');
      await h.resetZoom(page);
      await h.smoothScroll(page, 280, 1400);
      const claimCard = page.locator('[class*="rounded"]').filter({ hasText: /claim|dispute|wastage/i }).first();
      if (await claimCard.count()) {
        try {
          await claimCard.scrollIntoViewIfNeeded();
          await h.sleep(1500);
        } catch {
          /* ok */
        }
      }
      await h.kenBurnsZoom(page, 1.04, 3200);
    },
  },
  {
    id: '06-reports',
    voice:
      'Finally, robust analytics break down long-term shrinkage trends for buyers and product performance patterns for vendors. FreshGuard aligns the entire supply chain under one smart dashboard.',
    async run(page, h) {
      await h.clickNav(page, 'Reports');
      await h.resetZoom(page);
      await h.kenBurnsZoom(page, 1.06, 4200);
      await h.smoothScroll(page, 320, 1500);
      await h.sleep(1200);
      await h.clickNav(page, 'Overview');
      await h.go(page, '/dashboard', 1500);
      await h.kenBurnsZoom(page, 1.04, 3800);
    },
  },
  {
    id: '07-ai-agents',
    voice:
      'Powering FreshGuard is a fleet of specialized AI agents working together. Run AI Optimization for intelligent vendor matching and split allocation. Disruption Intelligence Analysis for real-time pipeline threat detection. FreshDetect AI Quality Control with Gemini vision for multispectral freshness grading. AI Corridor Risk Analysis for live logistics and weather disruptions. AI Intelligent Mitigation Routing for automatic re-route recommendations. AI Smart Claims Ingestion for automated dispute filing with evidence. FreshDetect Scoring and the AI Audit Chain for blockchain-verified store receiving. And Predictive Shrinkage Analytics to quantify losses prevented. Thanks for watching FreshGuard.',
    async run(page, h) {
      await h.go(page, '/dashboard', 1200);
      await h.setPersona(page, 'Buyer');
      await h.resetZoom(page);
      // ~2.2s per agent highlight × 9 agents ≈ 20s of visual cycling; rest filled by hold
      await showAiAgentsOverlay(page, 2400);
      await h.kenBurnsZoom(page, 1.03, 3000);
    },
  },
];
