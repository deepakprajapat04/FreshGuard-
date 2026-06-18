// freshguard-backend/integrations.js
// External API integrations: Weather, News/Disruption, Razorpay payments, Email.
// Every integration falls back to realistic mock behavior when its API key is
// missing from .env, so the app keeps working while keys are being provisioned.
const crypto = require('crypto');

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';
const NEWS_API_KEY = process.env.NEWS_API_KEY || '';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = (process.env.SMTP_USER || '').trim();
// Gmail app passwords are 16 chars — strip spaces if pasted as "abcd efgh ijkl mnop"
const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s/g, '');
const SMTP_FROM = (process.env.SMTP_FROM || SMTP_USER || 'noreply@freshguard.app').trim();

// ---------------------------------------------------------------------------
// EMAIL (Nodemailer SMTP) — mock-logs when SMTP creds are missing
// ---------------------------------------------------------------------------
let mailTransport = null;
if (SMTP_USER && SMTP_PASS) {
  const nodemailer = require('nodemailer');
  mailTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  // Verify SMTP connection on startup so misconfig is caught immediately
  mailTransport.verify().then(() => {
    console.log(`[email] SMTP ready — ${SMTP_HOST}:${SMTP_PORT} as ${SMTP_USER}`);
  }).catch((err) => {
    console.error('[email] SMTP connection FAILED:', err.message);
    console.error('[email] Check SMTP_USER / SMTP_PASS in backend/.env (use a Gmail App Password, not your login password)');
    mailTransport = null;
  });
} else {
  console.log('[email] SMTP not configured — set SMTP_USER and SMTP_PASS in backend/.env');
}

async function sendEmail({ to, subject, text, html }) {
  if (!mailTransport) {
    console.log(`[email:mock] to=${to || SMTP_USER || 'ops@freshguard.local'} subject="${subject}"`);
    if (text) console.log(`[email:mock] body:\n${text}`);
    return { simulated: true, to, subject };
  }
  try {
    const info = await mailTransport.sendMail({
      from: `"FreshGuard Platform" <${SMTP_FROM}>`,
      to: to || SMTP_USER,
      subject,
      text,
      html,
    });
    console.log(`[email:sent] to=${to} messageId=${info.messageId}`);
    return { simulated: false, messageId: info.messageId };
  } catch (err) {
    console.error(`[email:send-failed] to=${to}:`, err.message);
    throw err;
  }
}

// Fire-and-forget variant for in-pipeline notifications (never throws)
function notify(args) {
  sendEmail(args).catch((e) => console.error('[email] send failed:', e.message));
}

// ---------------------------------------------------------------------------
// WEATHER — transit corridor risk evaluation
// ---------------------------------------------------------------------------
// Known route corridors with representative midpoint coordinates
const ROUTE_CORRIDORS = {
  'PO-2026-8842': { routeId: 'Route #402 Corridor', lat: 27.6648, lng: -81.5158, region: 'Florida', altRoute: 'Northern I-81' },
  'PO-2026-9912A': { routeId: 'Route I-94 East', lat: 47.7511, lng: -120.7401, region: 'Washington', altRoute: 'US-12 Detour' },
  'PO-2026-7731C': { routeId: 'US-12 West Corridor', lat: 44.5, lng: -89.5, region: 'Wisconsin', altRoute: 'Standard Path' },
  DEFAULT: { routeId: 'I-80 West Expressway', lat: 41.8781, lng: -87.6298, region: 'Illinois', altRoute: 'Northern I-81' },
};

const SEVERE_CONDITIONS = ['Thunderstorm', 'Tornado', 'Squall', 'Snow'];

const MOCK_TRANSIT_RESPONSES = {
  'PO-2026-8842': {
    hasAnomaly: true,
    routeId: 'Route #402 Corridor',
    threatVector: 'Weather ALERT: Flash Flood Emergency & Severe Squalls near Coordinate 27.6648° N, 81.5158° W (Florida). Threat Level: Critical.',
    delayText: 'Severe storms with local accumulation are blocking Highway Interstate paths. Delay calculated: +14 hours. Predicted payload shelf-life degradation is substantial.',
    mitigationText: 'Bypass weather cell coordinates by rerouting transit via the Northern I-81 corridor detour bypass. This detour avoids localized severe cloudburst zones entirely.',
    mitigationSummary: 'Detour adds +45 miles, but completely circumvents risk coordinate intersections, restoring cold-chain temperature safety.',
    alternativeRouteName: 'Northern I-81',
  },
  'PO-2026-9912A': {
    hasAnomaly: true,
    routeId: 'Route I-94 East',
    threatVector: 'Weather ALERT: Active Thunderstorm Frontal boundary near Coordinate 47.7511° N, 120.7401° W. Threat Level: High.',
    delayText: 'Extreme weather event with high wind warnings along Interstate 94 has caused traffic slowdowns. Expected detour delay: +2.4 hours.',
    mitigationText: 'Reroute transit vehicle via the US-12 bypass route to safely maneuver around active thunderstorm coordinates.',
    mitigationSummary: 'US-12 detour preserves stable refrigeration ambient conditions (42°F outside) avoiding major high-wind delays.',
    alternativeRouteName: 'US-12 Detour',
  },
  'PO-2026-7731C': {
    hasAnomaly: false,
    routeId: 'US-12 West Corridor',
    threatVector: 'Weather Report: Normal atmospheric pressure, Clear Skies. Threat Level: None.',
    delayText: 'Transit conditions nominal. Ambient temperatures stable at 72°F.',
    mitigationText: 'Standard path is optimal. Keep current transit plan.',
    mitigationSummary: 'On schedule under clear path conditions.',
    alternativeRouteName: 'Standard Path',
  },
};

