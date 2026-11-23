import { useState, type FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import { Mail, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'register' | 'reset';

function mapAuthError(err: unknown): { message: string; consoleHint?: string } {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/operation-not-allowed':
        return {
          message: 'This sign-in provider is not yet enabled in Firebase Authentication.',
          consoleHint:
            'Open Firebase Console → Authentication → Sign-in method to enable Email/Password or Apple (Services ID, Team ID, Key ID, and .p8 key). Google Sign-In is pre-configured.',
        };
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return { message: 'Invalid email or password.' };
      case 'auth/email-already-in-use':
        return { message: 'An account with this email already exists.' };
      case 'auth/weak-password':
        return { message: 'Password must be at least 6 characters.' };
      case 'auth/popup-closed-by-user':
        return { message: 'Sign-in popup was closed before completion.' };
      case 'auth/unauthorized-domain':
        return {
          message: 'Current preview domain is not authorized for OAuth popups.',
          consoleHint: 'Add this domain under Firebase Console → Authentication → Settings → Authorized domains.',
        };
      default:
        return { message: err.message };
    }
  }
  return { message: err instanceof Error ? err.message : 'Authentication failed.' };
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { signInWithEmail, registerWithEmail, signInWithGoogle, signInWithApple, sendPasswordReset } =
    useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ message: string; consoleHint?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorInfo(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
        onClose();
      } else if (mode === 'register') {
        await registerWithEmail(displayName, email, password);
        setNotice('Account created. A verification email has been sent to confirm your address.');
      } else {
        await sendPasswordReset(email);
        setNotice('Password reset instructions sent if an account exists for that email.');
      }
    } catch (err) {
      setErrorInfo(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSocial = async (provider: 'google' | 'apple') => {
    setErrorInfo(null);
    setNotice(null);
    setBusy(true);
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithApple();
      }
      onClose();
    } catch (err) {
      setErrorInfo(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="apple-glass-elevated rounded-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.08] dark:border-white/[0.1] flex items-center justify-between">
          <div>
            <h2
              id="auth-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {mode === 'login'
                ? 'Sign in to LiquidOS'
                : mode === 'register'
                  ? 'Create LiquidOS Account'
                  : 'Reset Password'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sync workspace preferences across sessions
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Social Login Integrations */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => handleSocial('google')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-white/85 dark:bg-white/10 text-slate-900 dark:text-slate-100 border border-black/10 dark:border-white/15 hover:bg-white dark:hover:bg-white/15 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>Google</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => handleSocial('apple')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
            >
              <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
              </svg>
              <span>Apple</span>
            </button>
          </div>

          <div className="relative flex items-center">
            <div className="flex-1 border-t border-black/10 dark:border-white/10" />
            <span className="px-3 text-xs text-slate-500 dark:text-slate-400">or email</span>
            <div className="flex-1 border-t border-black/10 dark:border-white/10" />
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/[0.05] dark:bg-white/[0.06]">
            {(['login', 'register', 'reset'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setMode(tab);
                  setErrorInfo(null);
                  setNotice(null);
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  mode === tab
                    ? 'crimson-metallic-active'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab === 'login' ? 'Sign In' : tab === 'register' ? 'Register' : 'Reset'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-white/75 dark:bg-slate-950/60 border border-black/10 dark:border-white/15 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/25"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                maxLength={160}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engineer@domain.com"
                className="w-full px-3 py-2 text-sm rounded-xl bg-white/75 dark:bg-slate-950/60 border border-black/10 dark:border-white/15 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/25"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-white/75 dark:bg-slate-950/60 border border-black/10 dark:border-white/15 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/25"
                />
              </div>
            )}

            {errorInfo && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                <div className="font-medium">{errorInfo.message}</div>
                {errorInfo.consoleHint && (
                  <div className="text-rose-600/90 dark:text-rose-300/80">{errorInfo.consoleHint}</div>
                )}
              </div>
            )}

            {notice && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-800 dark:text-emerald-300">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium crimson-metallic-btn disabled:opacity-50"
            >
              <Mail className="w-3.5 h-3.5" />
              {busy
                ? 'Authenticating…'
                : mode === 'login'
                  ? 'Sign In with Email'
                  : mode === 'register'
                    ? 'Create Account'
                    : 'Send Reset Link'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
