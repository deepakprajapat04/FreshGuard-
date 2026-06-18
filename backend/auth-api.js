// freshguard-backend/auth-api.js
// Authentication: signup, email verification (proves inbox ownership),
// login (email OR phone), and session lookup.

const bcrypt = require('bcryptjs');
const { sendEmail } = require('./integrations');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const POPULAR_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'aol.com', 'protonmail.com', 'proton.me',
  'zoho.com', 'mail.com', 'yandex.com', 'gmx.com',
];

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function suggestEmailFix(email) {
  const domain = email.split('@')[1] || '';
  if (!domain) return null;
  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  const tldTypos = { con: 'com', cmo: 'com', vom: 'com', xom: 'com', ocm: 'com', comm: 'com', co: null };
  if (Object.prototype.hasOwnProperty.call(tldTypos, tld) && tldTypos[tld]) {
    return email.split('@')[0] + '@' + [...parts.slice(0, -1), tldTypos[tld]].join('.');
  }
  if (POPULAR_DOMAINS.includes(domain)) return null;
  let best = null, bestDist = Infinity;
  for (const d of POPULAR_DOMAINS) {
    const dist = levenshtein(domain, d);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  if (best && bestDist > 0 && bestDist <= 2) return email.split('@')[0] + '@' + best;
  return null;
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function dispatchVerificationEmail(email, fullName, code) {
  const subject = 'Verify your FreshGuard email address';
  const text = [
    `Hi ${fullName},`,
    '',
    `Your FreshGuard verification code is: ${code}`,
    '',
    'Enter this code in the app to confirm you own this email address.',
    'The code expires in 15 minutes.',
    '',
    'If you did not create a FreshGuard account, you can ignore this email.',
  ].join('\n');
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#059669">FreshGuard Email Verification</h2>
      <p>Hi ${fullName},</p>
      <p>Enter this code to prove you own <strong>${email}</strong>:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#059669">${code}</p>
      <p style="color:#64748b;font-size:14px">Expires in 15 minutes. If you didn't sign up, ignore this email.</p>
    </div>`;
  return sendEmail({ to: email, subject, text, html });
}

function publicUser(u) {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
  };
}

function normalizeOptionalEmail(raw) {
  const v = String(raw || '').trim().toLowerCase();
  return v || null;
}

function normalizeOptionalPhone(raw) {
  const v = String(raw || '').replace(/\D/g, '');
  return v || null;
}

function registerAuthRoutes(app, prisma) {
  // -------------------------------------------------------------------------
  // SIGN UP — email OR phone (at least one). Email signups require verification.
  // -------------------------------------------------------------------------
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { fullName, email, phone, password, role } = req.body || {};
      if (!fullName || !password) {
        return res.status(400).json({ success: false, error: 'Full name and password are required.' });
      }

      const normalizedEmail = normalizeOptionalEmail(email);
      const normalizedPhone = normalizeOptionalPhone(phone);

      if (!normalizedEmail && !normalizedPhone) {
        return res.status(400).json({ success: false, error: 'Provide at least an email or a phone number.' });
      }
      if (normalizedEmail) {
        if (!EMAIL_RE.test(normalizedEmail)) {
          return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
        }
        const suggestion = suggestEmailFix(normalizedEmail);
        if (suggestion) {
          return res.status(400).json({ success: false, error: `That email looks misspelled. Did you mean ${suggestion}?` });
        }
      }
      if (normalizedPhone && normalizedPhone.length < 7) {
        return res.status(400).json({ success: false, error: 'Please enter a valid phone number (at least 7 digits).' });
      }
      if (String(password).length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
      }

      const dupConditions = [];
      if (normalizedEmail) dupConditions.push({ email: normalizedEmail });
      if (normalizedPhone) dupConditions.push({ phone: normalizedPhone });

      const existing = dupConditions.length
        ? await prisma.appUser.findFirst({ where: { OR: dupConditions } })
        : null;

      if (existing) {
        if (normalizedEmail && !existing.emailVerified && existing.email === normalizedEmail) {
          const code = generateVerificationCode();
          await prisma.appUser.update({
            where: { id: existing.id },
            data: {
              emailVerificationCode: code,
              emailVerificationExpires: new Date(Date.now() + CODE_TTL_MS),
            },
          });
          const mailResult = await dispatchVerificationEmail(normalizedEmail, existing.fullName, code);
          const payload = {
            success: true,
            requiresVerification: true,
            userId: existing.id,
            email: normalizedEmail,
            message: 'A verification code was sent to your email. Enter it to activate your account.',
          };
          if (mailResult.simulated && process.env.NODE_ENV !== 'production') {
            payload.devCode = code;
            payload.emailSimulated = true;
          }
          return res.status(200).json(payload);
        }
        const dupField =
          normalizedEmail && existing.email === normalizedEmail ? 'email'
          : normalizedPhone && existing.phone === normalizedPhone ? 'phone number'
          : 'account detail';
        return res.status(409).json({ success: false, error: `An account with this ${dupField} already exists. Please log in instead.` });
      }

      const passwordHash = await bcrypt.hash(String(password), 10);

      // Phone-only signup — no email to verify, log in immediately
      if (!normalizedEmail) {
        const user = await prisma.appUser.create({
          data: {
            fullName: String(fullName).trim(),
            email: null,
            phone: normalizedPhone,
            passwordHash,
            role: role === 'VENDOR' ? 'VENDOR' : 'BUYER',
            emailVerified: true,
            lastLoginAt: new Date(),
          },
        });
        return res.status(201).json({ success: true, user: publicUser(user) });
      }

      // Email signup (phone optional) — send verification code
      const code = generateVerificationCode();
      const user = await prisma.appUser.create({
        data: {
          fullName: String(fullName).trim(),
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash,
          role: role === 'VENDOR' ? 'VENDOR' : 'BUYER',
          emailVerified: false,
          emailVerificationCode: code,
          emailVerificationExpires: new Date(Date.now() + CODE_TTL_MS),
        },
      });

      const mailResult = await dispatchVerificationEmail(normalizedEmail, user.fullName, code);
      if (mailResult.simulated) {
        console.log(`[auth:verify] Code for ${normalizedEmail}: ${code}`);
      }

      const payload = {
        success: true,
        requiresVerification: true,
        userId: user.id,
        email: normalizedEmail,
        message: 'We sent a 6-digit verification code to your email. Enter it to prove you own this address.',
      };
      if (mailResult.simulated && process.env.NODE_ENV !== 'production') {
        payload.devCode = code;
        payload.emailSimulated = true;
      }

      res.status(201).json(payload);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // VERIFY EMAIL — user must enter the code received in their inbox
  // -------------------------------------------------------------------------
  app.post('/api/auth/verify-email', async (req, res) => {
    try {
      const { email, code } = req.body || {};
      if (!email || !code) {
        return res.status(400).json({ success: false, error: 'Email and verification code are required.' });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await prisma.appUser.findUnique({ where: { email: normalizedEmail } });
      if (!user) {
        return res.status(404).json({ success: false, error: 'No account found for this email.' });
      }
      if (user.emailVerified) {
        return res.json({ success: true, user: publicUser(user), message: 'Email already verified.' });
      }
      if (!user.emailVerificationCode || user.emailVerificationCode !== String(code).trim()) {
        return res.status(400).json({ success: false, error: 'Invalid verification code. Please check and try again.' });
      }
      if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
        return res.status(400).json({ success: false, error: 'Verification code expired. Request a new one.' });
      }

      const verified = await prisma.appUser.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerificationCode: null,
          emailVerificationExpires: null,
          lastLoginAt: new Date(),
        },
      });

      res.json({ success: true, user: publicUser(verified), message: 'Email verified successfully. You can now use your account.' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // RESEND VERIFICATION CODE
  // -------------------------------------------------------------------------
  app.post('/api/auth/resend-verification', async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ success: false, error: 'Email is required.' });

      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await prisma.appUser.findUnique({ where: { email: normalizedEmail } });
      if (!user) {
        return res.status(404).json({ success: false, error: 'No account found for this email.' });
      }
      if (user.emailVerified) {
        return res.json({ success: true, message: 'Email is already verified. You can log in.' });
      }

      const code = generateVerificationCode();
      await prisma.appUser.update({
        where: { id: user.id },
        data: {
          emailVerificationCode: code,
          emailVerificationExpires: new Date(Date.now() + CODE_TTL_MS),
        },
      });

      const mailResult = await dispatchVerificationEmail(normalizedEmail, user.fullName, code);
      if (mailResult.simulated) {
        console.log(`[auth:verify] Resent code for ${normalizedEmail}: ${code}`);
      }

      const payload = { success: true, message: 'A new verification code was sent to your email.' };
      if (mailResult.simulated && process.env.NODE_ENV !== 'production') {
        payload.devCode = code;
        payload.emailSimulated = true;
      }
      res.json(payload);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // LOG IN — blocked until email is verified (proves real inbox ownership)
  // -------------------------------------------------------------------------
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { identifier, password } = req.body || {};
      if (!identifier || !password) {
        return res.status(400).json({ success: false, error: 'Email/phone and password are required.' });
      }

      const raw = String(identifier).trim();
      const asEmail = raw.toLowerCase();
      const asPhone = raw.replace(/\D/g, '');

      const user = await prisma.appUser.findFirst({
        where: { OR: [{ email: asEmail }, { phone: asPhone }] },
      });
      if (!user) {
        return res.status(401).json({ success: false, error: 'No account found with those credentials.' });
      }

      const ok = await bcrypt.compare(String(password), user.passwordHash);
      if (!ok) {
        return res.status(401).json({ success: false, error: 'Incorrect password. Please try again.' });
      }

      if (user.email && !user.emailVerified) {
        return res.status(403).json({
          success: false,
          error: 'Your email is not verified yet. Check your inbox for the 6-digit code.',
          requiresVerification: true,
          email: user.email,
        });
      }

      await prisma.appUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      res.json({ success: true, user: publicUser(user) });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/auth/me/:id', async (req, res) => {
    try {
      const user = await prisma.appUser.findUnique({ where: { id: req.params.id } });
      if (!user) return res.status(404).json({ success: false, error: 'Session expired. Please log in again.' });
      res.json({ success: true, user: publicUser(user) });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = { registerAuthRoutes };
