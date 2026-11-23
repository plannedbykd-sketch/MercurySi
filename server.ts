import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GroundingRequestBody {
  componentName?: unknown;
  endpointOrTarget?: unknown;
  keyModules?: unknown;
  customQuery?: unknown;
}

interface GroundingSource {
  title: string;
  uri: string;
}

type ChatProviderId = 'gemini' | 'openrouter' | 'huggingface' | 'openai' | 'groq' | 'ollama';

interface ProviderSpec {
  id: ChatProviderId;
  label: string;
  envVar: string;
  protocol: 'gemini' | 'openai-compat';
  upstreamUrl: string | null;
  defaultModel: string;
  models: Array<{ id: string; label: string; note: string }>;
}

const GEMINI_ALLOWED_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);

const CHAT_PROVIDERS: Record<ChatProviderId, ProviderSpec> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    envVar: 'GEMINI_API_KEY',
    protocol: 'gemini',
    upstreamUrl: null,
    defaultModel: 'gemini-4-hydrogen',
    models: [
      { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', note: 'Fast reasoning & streaming' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', note: 'Low-latency text' },
    ],
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter (BYOK)',
    envVar: 'OPENROUTER_API_KEY',
    protocol: 'openai-compat',
    upstreamUrl: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'deepseek/deepseek-r1',
    models: [
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1', note: 'Emits <think> CoT trace' },
      { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B', note: 'Reasoning + multilingual' },
      {
        id: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
        label: 'Dolphin Mistral 24B Venice',
        note: 'Uncensored instruction preset',
      },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct', note: 'General synthesis' },
    ],
  },
  huggingface: {
    id: 'huggingface',
    label: 'Hugging Face Router (BYOK)',
    envVar: 'HF_TOKEN',
    protocol: 'openai-compat',
    upstreamUrl: 'https://router.huggingface.co/v1/chat/completions',
    defaultModel: 'Qwen/Qwen3-4B-Instruct-2507',
    models: [
      { id: 'Qwen/Qwen3-4B-Instruct-2507', label: 'Qwen3-4B-Instruct-2507', note: 'Primary Uncensored-AI target' },
      { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama-3.3-70B-Instruct', note: 'Open weights' },
      { id: 'mistralai/Mistral-Small-24B-Instruct-2501', label: 'Mistral-Small-24B', note: 'Mistral 3 class' },
    ],
  },
  openai: {
    id: 'openai',
    label: 'OpenAI (BYOK)',
    envVar: 'OPENAI_API_KEY',
    protocol: 'openai-compat',
    upstreamUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', note: 'Fast structured output' },
      { id: 'gpt-4o', label: 'GPT-4o', note: 'Multimodal flagship' },
      { id: 'o4-mini', label: 'o4-mini', note: 'Reasoning model' },
    ],
  },
  groq: {
    id: 'groq',
    label: 'Groq (BYOK)',
    envVar: 'GROQ_API_KEY',
    protocol: 'openai-compat',
    upstreamUrl: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', note: 'High-throughput LPU' },
      { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B', note: 'Reasoning LPU' },
      { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B', note: 'CoT reasoning' },
    ],
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama / LiquidOS Local',
    envVar: 'OLLAMA_BASE_URL',
    protocol: 'openai-compat',
    upstreamUrl: null,
    defaultModel: 'deepseek-v4.1-flash-uncensored',
    models: [
      { id: 'deepseek-v4.1-flash-uncensored', label: 'DeepSeek-V4.1-Flash-Uncensored', note: 'Strata MoE T6' },
      { id: 'qwen3:8b', label: 'Qwen3 8B', note: 'Local runtime' },
      { id: 'dolphin-llama3:8b', label: 'Dolphin Llama3 8B', note: 'Uncensored local' },
    ],
  },
};

interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatStreamRequestBody {
  provider?: unknown;
  model?: unknown;
  systemPrompt?: unknown;
  messages?: unknown;
}

