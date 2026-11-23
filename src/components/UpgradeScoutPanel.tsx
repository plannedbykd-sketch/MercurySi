import { useEffect, useState, type FormEvent } from 'react';
import { Clock, ExternalLink, Globe, RefreshCw } from 'lucide-react';
import { TOPOLOGY_NODES, type TopologyNode } from '../data/engineeringRecord';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface GroundingUpgradeResponse {
  summary: string;
  sources: GroundingSource[];
  searchQueries: string[];
  model: string;
  fetchedAt: string;
  cached?: boolean;
}

export interface GroundingNewsEntry extends GroundingUpgradeResponse {
  id: string;
  scopeLabel: string;
}

interface UpgradeScoutPanelProps {
  selectedNodeId: string;
  onSelectNodeId: (id: string) => void;
  result: GroundingUpgradeResponse | null;
  loading: boolean;
  error: string | null;
  missingEnvVar?: string | null;
  onRedirectToSecret?: (envVar: string) => void;
  onFetchUpgrades: (node: TopologyNode | null, customQuery: string) => Promise<void>;
  autoIntervalMs: number;
  onChangeAutoInterval: (ms: number) => void;
  nextSyncAt: number | null;
  digestLoading: boolean;
  digestPlaneLabel: string;
  newsFeed: GroundingNewsEntry[];
  onSyncDigestNow: (force?: boolean) => Promise<void>;
  onClearFocusedResult: () => void;
}

function isSafeHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function renderInlineCode(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-black/[0.06] dark:bg-white/[0.08] font-mono text-[11px] text-rose-800 dark:text-rose-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bp, bIdx) => {
      if (bp.startsWith('**') && bp.endsWith('**') && bp.length > 4) {
        return (
          <strong key={`${idx}-${bIdx}`} className="font-semibold text-slate-900 dark:text-slate-100">
            {bp.slice(2, -2)}
          </strong>
        );
      }
      return <span key={`${idx}-${bIdx}`}>{bp}</span>;
    });
  });
}

function renderFormattedBrief(markdown: string) {
  const lines = markdown.split('\n');
  return (
    <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return <div key={index} className="h-1" />;

        if (line.startsWith('### ')) {
          return (
            <h4
              key={index}
              className="text-xs font-semibold text-slate-900 dark:text-slate-100 pt-2"
            >
              {renderInlineCode(line.slice(4))}
            </h4>
          );
        }
        if (line.startsWith('## ') || line.startsWith('# ')) {
          const title = line.replace(/^#{1,3}\s+/, '');
          return (
            <h3
              key={index}
              className="text-sm font-semibold text-slate-900 dark:text-slate-100 pt-2"
            >
              {renderInlineCode(title)}
            </h3>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={index} className="flex items-start gap-2 pl-1">
              <span className="text-rose-600 dark:text-rose-400 mt-1 text-xs" aria-hidden="true">
                ·
              </span>
              <span className="flex-1">{renderInlineCode(line.slice(2))}</span>
            </div>
          );
        }
        return <p key={index}>{renderInlineCode(line)}</p>;
      })}
    </div>
  );
}

const CADENCE_OPTIONS: Array<{ label: string; ms: number }> = [
  { label: 'Manual', ms: 0 },
  { label: 'Every 2m', ms: 120_000 },
  { label: 'Every 5m', ms: 300_000 },
  { label: 'Every 15m', ms: 900_000 },
];