function resolveCorridorKey(id, product, route) {
  const searchStr = `${id || ''} ${product || ''} ${route || ''}`.toLowerCase();
  if (searchStr.includes('9912') || searchStr.includes('salmon') || searchStr.includes('seattle')) return 'PO-2026-9912A';
  if (searchStr.includes('7731') || searchStr.includes('milk') || searchStr.includes('wisconsin') || searchStr.includes('us-12')) return 'PO-2026-7731C';
  if (searchStr.includes('8842') || searchStr.includes('florida')) return 'PO-2026-8842';
  return 'DEFAULT';
}

async function evaluateTransitLive(corridorKey) {
  const corridor = ROUTE_CORRIDORS[corridorKey] || ROUTE_CORRIDORS.DEFAULT;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${corridor.lat}&lon=${corridor.lng}&appid=${OPENWEATHER_API_KEY}&units=metric`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`OpenWeatherMap HTTP ${resp.status}`);
  const w = await resp.json();

  const condition = w.weather?.[0]?.main || 'Clear';
  const description = w.weather?.[0]?.description || 'clear sky';
  const windKmh = Math.round((w.wind?.speed || 0) * 3.6);
  const tempC = Math.round(w.main?.temp ?? 20);
  const isSevere = SEVERE_CONDITIONS.includes(condition) || windKmh > 60 || (condition === 'Rain' && windKmh > 40);

  if (isSevere) {
    return {
      hasAnomaly: true,
      routeId: corridor.routeId,
      threatVector: `OpenWeatherMap LIVE ALERT: ${condition} (${description}) near Coordinate ${corridor.lat}° N, ${Math.abs(corridor.lng)}° W (${corridor.region}). Wind ${windKmh} km/h. Threat Level: High.`,
      delayText: `Live weather event (${description}) along ${corridor.routeId} may cause traffic slowdowns and refrigeration strain at ${tempC}°C ambient. Expected delay: +${windKmh > 60 ? 8 : 3} hours.`,
      mitigationText: `Reroute transit vehicle via the ${corridor.altRoute} corridor to bypass the active ${condition.toLowerCase()} zone.`,
      mitigationSummary: `${corridor.altRoute} detour avoids the live ${condition.toLowerCase()} cell, protecting cold-chain integrity.`,
      alternativeRouteName: corridor.altRoute,
    };
  }
  return {
    hasAnomaly: false,
    routeId: corridor.routeId,
    threatVector: `OpenWeatherMap LIVE Report: ${condition} (${description}), ${tempC}°C, wind ${windKmh} km/h near ${corridor.region}. Threat Level: None.`,
    delayText: `Transit conditions nominal. Live ambient temperature stable at ${tempC}°C.`,
    mitigationText: 'Standard path is optimal. Keep current transit plan.',
    mitigationSummary: 'On schedule under live-verified clear path conditions.',
    alternativeRouteName: 'Standard Path',
  };
}

// ---------------------------------------------------------------------------
// NEWS / DISRUPTION
// ---------------------------------------------------------------------------
const MOCK_DISRUPTION_NEWS = [
  { title: 'Port congestion eases on US West Coast as backlog clears', source: 'Mock Wire', publishedAt: new Date().toISOString(), url: '#', severity: 'LOW' },
  { title: 'Cold storage capacity tightens in Midwest ahead of summer produce peak', source: 'Mock Wire', publishedAt: new Date().toISOString(), url: '#', severity: 'MEDIUM' },
  { title: 'Trucker availability improves on I-80 corridor, spot rates dip 4%', source: 'Mock Wire', publishedAt: new Date().toISOString(), url: '#', severity: 'LOW' },
  { title: 'Heavy rainfall warning may disrupt Florida produce shipments this week', source: 'Mock Wire', publishedAt: new Date().toISOString(), url: '#', severity: 'HIGH' },
];

async function fetchDisruptionNewsLive(query) {
  const q = encodeURIComponent(query || 'supply chain disruption OR port congestion OR cold storage OR food logistics');
  const url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${NEWS_API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`NewsAPI HTTP ${resp.status}`);
  const data = await resp.json();
  return (data.articles || []).map((a) => ({
    title: a.title,
    source: a.source?.name || 'Unknown',
    publishedAt: a.publishedAt,
    url: a.url,
    severity: /strike|storm|flood|shortage|crisis|halt/i.test(a.title) ? 'HIGH' : 'MEDIUM',
  }));
}

// ---------------------------------------------------------------------------
// RAZORPAY PAYMENTS
// ---------------------------------------------------------------------------
async function createRazorpayOrder({ amountInr, receipt, notes }) {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  const resp = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      amount: Math.round(amountInr * 100), // paise
      currency: 'INR',
      receipt,
      notes,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.description || `Razorpay HTTP ${resp.status}`);
  return data;
}

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

// ---------------------------------------------------------------------------
// ROUTE REGISTRATION
// ---------------------------------------------------------------------------
function registerIntegrationRoutes(app, prisma) {
  // WEATHER: transit corridor risk (live OpenWeatherMap, mock fallback)
  app.post('/api/evaluate-transit', async (req, res) => {
    const { id, product, route } = req.body || {};
    const corridorKey = resolveCorridorKey(id, product, route);
    try {
      if (OPENWEATHER_API_KEY) {
        const live = await evaluateTransitLive(corridorKey);
        return res.json({ ...live, liveData: true });
      }
    } catch (e) {
      console.error('[weather] live call failed, using mock:', e.message);
    }
    const mock = MOCK_TRANSIT_RESPONSES[corridorKey] || MOCK_TRANSIT_RESPONSES['PO-2026-8842'];
    res.json({ ...mock, liveData: false });
  });

  // NEWS: supply-chain disruption headlines (live NewsAPI, mock fallback)
  app.get('/api/news/disruptions', async (req, res) => {
    try {
      if (NEWS_API_KEY) {
        const articles = await fetchDisruptionNewsLive(req.query.q);
        return res.json({ success: true, liveData: true, articles });
      }
    } catch (e) {
      console.error('[news] live call failed, using mock:', e.message);
    }
    res.json({ success: true, liveData: false, articles: MOCK_DISRUPTION_NEWS });
  });

  // PAYMENTS: create a Razorpay order for a purchase order
  app.post('/api/payments/create-order', async (req, res) => {
    try {
      const { poNumber, amount } = req.body || {};
      if (!poNumber) return res.status(400).json({ success: false, error: 'Missing poNumber.' });

      // Prefer the DB amount; fall back to the client-provided amount for
      // demo POs that only exist in the UI state.
      const po = await prisma.purchaseOrder.findUnique({ where: { id: poNumber } });
      const amountInr = po ? Number(po.totalAmount) : Number(amount);
      if (!amountInr || amountInr <= 0) {
        return res.status(404).json({ success: false, error: `Purchase order ${poNumber} not found and no amount provided.` });
      }

      if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
        const order = await createRazorpayOrder({
          amountInr,
          receipt: poNumber,
          notes: { poNumber, cargo: po.cargoDescription.slice(0, 100) },
        });
        return res.json({
          success: true,
          liveData: true,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          razorpayKeyId: RAZORPAY_KEY_ID,
          poNumber,
        });
      }

      // Mock fallback: simulated order so the UI flow can be exercised
      res.json({
        success: true,
        liveData: false,
        orderId: `order_MOCK${crypto.randomBytes(7).toString('hex')}`,
        amount: Math.round(amountInr * 100),
        currency: 'INR',
        razorpayKeyId: 'rzp_test_MOCKKEY',
        poNumber,
      });
    } catch (err) {
      console.error('Error in POST /api/payments/create-order', err);
      res.status(500).json({ success: false, error: 'Payment order creation failed.', details: err.message });
    }
  });

  // PAYMENTS: verify a completed Razorpay checkout signature
  app.post('/api/payments/verify', async (req, res) => {
    try {
      const { orderId, paymentId, signature, poNumber } = req.body || {};

      let verified;
      if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
        verified = verifyRazorpaySignature({ orderId, paymentId, signature });
      } else {
        verified = Boolean(orderId && String(orderId).startsWith('order_MOCK'));
      }

      if (!verified) {
        return res.status(400).json({ success: false, verified: false, error: 'Signature verification failed.' });
      }

      if (poNumber) {
        await prisma.purchaseOrder.updateMany({
          where: { id: poNumber },
          data: { fulfillmentStatus: 'paid' },
        });
        notify({
          subject: `Payment received for ${poNumber}`,
          text: `Razorpay payment ${paymentId || '(mock)'} verified for purchase order ${poNumber}.`,
        });
      }

      res.json({ success: true, verified: true, liveData: Boolean(RAZORPAY_KEY_ID) });
    } catch (err) {
      console.error('Error in POST /api/payments/verify', err);
      res.status(500).json({ success: false, error: 'Payment verification failed.', details: err.message });
    }
  });

  // EMAIL: direct notification endpoint
  app.post('/api/notify/email', async (req, res) => {
    try {
      const { to, subject, message } = req.body || {};
      if (!subject) return res.status(400).json({ success: false, error: 'Missing subject.' });
      const result = await sendEmail({ to, subject, text: message });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error('Error in POST /api/notify/email', err);
      res.status(500).json({ success: false, error: 'Email dispatch failed.', details: err.message });
    }
  });
}

module.exports = { registerIntegrationRoutes, notify, sendEmail };
