import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Download,
  FileCode2,
  GitBranch,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  UserCircle2,
  X,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AuthModal } from './components/AuthModal';
import { HonestyAuditView } from './components/HonestyAuditView';
import { HybridFilesView } from './components/HybridFilesView';
import { LedgerWgView } from './components/LedgerWgView';
import { LiquidCrimsonCanvas } from './components/LiquidCrimsonCanvas';
import { OverviewView } from './components/OverviewView';
import { ParValidatorView } from './components/ParValidatorView';
import { SecretsEnvView } from './components/SecretsEnvView';
import { UncensoredChatView } from './components/UncensoredChatView';
import { VisualizationsView } from './components/VisualizationsView';
import { useAuth } from './contexts/AuthContext';
import { useSecretsAlert, type AppTabKey } from './contexts/SecretsAlertContext';
import { useTheme, type ThemePreference } from './contexts/ThemeContext';
import { HYBRID_ARTIFACT_FILES } from './data/hybridFiles';

const NAV_ITEMS: Array<{ key: AppTabKey; label: string; breadcrumb: string; icon: typeof Layers }> = [
  { key: 'overview', label: 'Topology & Gaps', breadcrumb: 'Topology & Gaps', icon: Layers },
  { key: 'chat', label: 'AI Chat · Uncensored', breadcrumb: 'BYOK AI Chat & Uncensored-AI', icon: MessageSquare },
  { key: 'secrets', label: 'Secrets & Env', breadcrumb: 'Secrets & Env Keys', icon: KeyRound },
  { key: 'visualizations', label: 'Data Visualizations', breadcrumb: 'D3 · Chart.js · ECharts', icon: BarChart3 },
  { key: 'hybrid', label: 'Android / iOS Hybrid', breadcrumb: 'Hybrid FFI & Packaging', icon: FileCode2 },
  { key: 'par', label: 'PaR v1.0 Validator', breadcrumb: 'PaR v1.0 Validator', icon: ShieldCheck },
  { key: 'ledger', label: 'Ledger & WireGuard', breadcrumb: 'Ledger & WireGuard MTU', icon: Lock },
  { key: 'honesty', label: 'Honesty-First Audit', breadcrumb: 'Honesty-First Audit', icon: GitBranch },
];

