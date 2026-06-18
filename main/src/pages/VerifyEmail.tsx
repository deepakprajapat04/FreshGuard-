import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ScanLine, Mail, Loader2, ArrowLeft, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { verifyEmail, resendVerification, isAuthenticated } = useAuth();

  const emailFromQuery = params.get('email') || '';
  const [email] = useState(emailFromQuery);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(params.get('devCode'));
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!email) setError('Missing email address. Please sign up again.');
  }, [email]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || code.length < 6) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const result = await verifyEmail(email, code.trim());
    setSubmitting(false);
    if (result.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setError(result.error || 'Verification failed.');
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setError(null);
    setInfo(null);
    setResending(true);
    const result = await resendVerification(email);
    setResending(false);
    if (result.success) {
      setInfo(result.message || 'A new code was sent.');
      if (result.devCode) setDevCode(result.devCode);
    } else {
      setError(result.error || 'Could not resend code.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-5 font-sans">
      <div className="w-full max-w-md">
        <Link to="/auth?mode=signup" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
            <ScanLine className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">FreshGuard</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
            <Mail className="w-6 h-6 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Verify your email</h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            We sent a 6-digit code to <strong className="text-slate-800">{email || 'your email'}</strong>.
            Enter it below to prove you own this inbox — fake or mistyped addresses won't receive a code.
          </p>

          {devCode && (
            <div className="mt-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
              <strong>Dev mode:</strong> SMTP is not configured, so no real email was sent.
              Use code <span className="font-mono font-bold text-lg tracking-widest">{devCode}</span>
            </div>
          )}

          {error && (
            <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}
          {info && (
            <div className="mt-4 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">{info}</div>
          )}

          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                className="auth-input !pl-3 text-center text-2xl font-mono tracking-[0.4em] letter-spacing-wide"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || code.length < 6 || !email}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Verifying…</> : 'Verify & continue'}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Code expires in 15 min
            </span>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || !email}
              className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
            >
              {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Resend code
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
