import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eraser,
  FlaskConical,
  GitFork,
  Layers,
  MessageSquare,
  Send,
  SlidersHorizontal,
  Square,
} from 'lucide-react';
import { useSecretsAlert, type AppTabKey } from '../contexts/SecretsAlertContext';
import {
  CHAIN_OF_THOUGHT_SKIPS,
  HERETIC_MODULES,
  HERETIC_PROFILES,
  HERETIC_TEST_SUITES,
  type HereticConfigProfile,
  type QuantizationMethod,
  type RowNormalization,
} from '../data/hereticProfiles';
import {
  buildHereticCliCommand,
  computeAbliterationObjective,
  evaluateHereticResponse,
  generateHereticToml,
} from '../lib/hereticEngine';
import { sha256Hex } from '../lib/parValidator';

type SubTab = 'chat' | 'studio' | 'repo';

interface ProviderModelOption {
  id: string;
  label: string;
  note: string;
}

interface ChatProviderDescriptor {
  id: string;
  label: string;
  envVar: string;
  configured: boolean;
  defaultModel: string;
  models: ProviderModelOption[];
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  providerLabel?: string;
  model?: string;
  createdAt: string;
  sha256Digest?: string;
  streaming?: boolean;
}

function isSafeHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function renderInlineFormatted(text: string) {
  const codeParts = text.split(/(`[^`]+`)/g);
  return codeParts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-black/[0.06] dark:bg-white/[0.09] font-mono text-[11px] text-rose-800 dark:text-rose-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Parse [label](https://...) safely without dangerouslySetInnerHTML
    const linkParts = part.split(/(\[[^\]]+\]\([^)]+\))/g);
    return linkParts.map((lp, lIdx) => {
      const linkMatch = lp.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        if (isSafeHttpUrl(href)) {
          return (
            <a
              key={`${idx}-${lIdx}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-rose-500/60 hover:text-rose-700 dark:hover:text-rose-300"
            >
              {label}
            </a>
          );
        }
        return <span key={`${idx}-${lIdx}`}>{label}</span>;
      }

      const boldParts = lp.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bp, bIdx) => {
        if (bp.startsWith('**') && bp.endsWith('**') && bp.length > 4) {
          return (
            <strong
              key={`${idx}-${lIdx}-${bIdx}`}
              className="font-semibold text-slate-900 dark:text-slate-100"
            >
              {bp.slice(2, -2)}
            </strong>
          );
        }
        return <span key={`${idx}-${lIdx}-${bIdx}`}>{bp}</span>;
      });
    });
  });
}

