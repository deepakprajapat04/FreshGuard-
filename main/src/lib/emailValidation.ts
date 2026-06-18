// Email validation shared by the auth forms.
// Mirrors backend/auth-api.js so users get instant feedback before submitting.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

const POPULAR_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'aol.com', 'protonmail.com', 'proton.me',
  'zoho.com', 'mail.com', 'yandex.com', 'gmx.com',
];

const TLD_TYPOS: Record<string, string> = {
  con: 'com', cmo: 'com', vom: 'com', xom: 'com', ocm: 'com', comm: 'com',
};

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Suggests a corrected email when the domain looks like a typo, else null.
export function suggestEmailFix(email: string): string | null {
  const lower = email.trim().toLowerCase();
  const [local, domain] = lower.split('@');
  if (!domain) return null;

  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  if (TLD_TYPOS[tld]) {
    return `${local}@${[...parts.slice(0, -1), TLD_TYPOS[tld]].join('.')}`;
  }

  if (POPULAR_DOMAINS.includes(domain)) return null;

  let best: string | null = null;
  let bestDist = Infinity;
  for (const d of POPULAR_DOMAINS) {
    const dist = levenshtein(domain, d);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  if (best && bestDist > 0 && bestDist <= 2) {
    return `${local}@${best}`;
  }
  return null;
}

// Full validation used on submit. Returns an error message or null when valid.
export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!EMAIL_RE.test(trimmed)) return 'Please enter a valid email address.';
  const suggestion = suggestEmailFix(trimmed);
  if (suggestion) return `That email looks misspelled. Did you mean ${suggestion}?`;
  return null;
}