const THEME_OPTIONS: Array<{ key: ThemePreference; label: string; icon: typeof Sun }> = [
  { key: 'system', label: 'System', icon: Monitor },
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTabKey>('overview');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [verificationMsg, setVerificationMsg] = useState<string | null>(null);

  const { theme, setTheme } = useTheme();
  const { user, profileSynced, resendVerificationEmail, refreshVerificationState, logout } = useAuth();
  const {
    activeAlert,
    missingRequiredCount,
    missingTotalCount,
    dismissAlert,
    redirectToSecret,
  } = useSecretsAlert();

  const currentNav = NAV_ITEMS.find((item) => item.key === activeTab) ?? NAV_ITEMS[0];

  const handleExportBundle = () => {
    const bundle = {
      exported_at: new Date().toISOString(),
      workspace: 'liquid-os-monorepo-hybrid',
      claim_state: 'PLANNED_HOST_COMPILATION',
      files: HYBRID_ARTIFACT_FILES.map((f) => ({
        path: f.path,
        target: f.target,
        content: f.content,
      })),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'liquid-os-hybrid-bundle.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResendVerification = async () => {
    await resendVerificationEmail();
    setVerificationMsg('Verification email sent. Check your inbox and click Check Status.');
  };

  const handleCheckVerification = async () => {
    const verified = await refreshVerificationState();
    setVerificationMsg(
      verified
        ? 'Email verified. Cloud profile preferences are now synced.'
        : 'Email not verified yet.'
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen apple-ambient-bg text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row">
        {/* Cross-fading Apple Ambient Radial Gradient Layers */}
        <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-0 apple-ambient-light" />
        <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-0 apple-ambient-dark" />

        {/* Real-time WebGL Liquid Crimson Metallic Canvas */}
        <LiquidCrimsonCanvas />

        {/* Frosted Crimson Metallic Sidebar */}
        <aside className="relative z-10 w-full lg:w-64 shrink-0 apple-glass lg:border-r lg:border-y-0 lg:border-l-0 border-b border-black/[0.08] dark:border-white/[0.1] flex flex-col">
          <div className="px-5 py-4 border-b border-black/[0.08] dark:border-white/[0.1]">
            <div className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
              LiquidOS Workbench
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hybrid FFI · PaR v1.0 · Ledger
            </div>
          </div>

          <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0 text-left ${
                    active
                      ? 'crimson-metallic-active'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.key === 'secrets' && missingTotalCount > 0 && (
                    <span
                      className={`text-[11px] font-mono tabular-nums ${
                        active
                          ? 'text-white/90'
                          : missingRequiredCount > 0
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {missingTotalCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Appearance Segmented Control */}
          <div className="px-4 py-3 border-t border-black/[0.08] dark:border-white/[0.1] lg:mt-auto space-y-3">
            <div>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                Appearance
              </div>
              <div
                role="group"
                aria-label="Theme preference"
                className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/[0.05] dark:bg-white/[0.06]"
              >
                {THEME_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = theme === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTheme(opt.key)}
                      aria-pressed={active}
                      className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'crimson-metallic-active'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hidden lg:block text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Native Rust, Android NDK, and Xcode toolchains run locally via scripts/.
            </div>
          </div>
        </aside>

        {/* Main Column */}
        <div className="relative z-10 flex-1 min-w-0 flex flex-col">
          <header className="apple-glass border-x-0 border-t-0 border-b border-black/[0.08] dark:border-white/[0.1] px-6 py-3.5 flex items-center justify-between gap-6">
            <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
              <span>LiquidOS</span>
              <span className="mx-2 text-rose-400/70">/</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {currentNav.breadcrumb}
              </span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleExportBundle}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl bg-white/80 dark:bg-white/10 text-slate-800 dark:text-slate-100 border border-black/10 dark:border-white/15 hover:bg-white dark:hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Export Bundle
              </button>

              {user ? (
                <div className="flex items-center gap-2 pl-2 border-l border-black/10 dark:border-white/15">
                  <div className="hidden sm:block text-right">
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100 max-w-[140px] truncate">
                      {user.displayName || user.email || 'Signed In'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {user.emailVerified
                        ? profileSynced
                          ? 'Synced'
                          : 'Verified'
                        : 'Unverified'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    title="Sign Out"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl crimson-metallic-btn whitespace-nowrap shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl crimson-metallic-btn whitespace-nowrap shrink-0"
                >
                  <UserCircle2 className="w-3.5 h-3.5" />
                  Sign In
                </button>
              )}
            </div>
          </header>

          {user && !user.emailVerified && (
            <div className="mx-6 mt-5 apple-glass rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-slate-700 dark:text-slate-300">
                Verify <span className="font-mono font-medium">{user.email}</span> to enable cloud
                preference syncing. {verificationMsg && <span className="ml-1 font-medium">{verificationMsg}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleResendVerification()}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/15 hover:bg-white dark:hover:bg-white/15"
                >
                  Resend Email
                </button>
                <button
                  type="button"
                  onClick={() => void handleCheckVerification()}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg crimson-metallic-btn"
                >
                  Check Status
                </button>
              </div>
            </div>
          )}

          {activeAlert && activeTab !== 'secrets' && (
            <div
              role="alert"
              className={`mx-6 mt-5 apple-glass rounded-xl px-4 py-3 border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                activeAlert.severity === 'error'
                  ? 'border-rose-500/40 bg-rose-500/[0.08]'
                  : 'border-amber-500/35 bg-amber-500/[0.07]'
              }`}
            >
              <div className="flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200">
                <AlertTriangle
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    activeAlert.severity === 'error'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                />
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Missing Server Secret:{' '}
                    <span className="font-mono">{activeAlert.envVar}</span>{' '}
                    <span className="font-normal text-slate-600 dark:text-slate-400">
                      ({activeAlert.sourceLabel})
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">{activeAlert.message}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() =>
                    redirectToSecret(activeAlert.envVar, setActiveTab, {
                      tab: activeAlert.returnTab,
                      providerId: activeAlert.returnProviderId,
                      label: activeAlert.sourceLabel,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg crimson-metallic-btn whitespace-nowrap"
                >
                  Go to {activeAlert.envVar}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={dismissAlert}
                  aria-label="Dismiss missing secret alert"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <main className="flex-1 p-6 lg:p-8 max-w-6xl w-full mx-auto">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeTab === 'overview' && <OverviewView onNavigate={setActiveTab} />}
                {activeTab === 'chat' && <UncensoredChatView onNavigate={setActiveTab} />}
                {activeTab === 'secrets' && <SecretsEnvView onNavigate={setActiveTab} />}
                {activeTab === 'visualizations' && <VisualizationsView />}
                {activeTab === 'hybrid' && <HybridFilesView />}
                {activeTab === 'par' && <ParValidatorView />}
                {activeTab === 'ledger' && <LedgerWgView />}
                {activeTab === 'honesty' && <HonestyAuditView />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    </MotionConfig>
  );
}
