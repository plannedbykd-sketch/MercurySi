import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  useSecretsAlert,
  type AppTabKey,
  type EnvSecretDescriptor,
} from '../contexts/SecretsAlertContext';

interface SecretsEnvViewProps {
  onNavigate: (tab: AppTabKey) => void;
}

type FilterMode = 'all' | 'missing' | 'configured' | 'byok';

export function SecretsEnvView({ onNavigate }: SecretsEnvViewProps) {
  const {
    envItems,
    envLoading,
    lastCheckedAt,
    missingRequiredCount,
    missingTotalCount,
    highlightedEnvVar,
    returnPipeline,
    refreshEnvStatus,
    clearHighlight,
    launchPipelineFromSecret,
  } = useSecretsAlert();

  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [copiedEnvVar, setCopiedEnvVar] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedEnvVar) return;
    // Ensure filtered view reveals the target secret card
    setFilterMode('all');

    const scrollTimer = window.setTimeout(() => {
      const target = document.getElementById(`secret-card-${highlightedEnvVar}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 90);

    const clearTimer = window.setTimeout(() => {
      clearHighlight();
    }, 4500);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightedEnvVar, clearHighlight]);

  const filteredItems = envItems.filter((item) => {
    if (filterMode === 'missing') return !item.configured;
    if (filterMode === 'configured') return item.configured;
    if (filterMode === 'byok') return item.category === 'Optional BYOK' || item.category === 'Local Runtime';
    return true;
  });

  const configuredCount = envItems.filter((item) => item.configured).length;

  const handleCopyDeclaration = async (item: EnvSecretDescriptor) => {
    try {
      await navigator.clipboard.writeText(item.exampleLine);
      setCopiedEnvVar(item.envVar);
      window.setTimeout(() => {
        setCopiedEnvVar((prev) => (prev === item.envVar ? null : prev));
      }, 1500);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-black/[0.08] dark:border-white/[0.1] pb-5">
        <div className="space-y-1.5 max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Secrets &amp; Server Environment Keys
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Inspects live server <span className="font-mono text-slate-900 dark:text-slate-100">process.env</span>{' '}
            readiness across AI Chat, Search Grounding, and Runtime pipelines. Secret values remain strictly
            server-side via <strong className="font-semibold">Settings &gt; Secrets</strong> and are never
            entered or stored in the browser.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshEnvStatus()}
          disabled={envLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium crimson-metallic-btn rounded-xl disabled:opacity-55 whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${envLoading ? 'animate-spin' : ''}`} />
          {envLoading ? 'Checking Server Env…' : 'Re-check Server Env'}
        </button>
      </div>

      {/* Redirect Return Pipeline Banner */}
      {returnPipeline && (
        <div className="apple-glass rounded-2xl p-4 border border-rose-500/35 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-slate-700 dark:text-slate-200 space-y-0.5">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              Redirected from {returnPipeline.label}
            </div>
            <div>
              {highlightedEnvVar ? (
                <>
                  Inspecting <span className="font-mono font-semibold text-rose-700 dark:text-rose-300">{highlightedEnvVar}</span>.
                  After configuring it in <strong className="font-semibold">Settings &gt; Secrets</strong>, click{' '}
                  <strong className="font-semibold">Re-check Server Env</strong> and return to your pipeline.
                </>
              ) : (
                <>Return to {returnPipeline.label} once your server secret is configured.</>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              launchPipelineFromSecret(
                {
                  id: 'return-pipeline',
                  label: returnPipeline.label,
                  tab: returnPipeline.tab,
                  providerId: returnPipeline.providerId,
                },
                onNavigate
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl crimson-metallic-btn whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            Return to {returnPipeline.label}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3-Column Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="apple-glass rounded-2xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Configured on Server
          </div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
            {configuredCount} / {envItems.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {lastCheckedAt ? `Checked ${new Date(lastCheckedAt).toLocaleTimeString()}` : 'Server env check'}
          </div>
        </div>

        <div className="apple-glass rounded-2xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Missing Required Core Keys
          </div>
          <div
            className={`mt-1 text-2xl font-semibold font-mono tabular-nums ${
              missingRequiredCount === 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {missingRequiredCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            GEMINI_API_KEY powers Search Grounding &amp; Gemini Chat
          </div>
        </div>

        <div className="apple-glass rounded-2xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Unconfigured Optional Slots
          </div>
          <div className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-400 font-mono tabular-nums">
            {missingTotalCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Add only the BYOK providers you intend to route
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-black/[0.05] dark:bg-white/[0.06] rounded-xl overflow-x-auto">
          {(
            [
              { key: 'all', label: `All Keys (${envItems.length})` },
              { key: 'missing', label: `Missing (${missingTotalCount})` },
              { key: 'configured', label: `Configured (${configuredCount})` },
              { key: 'byok', label: 'BYOK & Local' },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterMode(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                filterMode === f.key
                  ? 'crimson-metallic-active'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          Zero secret values leave the Express server
        </div>
      </div>

      {/* Secret & Env Key Pipeline Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredItems.map((item) => {
          const isHighlighted = highlightedEnvVar === item.envVar;
          return (
            <article
              key={item.envVar}
              id={`secret-card-${item.envVar}`}
              className={`apple-glass rounded-2xl p-5 space-y-4 transition-all duration-300 ${
                isHighlighted
                  ? 'ring-2 ring-rose-500 shadow-[0_0_28px_-4px_rgba(225,29,72,0.45)]'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <KeyRound className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <h2 className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">
                      {item.envVar}
                    </h2>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {item.label} · {item.category}
                  </div>
                </div>

                <div
                  className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold shrink-0 ${
                    item.configured
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : item.required
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {item.configured ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      CONFIGURED
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {item.required ? 'MISSING (REQUIRED)' : 'UNSET'}
                    </>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {item.description}
              </p>

              {/* Server Placement + .env.example snippet */}
              <div className="p-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] space-y-2">
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Where to set:</span>{' '}
                  {item.whereToSet}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-[11px] text-rose-800 dark:text-rose-300 truncate">
                    {item.exampleLine}
                  </code>
                  <button
                    type="button"
                    onClick={() => void handleCopyDeclaration(item)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/15 shrink-0"
                  >
                    {copiedEnvVar === item.envVar ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy Var
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Dependent Pipeline Redirect Actions */}
              <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Connected Pipelines:
                </span>
                <div className="flex flex-wrap gap-2">
                  {item.pipelines.map((pipeline) => (
                    <button
                      key={pipeline.id}
                      type="button"
                      onClick={() => launchPipelineFromSecret(pipeline, onNavigate)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/15 text-slate-800 dark:text-slate-100 hover:border-rose-500/40 transition-colors"
                    >
                      <span>{pipeline.label}</span>
                      <ArrowRight className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                    </button>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
