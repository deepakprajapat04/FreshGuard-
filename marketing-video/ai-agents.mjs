/** AI agent cards shown in the closing showcase scene */

export const AI_AGENTS = [
  { name: 'Run AI Optimization', desc: 'Vendor matching & split contract allocation', icon: '🤖', color: '#4f46e5' },
  { name: 'Disruption Intelligence Analysis', desc: 'Real-time pipeline threat detection', icon: '🛰️', color: '#6366f1' },
  { name: 'FreshDetect AI Quality Control', desc: 'Gemini vision · multispectral freshness grading', icon: '🔬', color: '#10b981' },
  { name: 'AI Corridor Risk Analysis', desc: 'Live weather & transit hazard evaluation', icon: '🌩️', color: '#f59e0b' },
  { name: 'AI Intelligent Mitigation Routing', desc: 'Automatic alternate corridor recommendations', icon: '🗺️', color: '#06b6d4' },
  { name: 'AI Smart Claims Ingestion', desc: 'Gemini-powered automated dispute filing', icon: '📋', color: '#ec4899' },
  { name: 'FreshDetect Scoring Matrix', desc: 'Inbound lot quality scoring at receiving', icon: '✅', color: '#10b981' },
  { name: 'AI Audit Chain', desc: 'Blockchain-verified store receiving ledger', icon: '⛓️', color: '#8b5cf6' },
  { name: 'Predictive Shrinkage Analytics', desc: 'Long-term loss trends & prevention ROI', icon: '📊', color: '#0ea5e9' },
];

export async function showAiAgentsOverlay(page, highlightIntervalMs = 2200) {
  await page.evaluate((agents) => {
    const existing = document.getElementById('fg-ai-showcase');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = 'fg-ai-showcase';
    wrap.innerHTML = `
      <style>
        #fg-ai-showcase {
          position: fixed; inset: 0; z-index: 99999;
          background: linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,27,75,0.96) 100%);
          backdrop-filter: blur(12px);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 48px 64px; font-family: system-ui, -apple-system, sans-serif;
          animation: fgFadeIn 0.6s ease;
        }
        @keyframes fgFadeIn { from { opacity: 0; } to { opacity: 1; } }
        #fg-ai-showcase h2 {
          color: #10b981; font-size: 13px; font-weight: 800; letter-spacing: 0.2em;
          text-transform: uppercase; margin: 0 0 8px; font-family: ui-monospace, monospace;
        }
        #fg-ai-showcase h1 {
          color: #fff; font-size: 36px; font-weight: 800; margin: 0 0 32px; text-align: center;
        }
        #fg-ai-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
          max-width: 1100px; width: 100%;
        }
        .fg-agent-card {
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px; padding: 20px 22px; transition: all 0.45s ease;
          opacity: 0.55; transform: scale(0.97);
        }
        .fg-agent-card.active {
          opacity: 1; transform: scale(1.03);
          border-color: var(--accent); box-shadow: 0 0 32px color-mix(in srgb, var(--accent) 40%, transparent);
          background: rgba(255,255,255,0.1);
        }
        .fg-agent-card .icon { font-size: 28px; margin-bottom: 8px; }
        .fg-agent-card .name { color: #fff; font-size: 14px; font-weight: 700; margin-bottom: 4px; line-height: 1.3; }
        .fg-agent-card .desc { color: #94a3b8; font-size: 11px; line-height: 1.45; font-family: ui-monospace, monospace; }
        #fg-ai-footer {
          margin-top: 28px; color: #64748b; font-size: 11px; font-family: ui-monospace, monospace;
          letter-spacing: 0.08em;
        }
      </style>
      <h2>FreshGuard AI Agent Stack</h2>
      <h1>Specialized Intelligence Across Your Cold Chain</h1>
      <div id="fg-ai-grid"></div>
      <div id="fg-ai-footer">Powered by Gemini Vision · Live IoT · Blockchain Audit Chain</div>
    `;
    document.body.appendChild(wrap);

    const grid = wrap.querySelector('#fg-ai-grid');
    agents.forEach((a, i) => {
      const card = document.createElement('div');
      card.className = 'fg-agent-card' + (i === 0 ? ' active' : '');
      card.style.setProperty('--accent', a.color);
      card.dataset.idx = String(i);
      card.innerHTML = `<div class="icon">${a.icon}</div><div class="name">${a.name}</div><div class="desc">${a.desc}</div>`;
      grid.appendChild(card);
    });

    window.__fgHighlightAgent = (idx) => {
      grid.querySelectorAll('.fg-agent-card').forEach((c, i) => {
        c.classList.toggle('active', i === idx);
      });
    };
  }, AI_AGENTS);

  for (let i = 0; i < AI_AGENTS.length; i++) {
    await page.evaluate((idx) => window.__fgHighlightAgent?.(idx), i);
    await page.waitForTimeout(highlightIntervalMs);
  }
}

export async function removeAiAgentsOverlay(page) {
  await page.evaluate(() => document.getElementById('fg-ai-showcase')?.remove());
}
