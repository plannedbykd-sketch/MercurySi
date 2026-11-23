import { useCallback, useEffect, useRef, useState } from 'react';
import { Globe, Search } from 'lucide-react';
import { GAP_REGISTER, TOPOLOGY_NODES, type GapItem, type TopologyNode } from '../data/engineeringRecord';
import { TopologyFlowVisualizer } from './TopologyFlowVisualizer';
import {
  UpgradeScoutPanel,
  type GroundingNewsEntry,
  type GroundingUpgradeResponse,
} from './UpgradeScoutPanel';
import { useSecretsAlert, type AppTabKey } from '../contexts/SecretsAlertContext';

interface OverviewViewProps {
  onNavigate: (tab: AppTabKey) => void;
}

export function OverviewView({ onNavigate }: OverviewViewProps) {
  const { triggerMissingSecretAlert, redirectToSecret } = useSecretsAlert();
  const [planeFilter, setPlaneFilter] = useState<'All' | TopologyNode['plane']>('All');
  const [gapFilter, setGapFilter] = useState<'All' | GapItem['remediationStatus']>('All');
  const [query, setQuery] = useState('');

  // Google Search Grounding state (focused + periodic digest)
  const [scoutNodeId, setScoutNodeId] = useState<string>(TOPOLOGY_NODES[0].id);
  const [groundingResult, setGroundingResult] = useState<GroundingUpgradeResponse | null>(null);
  const [groundingLoading, setGroundingLoading] = useState(false);
  const [groundingError, setGroundingError] = useState<string | null>(null);
  const [groundingMissingEnvVar, setGroundingMissingEnvVar] = useState<string | null>(null);

  const [autoIntervalMs, setAutoIntervalMs] = useState<number>(300_000);
  const [nextSyncAt, setNextSyncAt] = useState<number | null>(null);
  const [digestLoading, setDigestLoading] = useState<boolean>(false);
  const [newsFeed, setNewsFeed] = useState<GroundingNewsEntry[]>([]);

  const planeFilterRef = useRef(planeFilter);
  planeFilterRef.current = planeFilter;

  const handleSyncDigest = useCallback(
    async (force = false) => {
      const activePlane = planeFilterRef.current;
      setDigestLoading(true);
      setGroundingError(null);
      setGroundingMissingEnvVar(null);

      const scopedNodes =
        activePlane === 'All'
          ? TOPOLOGY_NODES
          : TOPOLOGY_NODES.filter((n) => n.plane === activePlane);

      try {
        const response = await fetch('/api/grounding/digest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plane: activePlane,
            force,
            components: scopedNodes.map((n) => `${n.name} (${n.keyModules.slice(0, 3).join(', ')})`),
          }),
        });

        const data = (await response.json()) as Partial<GroundingUpgradeResponse> & {
          error?: string;
          envVar?: string;
        };

        if (!response.ok) {
          if (data.envVar) {
            setGroundingMissingEnvVar(data.envVar);
            triggerMissingSecretAlert({
              envVar: data.envVar,
              sourceLabel: 'Overview · Periodic Grounding News',
              message: data.error,
              severity: 'error',
              returnTab: 'overview',
            });
          }
          throw new Error(data.error || `Digest request failed with status ${response.status}`);
        }

        const entry: GroundingNewsEntry = {
          id: `${activePlane}-${Date.now()}`,
          scopeLabel: activePlane === 'All' ? 'All Planes' : activePlane,
          summary: data.summary ?? '',
          sources: Array.isArray(data.sources) ? data.sources : [],
          searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
          model: data.model ?? 'gemini-4-hydrogen',
          fetchedAt: data.fetchedAt ?? new Date().toISOString(),
          cached: Boolean(data.cached),
        };

        setNewsFeed((prev) => [entry, ...prev].slice(0, 5));
        if (force) {
          setGroundingResult(null);
        }
      } catch (err) {
        setGroundingError(
          err instanceof Error ? err.message : 'Unable to fetch periodic grounding digest.'
        );
      } finally {
        setDigestLoading(false);
      }
    },
    [triggerMissingSecretAlert]
  );

  // Initial fetch on mount + periodic background schedule
  useEffect(() => {
    void handleSyncDigest(false);
  }, [handleSyncDigest]);

  useEffect(() => {
    if (autoIntervalMs <= 0) {
      setNextSyncAt(null);
      return;
    }

    setNextSyncAt(Date.now() + autoIntervalMs);
    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        void handleSyncDigest(true);
      }
      setNextSyncAt(Date.now() + autoIntervalMs);
    }, autoIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoIntervalMs, handleSyncDigest]);

  const handleFetchUpgrades = async (node: TopologyNode | null, customQuery: string) => {
    setGroundingLoading(true);
    setGroundingError(null);
    setGroundingMissingEnvVar(null);
    try {
      const response = await fetch('/api/grounding/upgrades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentName: node?.name ?? '',
          endpointOrTarget: node?.endpointOrTarget ?? '',
          keyModules: node?.keyModules ?? [],
          customQuery,
        }),
      });
      const data = (await response.json()) as Partial<GroundingUpgradeResponse> & {
        error?: string;
        envVar?: string;
      };
      if (!response.ok) {
        if (data.envVar) {
          setGroundingMissingEnvVar(data.envVar);
          triggerMissingSecretAlert({
            envVar: data.envVar,
            sourceLabel: 'Topology · Google Search Upgrade Scout',
            message: data.error,
            severity: 'error',
            returnTab: 'overview',
          });
        }
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }
      setGroundingResult({
        summary: data.summary ?? '',
        sources: Array.isArray(data.sources) ? data.sources : [],
        searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
        model: data.model ?? 'gemini-4-hydrogen',
        fetchedAt: data.fetchedAt ?? new Date().toISOString(),
      });
    } catch (err) {
      setGroundingError(err instanceof Error ? err.message : 'Unable to fetch grounded upgrades.');
    } finally {
      setGroundingLoading(false);
    }
  };

  const handleRowCheckUpgrades = (node: TopologyNode) => {
    setScoutNodeId(node.id);
    const el = document.getElementById('upgrade-scout-panel');
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    void handleFetchUpgrades(node, '');
  };

  const filteredNodes = TOPOLOGY_NODES.filter((node) => {
    const matchesPlane = planeFilter === 'All' || node.plane === planeFilter;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      node.name.toLowerCase().includes(q) ||
      node.endpointOrTarget.toLowerCase().includes(q) ||
      node.keyModules.some((m) => m.toLowerCase().includes(q));
    return matchesPlane && matchesQuery;
  });

  const filteredGaps = GAP_REGISTER.filter((gap) => {
    const matchesStatus = gapFilter === 'All' || gap.remediationStatus === gapFilter;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      gap.title.toLowerCase().includes(q) ||
      gap.detail.toLowerCase().includes(q) ||
      gap.actionSummary.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const resolvedCount = GAP_REGISTER.filter((g) => g.remediationStatus === 'Resolved in Hybrid Core').length;
  const patchCount = GAP_REGISTER.filter((g) => g.remediationStatus === 'Patch Specified').length;
  const hostPendingCount = GAP_REGISTER.filter((g) => g.remediationStatus === 'Pending Host Execution').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-black/[0.08] dark:border-white/[0.1] pb-6">
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            LiquidOS Hybrid Engineering Record &amp; Recovery
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Unified Rust FFI kernel (<span className="font-mono text-slate-900 dark:text-slate-100">crates/liquid_ffi</span>),
            Android <span className="font-mono text-slate-900 dark:text-slate-100">.aar</span> / <span className="font-mono text-slate-900 dark:text-slate-100">.aab</span> packaging,
            iOS <span className="font-mono text-slate-900 dark:text-slate-100">XCFramework</span> SwiftPM wrapper, and deterministic verification tools.
          </p>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter modules, sockets, or gaps"
            className="w-full pl-9 pr-3 py-2 text-sm apple-glass rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/25"
          />
        </div>
      </div>

      {/* 4-column summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="apple-glass rounded-2xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Topology Nodes</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {TOPOLOGY_NODES.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">3 execution planes</div>
        </div>
        <div className="apple-glass rounded-2xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Resolved in Hybrid Core</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
            {resolvedCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Gaps #3, #5, #6, #11</div>
        </div>
        <div className="apple-glass rounded-2xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Monorepo Patches Specified</div>
          <div className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-400 font-mono tabular-nums">
            {patchCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Gaps #4, #7, #8, #9, #10</div>
        </div>
        <div className="apple-glass rounded-2xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Local Host Build</div>
          <div className="mt-1 text-2xl font-semibold text-rose-700 dark:text-rose-400 font-mono tabular-nums">
            {hostPendingCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cargo / NDK / Xcode</div>
        </div>
      </div>

      {/* Interactive 3-Plane Liquid Crimson Architecture Visualizer */}
      <TopologyFlowVisualizer selectedPlane={planeFilter} onSelectPlane={setPlaneFilter} />

      {/* Google Search Grounding Upgrade Scout */}
      <UpgradeScoutPanel
        selectedNodeId={scoutNodeId}
        onSelectNodeId={setScoutNodeId}
        result={groundingResult}
        loading={groundingLoading}
        error={groundingError}
        missingEnvVar={groundingMissingEnvVar}
        onRedirectToSecret={(envVar) =>
          redirectToSecret(envVar, onNavigate, {
            tab: 'overview',
            label: 'Topology · Upgrade Scout',
          })
        }
        onFetchUpgrades={handleFetchUpgrades}
        autoIntervalMs={autoIntervalMs}
        onChangeAutoInterval={setAutoIntervalMs}
        nextSyncAt={nextSyncAt}
        digestLoading={digestLoading}
        digestPlaneLabel={planeFilter === 'All' ? 'All LiquidOS Planes' : `${planeFilter} Plane`}
        newsFeed={newsFeed}
        onSyncDigestNow={(force) => handleSyncDigest(force)}
        onClearFocusedResult={() => setGroundingResult(null)}
      />

      {/* System Topology Table */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              01. Master System Topology
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Client planes, loopback IPC endpoints, and deterministic enclave substrates.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-black/[0.05] dark:bg-white/[0.06] rounded-xl self-start">
            {(['All', 'Client & Mobile', 'Control & Proxy', 'Kernel & Enclave'] as const).map((plane) => (
              <button
                key={plane}
                type="button"
                onClick={() => setPlaneFilter(plane)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  planeFilter === plane
                    ? 'crimson-metallic-active'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {plane}
              </button>
            ))}
          </div>
        </div>

        <div className="apple-glass rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.08] dark:border-white/[0.1] text-xs font-medium text-slate-500 dark:text-slate-400 bg-black/[0.02] dark:bg-white/[0.02]">
                <th className="py-2.5 px-4">Plane</th>
                <th className="py-2.5 px-4">Subsystem</th>
                <th className="py-2.5 px-4">Endpoint / Target</th>
                <th className="py-2.5 px-4">Modules &amp; Notes</th>
                <th className="py-2.5 px-4 text-right">Upgrades</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.08] text-sm">
              {filteredNodes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                    No topology nodes match the active filter.
                  </td>
                </tr>
              ) : (
                filteredNodes.map((node) => (
                  <tr key={node.id} className="hover:bg-black/[0.025] dark:hover:bg-white/[0.03] align-top">
                    <td className="py-3 px-4 text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {node.plane}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{node.name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-rose-700 dark:text-rose-300 whitespace-nowrap">
                      {node.endpointOrTarget}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs font-mono text-slate-700 dark:text-slate-300">
                        {node.keyModules.join(' · ')}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{node.notes}</div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleRowCheckUpgrades(node)}
                        disabled={groundingLoading && scoutNodeId === node.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/15 text-slate-800 dark:text-slate-100 hover:border-rose-500/40 dark:hover:border-rose-400/40 transition-colors disabled:opacity-50"
                      >
                        <Globe className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        Check Upgrades
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gap & Blocker Register */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              02. Gap &amp; Defect Register
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              All 12 documented workspace defects mapped to hybrid FFI fixes or pending host actions.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-black/[0.05] dark:bg-white/[0.06] rounded-xl self-start overflow-x-auto max-w-full">
            {(['All', 'Resolved in Hybrid Core', 'Patch Specified', 'Pending Host Execution'] as const).map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setGapFilter(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    gapFilter === status
                      ? 'crimson-metallic-active'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {status}
                </button>
              )
            )}
          </div>
        </div>

        <div className="apple-glass rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.08] dark:border-white/[0.1] text-xs font-medium text-slate-500 dark:text-slate-400 bg-black/[0.02] dark:bg-white/[0.02]">
                <th className="py-2.5 px-4 w-14">ID</th>
                <th className="py-2.5 px-4">Defect / Blocker</th>
                <th className="py-2.5 px-4">State</th>
                <th className="py-2.5 px-4">Remediation Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.08] text-sm">
              {filteredGaps.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                    No gap items match the active filter.
                  </td>
                </tr>
              ) : (
                filteredGaps.map((gap) => (
                  <tr key={gap.id} className="hover:bg-black/[0.025] dark:hover:bg-white/[0.03] align-top">
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      #{gap.id.toString().padStart(2, '0')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{gap.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {gap.category} · {gap.detail}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs font-medium">
                      <span
                        className={
                          gap.remediationStatus === 'Resolved in Hybrid Core'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : gap.remediationStatus === 'Patch Specified'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-rose-700 dark:text-rose-400'
                        }
                      >
                        {gap.remediationStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                      <div>{gap.actionSummary}</div>
                      {gap.remediationStatus === 'Resolved in Hybrid Core' && (
                        <button
                          type="button"
                          onClick={() => onNavigate('hybrid')}
                          className="mt-1.5 text-xs font-medium text-rose-700 dark:text-rose-300 underline underline-offset-2 hover:opacity-75"
                        >
                          Inspect hybrid artifacts
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