export function UpgradeScoutPanel({
  selectedNodeId,
  onSelectNodeId,
  result,
  loading,
  error,
  missingEnvVar,
  onRedirectToSecret,
  onFetchUpgrades,
  autoIntervalMs,
  onChangeAutoInterval,
  nextSyncAt,
  digestLoading,
  digestPlaneLabel,
  newsFeed,
  onSyncDigestNow,
  onClearFocusedResult,
}: UpgradeScoutPanelProps) {
  const [customQuery, setCustomQuery] = useState('');
  const [activeFeedIdx, setActiveFeedIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const selectedNode = TOPOLOGY_NODES.find((n) => n.id === selectedNodeId) ?? null;

  useEffect(() => {
    setActiveFeedIdx(0);
  }, [newsFeed.length]);

  useEffect(() => {
    if (!nextSyncAt || autoIntervalMs <= 0) {
      setSecondsLeft(null);
      return;
    }
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((nextSyncAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [nextSyncAt, autoIntervalMs]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onFetchUpgrades(selectedNode, customQuery);
  };

  // Prefer explicit component result if user ran a single-component lookup, or active periodic feed item
  const displayedEntry: (GroundingUpgradeResponse & { scopeLabel?: string }) | null =
    result ?? newsFeed[activeFeedIdx] ?? null;

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <section
      id="upgrade-scout-panel"
      className="apple-glass rounded-2xl p-5 space-y-5"
    >
      {/* Header + Periodic Sync Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-black/[0.08] dark:border-white/[0.1] pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Technology Upgrade News &amp; Grounding Scout
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Periodically fetches latest release notes, SDK upgrades, and security advisories for{' '}
            <strong className="text-slate-700 dark:text-slate-200">{digestPlaneLabel}</strong>{' '}
            architecture components via server-side Google Search grounding.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Periodic grounding refresh interval"
            className="flex items-center gap-1 p-1 rounded-xl bg-black/[0.05] dark:bg-white/[0.06]"
          >
            {CADENCE_OPTIONS.map((opt) => (
              <button
                key={opt.ms}
                type="button"
                onClick={() => onChangeAutoInterval(opt.ms)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap ${
                  autoIntervalMs === opt.ms
                    ? 'crimson-metallic-active'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {secondsLeft !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 px-1.5">
              <Clock className="w-3 h-3" />
              {formatCountdown(secondsLeft)}
            </span>
          )}

          <button
            type="button"
            onClick={() => void onSyncDigestNow(true)}
            disabled={digestLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/15 text-slate-800 dark:text-slate-100 hover:border-rose-500/40 disabled:opacity-55 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${digestLoading ? 'animate-spin' : ''}`} />
            {digestLoading ? 'Syncing News…' : 'Sync Digest Now'}
          </button>
        </div>
      </div>

      {/* Component-Specific Grounded Query Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
        <div className="lg:col-span-4">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Target LiquidOS Component
          </label>
          <select
            value={selectedNodeId}
            onChange={(e) => onSelectNodeId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white/75 dark:bg-slate-950/60 border border-black/10 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/25"
          >
            {TOPOLOGY_NODES.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-6">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Optional Focus Query
          </label>
          <input
            type="text"
            maxLength={300}
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder="e.g. Android NDK 16KB ELF alignment, SwiftPM XCFramework, LanceDB ANN"
            className="w-full px-3 py-2 text-xs bg-white/75 dark:bg-slate-950/60 border border-black/10 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/25"
          />
        </div>

        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium crimson-metallic-btn rounded-xl disabled:opacity-55 whitespace-nowrap"
          >
            <Globe className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Searching…' : 'Fetch Upgrades'}
          </button>
        </div>
      </form>

      {/* Recent Periodic News Feed Switcher */}
      {newsFeed.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Recent Briefings:
          </span>
          {newsFeed.map((entry, idx) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setActiveFeedIdx(idx);
                if (result) {
                  onClearFocusedResult();
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors ${
                !result && activeFeedIdx === idx
                  ? 'crimson-metallic-active'
                  : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.1]'
              }`}
            >
              {entry.scopeLabel} · {new Date(entry.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div>
            <div className="font-medium">Upgrade lookup failed</div>
            <div className="mt-0.5 opacity-90">{error}</div>
          </div>
          {missingEnvVar && onRedirectToSecret && (
            <button
              type="button"
              onClick={() => onRedirectToSecret(missingEnvVar)}
              className="px-3 py-1.5 text-[11px] font-medium rounded-lg crimson-metallic-btn whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              Go to {missingEnvVar} →
            </button>
          )}
        </div>
      )}

      {(loading || (digestLoading && !displayedEntry)) && (
        <div className="space-y-2.5 py-2" aria-live="polite">
          <div className="h-4 w-1/3 rounded bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
          <div className="h-3.5 w-full rounded bg-black/[0.05] dark:bg-white/[0.06] animate-pulse" />
          <div className="h-3.5 w-5/6 rounded bg-black/[0.05] dark:bg-white/[0.06] animate-pulse" />
          <div className="h-3.5 w-2/3 rounded bg-black/[0.05] dark:bg-white/[0.06] animate-pulse" />
        </div>
      )}

      {!(loading || (digestLoading && !displayedEntry)) && displayedEntry && (
        <div className="space-y-4 pt-3 border-t border-black/[0.08] dark:border-white/[0.1]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {result
                ? `Focused Component Briefing · ${selectedNode?.name ?? 'Custom Query'}`
                : `Periodic Architecture News · ${displayedEntry.scopeLabel ?? digestPlaneLabel}`}
            </span>
            <span className="font-mono">
              {displayedEntry.model} · {new Date(displayedEntry.fetchedAt).toLocaleTimeString()}
              {displayedEntry.cached ? ' (cached)' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-3">
              {renderFormattedBrief(displayedEntry.summary || 'No summary text returned.')}
            </div>

            <div className="lg:col-span-4 space-y-4">
              <div className="p-3.5 rounded-xl bg-white/55 dark:bg-black/25 border border-black/[0.08] dark:border-white/[0.1] space-y-2.5">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Grounded Web Sources ({displayedEntry.sources.length})
                </div>
                {displayedEntry.sources.length === 0 ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    No external web citations returned for this query.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {displayedEntry.sources
                      .filter((src) => isSafeHttpUrl(src.uri))
                      .map((src) => (
                        <li key={src.uri}>
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-start gap-1.5 text-xs text-rose-700 dark:text-rose-300 hover:underline break-words"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-75 group-hover:opacity-100" />
                            <span>{src.title}</span>
                          </a>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              {displayedEntry.searchQueries.length > 0 && (
                <div className="p-3.5 rounded-xl bg-white/55 dark:bg-black/25 border border-black/[0.08] dark:border-white/[0.1] space-y-1.5">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Search Queries Executed
                  </div>
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400 space-y-1">
                    {displayedEntry.searchQueries.map((q, idx) => (
                      <div key={idx} className="break-words">
                        · {q}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