function sanitizeString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function sanitizeStringArray(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function isProviderConfigured(spec: ProviderSpec): boolean {
  const raw = process.env[spec.envVar];
  if (!raw || !raw.trim()) return false;
  if (spec.id === 'ollama') {
    try {
      const parsed = new URL(raw.trim());
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
  return true;
}

function formatGeminiError(err: unknown, fallback: string): { status: number; message: string } {
  const status =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 502;
  const resolvedStatus = status >= 400 && status < 600 ? status : 502;
  const rawMessage = err instanceof Error ? err.message : fallback;
  try {
    const parsed = JSON.parse(rawMessage) as { error?: { message?: string } };
    if (parsed.error?.message) {
      return { status: resolvedStatus, message: parsed.error.message };
    }
  } catch {
    // rawMessage is already plain text
  }
  return { status: resolvedStatus, message: rawMessage };
}

function resolveServerUpstreamUrl(spec: ProviderSpec): string | null {
  if (spec.id === 'ollama') {
    const base = process.env.OLLAMA_BASE_URL?.trim();
    if (!base) return null;
    try {
      const parsed = new URL(base);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return `${parsed.origin}/v1/chat/completions`;
    } catch {
      return null;
    }
  }
  return spec.upstreamUrl;
}

function sanitizeMessages(raw: unknown): ChatMessageInput[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: ChatMessageInput[] = [];
  for (const item of raw.slice(-40)) {
    if (!item || typeof item !== 'object') continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role === 'user' || role === 'assistant') && typeof content === 'string') {
      const trimmed = content.trim().slice(0, 16000);
      if (trimmed) {
        cleaned.push({ role, content: trimmed });
      }
    }
  }
  return cleaned;
}

function writeSseEvent(res: Response, payload: Record<string, unknown>) {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  app.post('/api/grounding/upgrades', async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Set your API key in Settings > Secrets.',
        envVar: 'GEMINI_API_KEY',
      });
      return;
    }

    const body = (req.body || {}) as GroundingRequestBody;
    const componentName = sanitizeString(body.componentName, 140);
    const endpointOrTarget = sanitizeString(body.endpointOrTarget, 140);
    const keyModules = sanitizeStringArray(body.keyModules, 8, 80);
    const customQuery = sanitizeString(body.customQuery, 300);

    if (!componentName && !customQuery) {
      res.status(400).json({
        error: 'Provide either a LiquidOS componentName or a customQuery.',
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const promptParts = [
      componentName ? `Target LiquidOS Component: ${componentName}` : '',
      endpointOrTarget ? `Runtime / Endpoint: ${endpointOrTarget}` : '',
      keyModules.length > 0 ? `Core Technologies / Modules: ${keyModules.join(', ')}` : '',
      customQuery ? `Specific Focus Query: ${customQuery}` : '',
      'Find the latest 2025–2026 technology releases, SDK/toolchain upgrades, security patches, and architectural improvements relevant to these underlying technologies.',
    ].filter(Boolean);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptParts.join('\n'),
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction:
            'You are a systems engineering researcher. Use Google Search grounding to report concrete, recent software releases, version numbers, security advisories, and performance upgrades relevant to the requested stack. Keep output concise, structured with clear headings and bullet points, and avoid fabricating versions not supported by search results.',
        },
      });

      const metadata = response.candidates?.[0]?.groundingMetadata;
      const rawChunks = metadata?.groundingChunks ?? [];
      const seenUris = new Set<string>();
      const sources: GroundingSource[] = [];

      for (const chunk of rawChunks) {
        const uri = chunk.web?.uri;
        const title = chunk.web?.title;
        if (typeof uri === 'string' && uri.startsWith('http') && !seenUris.has(uri)) {
          seenUris.add(uri);
          sources.push({
            uri,
            title: typeof title === 'string' && title.trim() ? title.trim() : uri,
          });
        }
      }

      const searchQueries = Array.isArray(metadata?.webSearchQueries)
        ? metadata.webSearchQueries.filter((q): q is string => typeof q === 'string')
        : [];

      res.json({
        summary: response.text ?? '',
        sources,
        searchQueries,
        model: 'gemini-4-hydrogen',
        fetchedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const { status: resolvedStatus, message } = formatGeminiError(
        err,
        'Upstream Gemini grounding request failed.'
      );
      res.status(resolvedStatus).json({
        error: message,
        ...(resolvedStatus === 400 || resolvedStatus === 403 || resolvedStatus === 429
          ? { envVar: 'GEMINI_API_KEY' }
          : {}),
      });
    }
  });

  const digestCache = new Map<
    string,
    {
      expiresAt: number;
      payload: {
        summary: string;
        sources: GroundingSource[];
        searchQueries: string[];
        model: string;
        fetchedAt: string;
        plane: string;
      };
    }
  >();

  app.post('/api/grounding/digest', async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Set your API key in Settings > Secrets.',
        envVar: 'GEMINI_API_KEY',
      });
      return;
    }

    const body = (req.body || {}) as {
      plane?: unknown;
      components?: unknown;
      force?: unknown;
    };
    const plane = sanitizeString(body.plane, 48) || 'All';
    const force = body.force === true;
    const components = sanitizeStringArray(body.components, 14, 100);

    const cached = digestCache.get(plane);
    if (!force && cached && cached.expiresAt > Date.now()) {
      res.json({ ...cached.payload, cached: true });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const stackFocus =
      components.length > 0
        ? components.join('; ')
        : 'Rust FFI / SwiftPM XCFramework, Android NDK 16KB ELF / Room KMP sqlite-vec, Ollama / DeepSeek / llama.cpp, LanceDB / DuckDB, QEMU/KVM microVM';

    const prompt = [
      `Architecture Scope: ${plane} plane(s) in LiquidOS.`,
      `Components & Technologies: ${stackFocus}.`,
      'Fetch the latest 2025–2026 technology upgrade news, stable release versions, security advisories, and runtime performance improvements across these specific technologies. Organize into concise bulleted news items grouped by subsystem with exact version numbers cited from search results.',
    ].join('\n');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction:
            'You are a systems architecture release tracker. Use Google Search grounding to compile concise, verified technology upgrade news for the listed subsystems. Cite concrete recent versions and security updates supported by search results; never invent release numbers.',
        },
      });

      const metadata = response.candidates?.[0]?.groundingMetadata;
      const rawChunks = metadata?.groundingChunks ?? [];
      const seenUris = new Set<string>();
      const sources: GroundingSource[] = [];

      for (const chunk of rawChunks) {
        const uri = chunk.web?.uri;
        const title = chunk.web?.title;
        if (typeof uri === 'string' && uri.startsWith('http') && !seenUris.has(uri)) {
          seenUris.add(uri);
          sources.push({
            uri,
            title: typeof title === 'string' && title.trim() ? title.trim() : uri,
          });
        }
      }

      const searchQueries = Array.isArray(metadata?.webSearchQueries)
        ? metadata.webSearchQueries.filter((q): q is string => typeof q === 'string')
        : [];

      const payload = {
        summary: response.text ?? '',
        sources,
        searchQueries,
        model: 'gemini-4-hydrogen',
        fetchedAt: new Date().toISOString(),
        plane,
      };

      digestCache.set(plane, {
        expiresAt: Date.now() + 4 * 60 * 1000,
        payload,
      });

      res.json({ ...payload, cached: false });
    } catch (err: unknown) {
      const { status: resolvedStatus, message } = formatGeminiError(
        err,
        'Upstream Gemini grounding digest failed.'
      );
      res.status(resolvedStatus).json({
        error: message,
        ...(resolvedStatus === 400 || resolvedStatus === 403 || resolvedStatus === 429
          ? { envVar: 'GEMINI_API_KEY' }
          : {}),
      });
    }
  });

  app.get('/api/env/status', (_req: Request, res: Response) => {
    const appUrlRaw = process.env.APP_URL?.trim() || '';
    let appUrlConfigured = false;
    if (appUrlRaw && appUrlRaw !== 'MY_APP_URL') {
      try {
        const parsed = new URL(appUrlRaw);
        appUrlConfigured = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        appUrlConfigured = false;
      }
    }

    const items = [
      {
        envVar: 'GEMINI_API_KEY',
        label: 'Google Gemini API Key',
        category: 'Required Core',
        required: true,
        configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        description:
          'Powers server-side Gemini 4 Hydrogen streaming chat and Google Search grounded upgrade lookups.',
        whereToSet: 'AI Studio → Settings > Secrets (injected server-side into process.env)',
        exampleLine: 'GEMINI_API_KEY="MY_GEMINI_API_KEY"',
        pipelines: [
          {
            id: 'gemini-chat',
            label: 'AI Chat · Google Gemini',
            tab: 'chat',
            providerId: 'gemini',
          },
          {
            id: 'grounding-scout',
            label: 'Topology · Upgrade Scout',
            tab: 'overview',
          },
        ],
      },
      {
        envVar: 'OPENROUTER_API_KEY',
        label: 'OpenRouter BYOK Secret',
        category: 'Optional BYOK',
        required: false,
        configured: isProviderConfigured(CHAT_PROVIDERS.openrouter),
        description:
          'Routes DeepSeek R1, Qwen 3 32B, Dolphin Mistral 24B Venice, and Llama 3.3 70B through /api/chat/stream.',
        whereToSet: 'AI Studio → Settings > Secrets (server-only)',
        exampleLine: 'OPENROUTER_API_KEY=""',
        pipelines: [
          {
            id: 'openrouter-chat',
            label: 'AI Chat · OpenRouter',
            tab: 'chat',
            providerId: 'openrouter',
          },
        ],
      },
      {
        envVar: 'HF_TOKEN',
        label: 'Hugging Face Router Token',
        category: 'Optional BYOK',
        required: false,
        configured: isProviderConfigured(CHAT_PROVIDERS.huggingface),
        description:
          'Authenticates Hugging Face Inference Router for Qwen3-4B-Instruct-2507 and Mistral 3 models.',
        whereToSet: 'AI Studio → Settings > Secrets (server-only)',
        exampleLine: 'HF_TOKEN=""',
        pipelines: [
          {
            id: 'hf-chat',
            label: 'AI Chat · Hugging Face',
            tab: 'chat',
            providerId: 'huggingface',
          },
        ],
      },
      {
        envVar: 'OPENAI_API_KEY',
        label: 'OpenAI BYOK Secret',
        category: 'Optional BYOK',
        required: false,
        configured: isProviderConfigured(CHAT_PROVIDERS.openai),
        description: 'Enables GPT-4o Mini, GPT-4o, and o4-mini over the server chat proxy.',
        whereToSet: 'AI Studio → Settings > Secrets (server-only)',
        exampleLine: 'OPENAI_API_KEY=""',
        pipelines: [
          {
            id: 'openai-chat',
            label: 'AI Chat · OpenAI',
            tab: 'chat',
            providerId: 'openai',
          },
        ],
      },
      {
        envVar: 'GROQ_API_KEY',
        label: 'Groq LPU BYOK Secret',
        category: 'Optional BYOK',
        required: false,
        configured: isProviderConfigured(CHAT_PROVIDERS.groq),
        description: 'Powers high-throughput Groq LPU inference for Llama 3.3 and DeepSeek R1 Distill.',
        whereToSet: 'AI Studio → Settings > Secrets (server-only)',
        exampleLine: 'GROQ_API_KEY=""',
        pipelines: [
          {
            id: 'groq-chat',
            label: 'AI Chat · Groq',
            tab: 'chat',
            providerId: 'groq',
          },
        ],
      },
      {
        envVar: 'OLLAMA_BASE_URL',
        label: 'Ollama / Strata MoE T6 Endpoint',
        category: 'Local Runtime',
        required: false,
        configured: isProviderConfigured(CHAT_PROVIDERS.ollama),
        description:
          'Server-side HTTP/HTTPS origin for local Ollama or LiquidOS Strata MoE Tier T6 (DeepSeek-V4.1-Flash-Uncensored).',
        whereToSet: 'AI Studio → Settings > Secrets or host .env (http(s):// origin)',
        exampleLine: 'OLLAMA_BASE_URL="http://127.0.0.1:11434"',
        pipelines: [
          {
            id: 'ollama-chat',
            label: 'AI Chat · Ollama Local',
            tab: 'chat',
            providerId: 'ollama',
          },
        ],
      },
      {
        envVar: 'APP_URL',
        label: 'Hosted Applet Origin URL',
        category: 'Runtime Host',
        required: false,
        configured: appUrlConfigured,
        description:
          'Used by the Express backend for OpenRouter HTTP-Referer attribution and self-referential runtime links.',
        whereToSet: 'Automatically injected by Cloud Run / AI Studio runtime (or host .env)',
        exampleLine: 'APP_URL="MY_APP_URL"',
        pipelines: [
          {
            id: 'openrouter-referer',
            label: 'Express Proxy Attribution',
            tab: 'chat',
            providerId: 'openrouter',
          },
        ],
      },
    ];

    res.json({
      checkedAt: new Date().toISOString(),
      items,
    });
  });

  app.get('/api/chat/providers', (_req: Request, res: Response) => {
    const providers = Object.values(CHAT_PROVIDERS).map((spec) => ({
      id: spec.id,
      label: spec.label,
      envVar: spec.envVar,
      configured: isProviderConfigured(spec),
      defaultModel: spec.defaultModel,
      models: spec.models,
    }));
    res.json({ providers });
  });

  app.post('/api/chat/stream', async (req: Request, res: Response) => {
    const body = (req.body || {}) as ChatStreamRequestBody;
    const providerRaw = sanitizeString(body.provider, 32) as ChatProviderId;
    const spec = CHAT_PROVIDERS[providerRaw];
    if (!spec) {
      res.status(400).json({ error: 'Unsupported chat provider.' });
      return;
    }

    const messages = sanitizeMessages(body.messages);
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
      res.status(400).json({ error: 'Provide at least one user message.' });
      return;
    }

    const systemPrompt = sanitizeString(body.systemPrompt, 4000);
    const requestedModel = sanitizeString(body.model, 120) || spec.defaultModel;

    if (!isProviderConfigured(spec)) {
      res.status(503).json({
        error: `${spec.label} is not configured on the server. Add ${spec.envVar} in Settings > Secrets to enable this provider.`,
        envVar: spec.envVar,
      });
      return;
    }

    if (spec.id === 'gemini' && !GEMINI_ALLOWED_MODELS.has(requestedModel)) {
      res.status(400).json({
        error: `Model "${requestedModel}" is not in the supported Gemini chat set (${Array.from(GEMINI_ALLOWED_MODELS).join(', ')}).`,
      });
      return;
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 90000);
    req.on('close', () => {
      abortController.abort();
      clearTimeout(timeoutId);
    });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    try {
      if (spec.protocol === 'gemini') {
        const apiKey = process.env.GEMINI_API_KEY!;
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const contents = messages.map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }));

        const stream = await ai.models.generateContentStream({
          model: requestedModel,
          contents,
          config: systemPrompt ? { systemInstruction: systemPrompt } : undefined,
        });

        for await (const chunk of stream) {
          if (abortController.signal.aborted) break;
          const delta = chunk.text;
          if (typeof delta === 'string' && delta.length > 0) {
            writeSseEvent(res, { type: 'delta', text: delta });
          }
        }

        writeSseEvent(res, { type: 'done', provider: spec.id, model: requestedModel });
        res.end();
        clearTimeout(timeoutId);
        return;
      }

      const upstreamUrl = resolveServerUpstreamUrl(spec);
      if (!upstreamUrl) {
        writeSseEvent(res, {
          type: 'error',
          error: `${spec.label} endpoint is unavailable. Check ${spec.envVar} in Settings > Secrets.`,
        });
        res.end();
        clearTimeout(timeoutId);
        return;
      }

      const upstreamMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
      if (systemPrompt) {
        upstreamMessages.push({ role: 'system', content: systemPrompt });
      }
      for (const m of messages) {
        upstreamMessages.push({ role: m.role, content: m.content });
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const secretVal = process.env[spec.envVar]?.trim();
      if (spec.id !== 'ollama' && secretVal) {
        headers.Authorization = `Bearer ${secretVal}`;
      }
      if (spec.id === 'openrouter') {
        headers['HTTP-Referer'] = process.env.APP_URL || 'https://localhost:3000';
        headers['X-Title'] = 'LiquidOS Uncensored-AI Workbench';
      }

      const upstreamRes = await fetch(upstreamUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: requestedModel,
          stream: true,
          messages: upstreamMessages,
        }),
        signal: abortController.signal,
      });

      if (!upstreamRes.ok) {
        const errBody = await upstreamRes.text().catch(() => '');
        writeSseEvent(res, {
          type: 'error',
          error: `Upstream ${spec.label} returned HTTP ${upstreamRes.status}${errBody ? `: ${errBody.slice(0, 260)}` : ''}`,
        });
        res.end();
        clearTimeout(timeoutId);
        return;
      }

      if (!upstreamRes.body) {
        writeSseEvent(res, { type: 'error', error: 'Upstream response contained no body stream.' });
        res.end();
        clearTimeout(timeoutId);
        return;
      }

      const reader = upstreamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let inReasoningBlock = false;

      while (!abortController.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line.startsWith('data:')) continue;
          const payloadStr = line.slice(5).trim();
          if (payloadStr === '[DONE]') {
            if (inReasoningBlock) {
              writeSseEvent(res, { type: 'delta', text: '</think>\n\n' });
              inReasoningBlock = false;
            }
            writeSseEvent(res, { type: 'done', provider: spec.id, model: requestedModel });
            res.end();
            clearTimeout(timeoutId);
            return;
          }

          try {
            const parsed = JSON.parse(payloadStr) as {
              choices?: Array<{
                delta?: { content?: string; reasoning_content?: string };
              }>;
              error?: { message?: string };
            };
            if (parsed.error?.message) {
              writeSseEvent(res, { type: 'error', error: parsed.error.message });
              res.end();
              clearTimeout(timeoutId);
              return;
            }
            const delta = parsed.choices?.[0]?.delta;
            if (typeof delta?.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
              if (!inReasoningBlock) {
                writeSseEvent(res, { type: 'delta', text: '<think>' });
                inReasoningBlock = true;
              }
              writeSseEvent(res, { type: 'delta', text: delta.reasoning_content });
            }
            if (typeof delta?.content === 'string' && delta.content.length > 0) {
              if (inReasoningBlock) {
                writeSseEvent(res, { type: 'delta', text: '</think>\n\n' });
                inReasoningBlock = false;
              }
              writeSseEvent(res, { type: 'delta', text: delta.content });
            }
          } catch {
            // Ignore partial SSE JSON chunks
          }
        }
      }

      if (inReasoningBlock) {
        writeSseEvent(res, { type: 'delta', text: '</think>\n\n' });
      }
      writeSseEvent(res, { type: 'done', provider: spec.id, model: requestedModel });
      res.end();
      clearTimeout(timeoutId);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (abortController.signal.aborted) {
        if (!res.writableEnded) res.end();
        return;
      }
      const message = err instanceof Error ? err.message : 'Streaming inference failed.';
      writeSseEvent(res, { type: 'error', error: message });
      res.end();
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`LiquidOS server listening on http://0.0.0.0:${port}`);
  });
}

void createServer();