function SafeMarkdownBlock({ content }: { content: string }) {
  const segments = content.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-2 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
      {segments.map((seg, sIdx) => {
        if (seg.startsWith('```') && seg.endsWith('```')) {
          const inner = seg.slice(3, -3);
          const firstNewline = inner.indexOf('\n');
          const lang = firstNewline !== -1 ? inner.slice(0, firstNewline).trim() : '';
          const codeBody = firstNewline !== -1 ? inner.slice(firstNewline + 1) : inner;
          return (
            <pre
              key={sIdx}
              className="p-3 rounded-xl bg-slate-950/90 text-slate-100 font-mono text-xs overflow-x-auto border border-white/10"
            >
              {lang && (
                <div className="text-[10px] uppercase tracking-wider text-rose-300/80 mb-1.5">
                  {lang}
                </div>
              )}
              <code>{codeBody}</code>
            </pre>
          );
        }

        const lines = seg.split('\n');
        return (
          <div key={sIdx} className="space-y-1.5">
            {lines.map((rawLine, lIdx) => {
              const line = rawLine.trim();
              if (!line) return <div key={lIdx} className="h-1" />;
              if (line.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="text-xs font-semibold text-slate-900 dark:text-slate-100 pt-1">
                    {renderInlineFormatted(line.slice(4))}
                  </h4>
                );
              }
              if (line.startsWith('## ') || line.startsWith('# ')) {
                return (
                  <h3 key={lIdx} className="text-sm font-semibold text-slate-900 dark:text-slate-100 pt-1">
                    {renderInlineFormatted(line.replace(/^#{1,3}\s+/, ''))}
                  </h3>
                );
              }
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1">
                    <span className="text-rose-600 dark:text-rose-400 mt-0.5 text-xs" aria-hidden="true">
                      ·
                    </span>
                    <span className="flex-1">{renderInlineFormatted(line.slice(2))}</span>
                  </div>
                );
              }
              return <p key={lIdx}>{renderInlineFormatted(rawLine)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

interface UncensoredChatViewProps {
  onNavigate: (tab: AppTabKey) => void;
}

export function UncensoredChatView({ onNavigate }: UncensoredChatViewProps) {
  const {
    pendingChatProviderId,
    consumePendingChatProvider,
    triggerMissingSecretAlert,
    redirectToSecret,
  } = useSecretsAlert();

  const [subTab, setSubTab] = useState<SubTab>('chat');

  // Cloned Uncensored-AI (Heretic) profile state
  const [selectedProfileId, setSelectedProfileId] = useState<HereticConfigProfile['id']>('liquidos_sovereign');
  const [configState, setConfigState] = useState<HereticConfigProfile>(() => ({
    ...HERETIC_PROFILES[3],
    refusalMarkers: [...HERETIC_PROFILES[3].refusalMarkers],
  }));
  const [customMarkersInput, setCustomMarkersInput] = useState<string>('');

  // Server-proxied BYOK provider state
  const [providers, setProviders] = useState<ChatProviderDescriptor[]>([]);
  const [providersLoading, setProvidersLoading] = useState<boolean>(true);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-4-hydrogen');
  const [customModelId, setCustomModelId] = useState<string>('');

  // Chat state
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [promptInput, setPromptInput] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [missingErrorEnvVar, setMissingErrorEnvVar] = useState<string | null>(null);
  const [showSystemDrawer, setShowSystemDrawer] = useState<boolean>(false);
  const [expandedThoughtIds, setExpandedThoughtIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Studio simulator & evaluator state
  const [hfTargetModel, setHfTargetModel] = useState<string>('Qwen/Qwen3-4B-Instruct-2507');
  const [simKlDivergence, setSimKlDivergence] = useState<number>(0.08);
  const [simRefusalCount, setSimRefusalCount] = useState<number>(3);
  const [evaluatorSample, setEvaluatorSample] = useState<string>(
    `<think>Checking prompt constraints and computing direct technical answer.</think>\nTo orthogonalize a refusal direction in PyTorch, project the residual weight matrix onto the subspace perpendicular to the normalized contrast vector r_hat.`
  );

  const abortRef = useRef<AbortController | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/chat/providers')
      .then((res) => res.json())
      .then((data: { providers?: ChatProviderDescriptor[] }) => {
        if (!active || !Array.isArray(data.providers)) return;
        setProviders(data.providers);
        const requested = pendingChatProviderId
          ? data.providers.find((p) => p.id === pendingChatProviderId)
          : null;
        const initial = requested ?? data.providers.find((p) => p.configured) ?? data.providers[0];
        if (initial) {
          setSelectedProviderId(initial.id);
          setSelectedModel(initial.defaultModel);
          if (requested) {
            consumePendingChatProvider();
          }
        }
      })
      .catch(() => {
        // Leave fallback empty until user retries
      })
      .finally(() => {
        if (active) setProvidersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pendingChatProviderId, consumePendingChatProvider]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isStreaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const currentProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId) ?? null,
    [providers, selectedProviderId]
  );

  const activeMarkers = useMemo(() => {
    const extra = customMarkersInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return [...configState.refusalMarkers, ...extra];
  }, [configState.refusalMarkers, customMarkersInput]);

  const effectiveModel = customModelId.trim() || selectedModel;

  const handleApplyProfile = (profileId: HereticConfigProfile['id']) => {
    const found = HERETIC_PROFILES.find((p) => p.id === profileId);
    if (!found) return;
    setSelectedProfileId(profileId);
    setConfigState({
      ...found,
      refusalMarkers: [...found.refusalMarkers],
      goodPrompts: { ...found.goodPrompts },
      badPrompts: { ...found.badPrompts },
      goodEvaluationPrompts: { ...found.goodEvaluationPrompts },
      badEvaluationPrompts: { ...found.badEvaluationPrompts },
    });
  };

  const handleProviderChange = (nextId: string) => {
    setSelectedProviderId(nextId);
    setCustomModelId('');
    setChatError(null);
    setMissingErrorEnvVar(null);
    const nextProvider = providers.find((p) => p.id === nextId);
    if (nextProvider) {
      setSelectedModel(nextProvider.defaultModel);
      if (!nextProvider.configured) {
        triggerMissingSecretAlert({
          envVar: nextProvider.envVar,
          sourceLabel: `AI Chat · ${nextProvider.label}`,
          message: `${nextProvider.envVar} is not yet set on the server for ${nextProvider.label}. Redirect to Secrets & Env Keys to inspect placement details.`,
          severity: 'warning',
          returnTab: 'chat',
          returnProviderId: nextProvider.id,
        });
      }
    }
  };

  const handleStopStreaming = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    );
  };

  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = promptInput.trim();
    if (!trimmed || isStreaming) return;

    setChatError(null);
    setMissingErrorEnvVar(null);
    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const assistantId = `assistant-${Date.now() + 1}`;
    const assistantPlaceholder: ChatTurn = {
      id: assistantId,
      role: 'assistant',
      content: '',
      providerLabel: currentProvider?.label ?? selectedProviderId,
      model: effectiveModel,
      createdAt: new Date().toISOString(),
      streaming: true,
    };

    const nextHistory = [...messages, userTurn];
    setMessages([...nextHistory, assistantPlaceholder]);
    setPromptInput('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulatedText = '';

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProviderId,
          model: effectiveModel,
          systemPrompt: configState.systemPrompt,
          messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errPayload = (await response.json().catch(() => ({}))) as {
          error?: string;
          envVar?: string;
        };
        if (errPayload.envVar) {
          setMissingErrorEnvVar(errPayload.envVar);
          triggerMissingSecretAlert({
            envVar: errPayload.envVar,
            sourceLabel: `AI Chat · ${currentProvider?.label ?? selectedProviderId}`,
            message: errPayload.error,
            severity: 'error',
            returnTab: 'chat',
            returnProviderId: selectedProviderId,
          });
        }
        throw new Error(
          errPayload.error || `Chat request failed with HTTP ${response.status}.`
        );
      }

      if (!response.body) {
        throw new Error('Server response stream was empty.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith('data:')) continue;
          const rawJson = line.slice(5).trim();
          if (!rawJson) continue;

          try {
            const event = JSON.parse(rawJson) as {
              type?: string;
              text?: string;
              error?: string;
            };
            if (event.type === 'delta' && typeof event.text === 'string') {
              accumulatedText += event.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: accumulatedText } : m
                )
              );
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Upstream inference error.');
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
              if (!(parseErr instanceof SyntaxError)) {
                throw parseErr;
              }
            }
          }
        }
      }

      const digest = accumulatedText
        ? await sha256Hex(new TextEncoder().encode(accumulatedText)).catch(() => undefined)
        : undefined;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: accumulatedText, streaming: false, sha256Digest: digest }
            : m
        )
      );
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        const digest = accumulatedText
          ? await sha256Hex(new TextEncoder().encode(accumulatedText)).catch(() => undefined)
          : undefined;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: accumulatedText, streaming: false, sha256Digest: digest }
              : m
          )
        );
      } else {
        const errMsg = err instanceof Error ? err.message : 'Chat stream failed.';
        setChatError(errMsg);
        // Remove empty failed placeholder cleanly
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && !m.content.trim()))
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handlePromptKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1600);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleExportTranscript = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      source_repo: 'https://github.com/0xSojalSec/Uncensored-AI',
      provider: selectedProviderId,
      model: effectiveModel,
      profile_id: configState.id,
      system_prompt: configState.systemPrompt,
      turns: messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        sha256Digest: m.sha256Digest ?? null,
        evaluation:
          m.role === 'assistant'
            ? evaluateHereticResponse(m.content, activeMarkers, CHAIN_OF_THOUGHT_SKIPS)
            : null,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liquidos-uncensored-chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generatedToml = useMemo(() => generateHereticToml(configState), [configState]);
  const generatedCli = useMemo(
    () => buildHereticCliCommand(hfTargetModel, configState),
    [hfTargetModel, configState]
  );
  const simObjective = useMemo(
    () =>
      computeAbliterationObjective(
        simKlDivergence,
        simRefusalCount,
        100,
        configState.klDivergenceScale,
        configState.klDivergenceTarget
      ),
    [simKlDivergence, simRefusalCount, configState.klDivergenceScale, configState.klDivergenceTarget]
  );
  const liveEvalResult = useMemo(
    () => evaluateHereticResponse(evaluatorSample, activeMarkers, CHAIN_OF_THOUGHT_SKIPS),
    [evaluatorSample, activeMarkers]
  );

  const handleDownloadToml = () => {
    const blob = new Blob([generatedToml], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.toml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header + Mode Switcher */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-black/[0.08] dark:border-white/[0.1] pb-5">
        <div className="space-y-1.5 max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            AI Chat &amp; Uncensored-AI Workbench
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Server-proxied BYOK multi-provider streaming chat paired with a TypeScript remake of{' '}
            <span className="font-mono text-slate-900 dark:text-slate-100">0xSojalSec/Uncensored-AI</span>{' '}
            (Heretic CoT stripping, refusal/slop auditing, and TOML abliteration studio).
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-black/[0.05] dark:bg-white/[0.06] rounded-xl self-start lg:self-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setSubTab('chat')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              subTab === 'chat'
                ? 'crimson-metallic-active'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            BYOK AI Chat
          </button>
          <button
            type="button"
            onClick={() => setSubTab('studio')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              subTab === 'studio'
                ? 'crimson-metallic-active'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Abliteration Studio
          </button>
          <button
            type="button"
            onClick={() => setSubTab('repo')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              subTab === 'repo'
                ? 'crimson-metallic-active'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            Cloned Repo Matrix
          </button>
        </div>
      </div>

      {/* TAB 1: SERVER-PROXIED BYOK STREAMING CHAT */}
      {subTab === 'chat' && (
        <div className="space-y-4">
          {/* Control Strip */}
          <section className="apple-glass rounded-2xl p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {/* Server BYOK Provider */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Server BYOK Provider (Settings &gt; Secrets)
                </label>
                <select
                  value={selectedProviderId}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-white/80 dark:bg-slate-950/70 border border-black/10 dark:border-white/15 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                >
                  {providersLoading ? (
                    <option value="gemini">Loading providers…</option>
                  ) : (
                    providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} {p.configured ? '· Ready' : `· Set ${p.envVar}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Model Preset */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Model Preset
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    setCustomModelId('');
                  }}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white/80 dark:bg-slate-950/70 border border-black/10 dark:border-white/15 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                >
                  {(currentProvider?.models ?? [{ id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', note: '' }]).map(
                    (m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} ({m.id})
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Optional Custom Model Override (disabled for fixed Gemini list) */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Custom Model ID (OpenRouter / HF / Ollama)
                </label>
                <input
                  type="text"
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  disabled={selectedProviderId === 'gemini'}
                  placeholder={
                    selectedProviderId === 'gemini'
                      ? 'Fixed to Gemini preset'
                      : 'e.g. Qwen/Qwen3-4B-Instruct-2507'
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white/80 dark:bg-slate-950/70 border border-black/10 dark:border-white/15 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                />
              </div>

              {/* Heretic Profile & Marker Evaluator */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Uncensored-AI Audit Profile
                </label>
                <select
                  value={selectedProfileId}
                  onChange={(e) =>
                    handleApplyProfile(e.target.value as HereticConfigProfile['id'])
                  }
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-white/80 dark:bg-slate-950/70 border border-black/10 dark:border-white/15 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                >
                  {HERETIC_PROFILES.map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {prof.label} ({prof.refusalMarkers.length} markers)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Provider readiness & System Prompt Drawer Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-black/[0.06] dark:border-white/[0.08] text-xs">
              <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
                {currentProvider && (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span>
                      Server secret{' '}
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {currentProvider.envVar}
                      </span>
                      :{' '}
                      <strong
                        className={
                          currentProvider.configured
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }
                      >
                        {currentProvider.configured
                          ? 'Configured on server'
                          : 'Unset — add in Settings > Secrets'}
                      </strong>
                    </span>
                    {!currentProvider.configured && (
                      <button
                        type="button"
                        onClick={() =>
                          redirectToSecret(currentProvider.envVar, onNavigate, {
                            tab: 'chat',
                            providerId: currentProvider.id,
                            label: `AI Chat · ${currentProvider.label}`,
                          })
                        }
                        className="px-2 py-0.5 text-[11px] font-medium rounded-lg crimson-metallic-btn"
                      >
                        Go to {currentProvider.envVar} →
                      </button>
                    )}
                  </span>
                )}
                <span className="text-slate-400">·</span>
                <span>
                  Active markers:{' '}
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {activeMarkers.length}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSystemDrawer((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-white/[0.07] border border-black/10 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-white/10"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  System Prompt &amp; Markers
                </button>
                {messages.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleExportTranscript}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-white/[0.07] border border-black/10 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-white/10"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessages([])}
                      disabled={isStreaming}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-white/[0.07] border border-black/10 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-white/10 disabled:opacity-50"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            {showSystemDrawer && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    System Instruction ({configState.sourceFile})
                  </label>
                  <textarea
                    rows={3}
                    value={configState.systemPrompt}
                    onChange={(e) =>
                      setConfigState((prev) => ({ ...prev, systemPrompt: e.target.value }))
                    }
                    className="w-full p-2.5 text-xs font-mono rounded-xl bg-white/80 dark:bg-slate-950/70 border border-black/10 dark:border-white/15 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Extra Custom Audit Markers (comma-separated)
                  </label>
                  <textarea
                    rows={3}
                    value={customMarkersInput}
                    onChange={(e) => setCustomMarkersInput(e.target.value)}
                    placeholder="e.g. policy prohibits, safety guidelines, cannot fulfill"
                    className="w-full p-2.5 text-xs font-mono rounded-xl bg-white/80 dark:bg-slate-950/70 border border-black/10 dark:border-white/15 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Chat Transcript Area */}
          <section className="apple-glass rounded-2xl flex flex-col min-h-[420px] max-h-[62vh]">
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {messages.length === 0 ? (
                <div className="py-12 text-center max-w-xl mx-auto space-y-3">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    LiquidOS × Uncensored-AI Streaming Session
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Messages stream through <span className="font-mono">/api/chat/stream</span> using
                    server-managed secrets. Every assistant turn is automatically processed through
                    Heretic&apos;s <span className="font-mono">chain_of_thought_skips</span> stripper,{' '}
                    <span className="font-mono">refusal_markers</span> evaluator, and WebCrypto SHA-256
                    digesting.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    {[
                      'Explain directional orthogonalization of refusal vectors in transformers.',
                      'Compare LiquidOS PaR v1.0 drift gating with Heretic KL divergence limits.',
                      'Write a minimal Rust AF_UNIX SO_PEERCRED credential check example.',
                    ].map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => setPromptInput(starter)}
                        className="px-3 py-1.5 text-xs text-left rounded-xl bg-white/75 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-rose-500/40 transition-colors"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((turn) => {
                  const isUser = turn.role === 'user';
                  const evaluation = !isUser
                    ? evaluateHereticResponse(turn.content, activeMarkers, CHAIN_OF_THOUGHT_SKIPS)
                    : null;
                  const thoughtOpen = Boolean(expandedThoughtIds[turn.id]);

                  return (
                    <div
                      key={turn.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[90%] lg:max-w-[82%] rounded-2xl px-4 py-3 space-y-2.5 ${
                          isUser
                            ? 'crimson-metallic-active border border-rose-500/30'
                            : 'bg-white/80 dark:bg-slate-950/75 border border-black/10 dark:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 text-[11px] opacity-80">
                          <span className="font-mono font-semibold">
                            {isUser
                              ? 'OPERATOR'
                              : `${turn.providerLabel ?? 'MODEL'} · ${turn.model ?? effectiveModel}`}
                          </span>
                          {!isUser && !turn.streaming && turn.content && (
                            <button
                              type="button"
                              onClick={() => void handleCopyText(turn.id, evaluation?.visibleResponse || turn.content)}
                              className="inline-flex items-center gap-1 hover:text-rose-600 dark:hover:text-rose-300"
                            >
                              {copiedId === turn.id ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  Copy
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {isUser ? (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{turn.content}</p>
                        ) : (
                          <>
                            {evaluation?.thoughtTrace && (
                              <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedThoughtIds((prev) => ({
                                      ...prev,
                                      [turn.id]: !prev[turn.id],
                                    }))
                                  }
                                  className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                                >
                                  <span className="inline-flex items-center gap-1.5">
                                    {thoughtOpen ? (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    )}
                                    Chain-of-Thought Trace ({evaluation.thoughtTrace.length} chars stripped)
                                  </span>
                                  <span>{turn.streaming ? 'streaming…' : 'expand'}</span>
                                </button>
                                {thoughtOpen && (
                                  <pre className="px-3 pb-3 pt-1 text-[11px] font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap border-t border-black/[0.06] dark:border-white/[0.08]">
                                    {evaluation.thoughtTrace}
                                  </pre>
                                )}
                              </div>
                            )}

                            {evaluation?.visibleResponse ? (
                              <SafeMarkdownBlock content={evaluation.visibleResponse} />
                            ) : turn.streaming ? (
                              <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                                Streaming response…
                              </div>
                            ) : null}

                            {!turn.streaming && evaluation && (
                              <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={
                                      evaluation.verdict === 'UNFILTERED'
                                        ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                        : 'text-amber-700 dark:text-amber-400 font-semibold'
                                    }
                                  >
                                    Heretic Audit: {evaluation.verdict} ({evaluation.matchCount} marker hits)
                                  </span>
                                  {evaluation.matchedMarkers.length > 0 && (
                                    <span className="text-slate-500 dark:text-slate-400">
                                      [{evaluation.matchedMarkers.slice(0, 5).join(', ')}]
                                    </span>
                                  )}
                                </div>
                                {turn.sha256Digest && (
                                  <span className="text-slate-500 dark:text-slate-400">
                                    sha256:{turn.sha256Digest.slice(0, 16)}…
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={transcriptEndRef} />
            </div>

            {chatError && (
              <div className="mx-5 mb-3 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span>{chatError}</span>
                {missingErrorEnvVar && (
                  <button
                    type="button"
                    onClick={() =>
                      redirectToSecret(missingErrorEnvVar, onNavigate, {
                        tab: 'chat',
                        providerId: selectedProviderId,
                        label: `AI Chat · ${currentProvider?.label ?? selectedProviderId}`,
                      })
                    }
                    className="px-3 py-1.5 text-[11px] font-medium rounded-lg crimson-metallic-btn whitespace-nowrap self-start sm:self-auto"
                  >
                    Go to {missingErrorEnvVar} →
                  </button>
                )}
              </div>
            )}

            {/* Composer */}
            <form
              onSubmit={(e) => void handleSendMessage(e)}
              className="p-4 border-t border-black/[0.08] dark:border-white/[0.1] flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
            >
              <textarea
                rows={2}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={handlePromptKeyDown}
                placeholder="Ask a technical question or test refusal/slop boundaries (Enter to send, Shift+Enter for newline)…"
                className="flex-1 p-3 text-sm rounded-xl bg-white/85 dark:bg-slate-950/75 border border-black/10 dark:border-white/15 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 resize-none"
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopStreaming}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 whitespace-nowrap shrink-0"
                >
                  <Square className="w-3.5 h-3.5" />
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!promptInput.trim()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium rounded-xl crimson-metallic-btn disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Prompt
                </button>
              )}
            </form>
          </section>
        </div>
      )}

      {/* TAB 2: HERETIC ABLITERATION STUDIO */}
      {subTab === 'studio' && (
        <div className="space-y-6">
          {/* Profile Preset Selector */}
          <section className="apple-glass rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  01. Cloned Config Presets (<span className="font-mono">0xSojalSec/Uncensored-AI</span>)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {configState.summary}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {HERETIC_PROFILES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyProfile(p.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      selectedProfileId === p.id
                        ? 'crimson-metallic-active'
                        : 'bg-black/[0.05] dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hyperparameters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  quantization
                </label>
                <select
                  value={configState.quantization}
                  onChange={(e) =>
                    setConfigState((prev) => ({
                      ...prev,
                      quantization: e.target.value as QuantizationMethod,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white/80 dark:bg-slate-950/70 border border-black/10 dark:border-white/15"
                >
                  <option value="none">none (full precision)</option>
                  <option value="bnb_4bit">bnb_4bit (4-bit NF4)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  row_normalization
                </label>
                <select
                  value={configState.rowNormalization}
                  onChange={(e) =>
                    setConfigState((prev) => ({
                      ...prev,
                      rowNormalization: e.target.value as RowNormalization,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white/80 dark:bg-slate-950/70 border border-black/10 dark:border-white/15"
                >
                  <option value="full">full (LoRA rank norm)</option>
                  <option value="pre">pre</option>
                  <option value="none">none</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  full_normalization_lora_rank ({configState.fullNormalizationLoraRank})
                </label>
                <input
                  type="range"
                  min={1}
                  max={16}
                  step={1}
                  value={configState.fullNormalizationLoraRank}
                  onChange={(e) =>
                    setConfigState((prev) => ({
                      ...prev,
                      fullNormalizationLoraRank: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-rose-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  winsorization_quantile ({configState.winsorizationQuantile.toFixed(2)})
                </label>
                <input
                  type="range"
                  min={0.85}
                  max={1.0}
                  step={0.01}
                  value={configState.winsorizationQuantile}
                  onChange={(e) =>
                    setConfigState((prev) => ({
                      ...prev,
                      winsorizationQuantile: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-rose-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  kl_divergence_target
                </label>
                <input
                  type="number"
                  step={0.005}
                  min={0.001}
                  max={1.0}
                  value={configState.klDivergenceTarget}
                  onChange={(e) =>
                    setConfigState((prev) => ({
                      ...prev,
                      klDivergenceTarget: Number(e.target.value) || 0.01,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white/80 dark:bg-slate-950/70 border border-black/10 dark:border-white/15"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  n_trials (Optuna TPE)
                </label>
                <input
                  type="number"
                  step={10}
                  min={10}
                  max={1000}
                  value={configState.nTrials}
                  onChange={(e) =>
                    setConfigState((prev) => ({
                      ...prev,
                      nTrials: Math.max(10, Number(e.target.value) || 200),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white/80 dark:bg-slate-950/70 border border-black/10 dark:border-white/15"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  max_response_length
                </label>
                <input
                  type="number"
                  step={25}
                  min={32}
                  max={2048}
                  value={configState.maxResponseLength}
                  onChange={(e) =>
                    setConfigState((prev) => ({
                      ...prev,
                      maxResponseLength: Math.max(32, Number(e.target.value) || 100),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white/80 dark:bg-slate-950/70 border border-black/10 dark:border-white/15"
                />
              </div>

              <label className="flex items-center gap-2.5 pt-5 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={configState.orthogonalizeDirection}
                  onChange={(e) =>
                    setConfigState((prev) => ({
                      ...prev,
                      orthogonalizeDirection: e.target.checked,
                    }))
                  }
                  className="rounded accent-rose-600 w-4 h-4"
                />
                <span className="font-mono">orthogonalize_direction</span>
              </label>
            </div>
          </section>

          {/* Two-column: Pareto Objective Simulator + Live Evaluator */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="apple-glass rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                02. Optuna TPE Pareto Objective Calculator
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inspects Heretic&apos;s scalar co-optimization objective across KL divergence (intelligence retention) and refusal count (<span className="font-mono">/ 100</span> eval prompts).
              </p>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span>Trial KL Divergence</span>
                    <span>{simKlDivergence.toFixed(3)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.5}
                    step={0.005}
                    value={simKlDivergence}
                    onChange={(e) => setSimKlDivergence(Number(e.target.value))}
                    className="w-full accent-rose-600"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span>Refusal Count (out of 100)</span>
                    <span>{simRefusalCount}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={simRefusalCount}
                    onChange={(e) => setSimRefusalCount(Number(e.target.value))}
                    className="w-full accent-rose-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
                <div className="p-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.05]">
                  <div className="text-slate-500 dark:text-slate-400">Composite Loss</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {simObjective.compositeObjective}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.05]">
                  <div className="text-slate-500 dark:text-slate-400">KL Target Gate</div>
                  <div
                    className={`text-sm font-semibold mt-0.5 ${
                      simObjective.targetSatisfied
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {simObjective.targetSatisfied ? 'ABOVE TARGET' : 'BELOW TARGET'}
                  </div>
                </div>
              </div>
            </section>

            <section className="apple-glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  03. Live CoT + Marker Evaluator
                </h2>
                <span
                  className={`text-xs font-mono font-semibold ${
                    liveEvalResult.verdict === 'UNFILTERED'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {liveEvalResult.verdict} ({liveEvalResult.matchCount} hits)
                </span>
              </div>

              <textarea
                rows={4}
                value={evaluatorSample}
                onChange={(e) => setEvaluatorSample(e.target.value)}
                className="w-full p-3 text-xs font-mono rounded-xl bg-white/80 dark:bg-slate-950/70 border border-black/10 dark:border-white/15 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />

              <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300 font-mono">
                <div>
                  CoT stripped: <strong>{liveEvalResult.strippedChars} chars</strong> · Visible length:{' '}
                  <strong>{liveEvalResult.cleanResponseLength} chars</strong>
                </div>
                <div>
                  Matched markers:{' '}
                  <strong>
                    {liveEvalResult.matchedMarkers.length > 0
                      ? liveEvalResult.matchedMarkers.join(', ')
                      : 'None'}
                  </strong>
                </div>
              </div>
            </section>
          </div>

          {/* Generated config.toml + Host CLI */}
          <section className="apple-glass rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  04. Generated <span className="font-mono">config.toml</span> &amp; Host CLI
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Host execution state: <span className="font-mono font-semibold">PLANNED_HOST_GPU</span> (requires Python 3.10+ &amp; PyTorch 2.2+ with CUDA/MPS).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopyText('toml', generatedToml)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/15"
                >
                  {copiedId === 'toml' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedId === 'toml' ? 'Copied TOML' : 'Copy TOML'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadToml}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl crimson-metallic-btn"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download config.toml
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <input
                type="text"
                value={hfTargetModel}
                onChange={(e) => setHfTargetModel(e.target.value)}
                placeholder="Hugging Face Model ID"
                className="sm:w-72 px-3 py-2 text-xs font-mono rounded-xl bg-white/80 dark:bg-slate-950/70 border border-black/10 dark:border-white/15"
              />
              <div className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-slate-950/90 text-rose-200 border border-white/10 overflow-x-auto whitespace-nowrap">
                {generatedCli}
              </div>
              <button
                type="button"
                onClick={() => void handleCopyText('cli', generatedCli)}
                className="px-3 py-2 text-xs font-medium rounded-xl bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/15 whitespace-nowrap"
              >
                {copiedId === 'cli' ? 'Copied' : 'Copy CLI'}
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950/90 text-slate-200 font-mono text-xs overflow-x-auto max-h-80 border border-white/10">
              {generatedToml}
            </pre>
          </section>
        </div>
      )}

      {/* TAB 3: CLONED REPOSITORY MATRIX */}
      {subTab === 'repo' && (
        <div className="space-y-6">
          <section className="apple-glass rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Cloned Architecture Map — <span className="font-mono">0xSojalSec/Uncensored-AI</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  AGPL-3.0 upstream directional orthogonalization toolkit mapped into LiquidOS Strata MoE Tier T6 &amp; TypeScript browser audit modules.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                License: AGPL-3.0-or-later
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 pr-4 font-medium">Module</th>
                    <th className="py-2.5 pr-4 font-medium">Upstream Responsibility</th>
                    <th className="py-2.5 pr-4 font-medium">Key Symbols</th>
                    <th className="py-2.5 font-medium">LiquidOS Integration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
                  {HERETIC_MODULES.map((mod) => (
                    <tr key={mod.file}>
                      <td className="py-3 pr-4 font-mono font-medium text-rose-700 dark:text-rose-300 whitespace-nowrap">
                        {mod.file}
                      </td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{mod.role}</td>
                      <td className="py-3 pr-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {mod.keySymbols.join(', ')}
                      </td>
                      <td className="py-3 text-slate-700 dark:text-slate-300">{mod.liquidOsBridge}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="apple-glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Upstream Deterministic Weight Verification Suites (<span className="font-mono">tests/</span>)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {HERETIC_TEST_SUITES.map((suite) => (
                <div
                  key={suite.suite}
                  className="p-4 rounded-xl bg-white/70 dark:bg-slate-950/60 border border-black/10 dark:border-white/10 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {suite.suite}
                    </span>
                    <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
                      {suite.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {suite.targetModelClass}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Config: {suite.configPath}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Checksums: {suite.checksumTargets.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
