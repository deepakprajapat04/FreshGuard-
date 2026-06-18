import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: 'BUYER' | 'VENDOR' | string;
  emailVerified?: boolean;
  createdAt?: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  requiresVerification?: boolean;
  userId?: string;
  email?: string;
  devCode?: string;
  emailSimulated?: boolean;
  message?: string;
  user?: AuthUser;
}

interface SignupPayload {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  role?: 'BUYER' | 'VENDOR';
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<AuthResult>;
  signup: (payload: SignupPayload) => Promise<AuthResult>;
  verifyEmail: (email: string, code: string) => Promise<AuthResult>;
  resendVerification: (email: string) => Promise<AuthResult>;
  logout: () => void;
}

const STORAGE_KEY = 'freshguard-auth-user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: AuthUser = JSON.parse(stored);
        setUser(parsed);
        fetch(`/api/auth/me/${parsed.id}`)
          .then(r => r.json())
          .then(data => {
            if (cancelled) return;
            if (data.success && data.user?.emailVerified) {
              setUser(data.user);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
            } else {
              setUser(null);
              localStorage.removeItem(STORAGE_KEY);
            }
          })
          .catch(() => {})
          .finally(() => { if (!cancelled) setLoading(false); });
        return;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setLoading(false);
    return () => { cancelled = true; };
  }, []);

  const persist = (u: AuthUser) => {
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  };

  const login = async (identifier: string, password: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Login failed.',
          requiresVerification: data.requiresVerification,
          email: data.email,
        };
      }
      persist(data.user);
      return { success: true };
    } catch {
      return { success: false, error: 'Cannot reach the server. Is the backend running?' };
    }
  };

  const signup = async (payload: SignupPayload): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) return { success: false, error: data.error || 'Sign up failed.' };
      if (data.requiresVerification) {
        return {
          success: true,
          requiresVerification: true,
          userId: data.userId,
          email: data.email,
          devCode: data.devCode,
          emailSimulated: data.emailSimulated,
          message: data.message,
        };
      }
      if (data.user) {
        persist(data.user);
      }
      return { success: true, user: data.user };
    } catch {
      return { success: false, error: 'Cannot reach the server. Is the backend running?' };
    }
  };

  const verifyEmail = async (email: string, code: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!data.success) return { success: false, error: data.error || 'Verification failed.' };
      persist(data.user);
      return { success: true, message: data.message };
    } catch {
      return { success: false, error: 'Cannot reach the server. Is the backend running?' };
    }
  };

  const resendVerification = async (email: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.success) return { success: false, error: data.error || 'Could not resend code.' };
      return {
        success: true,
        message: data.message,
        devCode: data.devCode,
        emailSimulated: data.emailSimulated,
      };
    } catch {
      return { success: false, error: 'Cannot reach the server. Is the backend running?' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, signup, verifyEmail, resendVerification, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
