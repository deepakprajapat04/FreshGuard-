import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ScanLine,
  Mail,
  Phone,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateEmail, suggestEmailFix } from '../lib/emailValidation';

type Mode = 'login' | 'signup';

export default function Auth() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { login, signup, isAuthenticated } = useAuth();

  const initialMode: Mode = params.get('mode') === 'signup' ? 'signup' : 'login';
  const [mode, setMode] = useState<Mode>(initialMode);

  // Shared fields
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Login field (email OR phone)
  const [identifier, setIdentifier] = useState('');

  // Signup fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'BUYER' | 'VENDOR'>('BUYER');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already logged in? Skip straight to the app.
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  // Keep the URL in sync so refreshes preserve the chosen tab
  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setParams({ mode: m }, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (mode === 'signup') {
      const emailTrimmed = email.trim();
      const phoneTrimmed = phone.trim();
      if (!emailTrimmed && !phoneTrimmed) {
        setError('Please enter an email or a phone number.');
        setSubmitting(false);
        return;
      }
      if (emailTrimmed) {
        const emailError = validateEmail(emailTrimmed);
        if (emailError) {
          setError(emailError);
          setSubmitting(false);
          return;
        }
      }
      if (phoneTrimmed && phoneTrimmed.replace(/\D/g, '').length < 7) {
        setError('Please enter a valid phone number (at least 7 digits).');
        setSubmitting(false);
        return;
      }
    }

    let result;
    if (mode === 'login') {
      result = await login(identifier.trim(), password);
    } else {
      result = await signup({
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
        role,
      });
    }

    setSubmitting(false);
    if (result.success) {
      if (result.requiresVerification && result.email) {
        const q = new URLSearchParams({ email: result.email });
        if (result.devCode) q.set('devCode', result.devCode);
        navigate(`/verify-email?${q.toString()}`, { replace: true });
        return;
      }
      navigate('/dashboard', { replace: true });
    } else {
      if (result.requiresVerification && result.email) {
        const q = new URLSearchParams({ email: result.email });
        navigate(`/verify-email?${q.toString()}`, { replace: true });
        return;
      }
      setError(result.error || 'Something went wrong.');
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Left brand panel (hidden on small screens) */}
      <div className="hidden lg:flex w-1/2 relative bg-emerald-900 text-white overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-600/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2.5 w-fit">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">FreshGuard</span>
          </Link>

          <div>
            <h2 className="text-4xl font-extrabold leading-tight">
              Protect every<br />link in your<br /><span className="text-emerald-400">cold chain.</span>
            </h2>
            <p className="mt-5 text-emerald-100/80 max-w-md">
              Procurement, live logistics, AI quality control and wastage recovery — all in one
              secure platform. Your account keeps your data saved and synced.
            </p>
            <div className="mt-8 flex items-center gap-2 text-sm text-emerald-200">
              <ShieldCheck className="w-5 h-5" />
              Passwords are encrypted and stored securely.
            </div>
          </div>

          <div className="text-sm text-emerald-200/60">© {new Date().getFullYear()} FreshGuard</div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md">
          {/* Back to landing */}
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">FreshGuard</span>
          </div>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-7">
            <button
              onClick={() => switchMode('login')}
              className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Login
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sign Up
            </button>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-slate-500 mt-1 mb-6 text-sm">
            {mode === 'login'
              ? 'Log in with your email or phone number to continue.'
              : 'Provide your email or phone number — at least one is required.'}
          </p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === 'signup' && (
                <motion.div
                  key="signup-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <Field icon={User} label="Full name">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Sarah Mitchell"
                      required
                      className="auth-input"
                    />
                  </Field>
                  <Field icon={Mail} label="Email (optional)">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        const v = e.target.value.trim();
                        setEmailHint(v.includes('@') && v.split('@')[1]?.includes('.') ? suggestEmailFix(v) : null);
                      }}
                      placeholder="you@company.com"
                      className="auth-input"
                    />
                  </Field>
                  {emailHint && (
                    <p className="-mt-2 text-xs text-amber-600">
                      Did you mean{' '}
                      <button
                        type="button"
                        onClick={() => { setEmail(emailHint); setEmailHint(null); }}
                        className="font-semibold underline hover:text-amber-700"
                      >
                        {emailHint}
                      </button>
                      ?
                    </p>
                  )}
                  <Field icon={Phone} label="Phone number (optional)">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 555 123 4567"
                      className="auth-input"
                    />
                  </Field>
                  <p className="-mt-2 text-xs text-slate-500">
                    At least one of email or phone is required. If you sign up with email, we&apos;ll send a verification code.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">I am a</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['BUYER', 'VENDOR'] as const).map((r) => (
                        <button
                          type="button"
                          key={r}
                          onClick={() => setRole(r)}
                          className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${role === r ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                        >
                          {r === 'BUYER' ? 'Buyer / Admin' : 'Vendor'}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {mode === 'login' && (
              <Field icon={Mail} label="Email or phone">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@company.com or +1 555 123 4567"
                  required
                  className="auth-input"
                />
              </Field>
            )}

            <Field icon={Lock} label="Password">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                required
                minLength={6}
                className="auth-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </Field>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/25 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Please wait…</>
              ) : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === 'login' ? (
              <>New to FreshGuard?{' '}
                <button onClick={() => switchMode('signup')} className="font-semibold text-emerald-600 hover:text-emerald-700">
                  Create an account
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => switchMode('login')} className="font-semibold text-emerald-600 hover:text-emerald-700">
                  Log in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        {children}
      </div>
    </div>
  );
}
