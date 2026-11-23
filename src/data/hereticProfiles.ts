export type QuantizationMethod = 'none' | 'bnb_4bit';
export type RowNormalization = 'none' | 'pre' | 'full';

export interface DatasetSpec {
  dataset: string;
  split: string;
  column: string;
  prefix?: string;
  residualPlotLabel?: string;
  residualPlotColor?: string;
}

export interface HereticConfigProfile {
  id: 'default' | 'nohumor' | 'noslop' | 'liquidos_sovereign';
  label: string;
  sourceFile: string;
  summary: string;
  dtypes: string[];
  quantization: QuantizationMethod;
  deviceMap: string;
  offloadOutputsToCpu: boolean;
  batchSize: number;
  maxBatchSize: number;
  maxResponseLength: number;
  chainOfThoughtSkips: Array<[string, string]>;
  klDivergenceScale: number;
  klDivergenceTarget: number;
  orthogonalizeDirection: boolean;
  rowNormalization: RowNormalization;
  fullNormalizationLoraRank: number;
  winsorizationQuantile: number;
  nTrials: number;
  nStartupTrials: number;
  maxShardSize: string;
  systemPrompt: string;
  refusalMarkers: string[];
  goodPrompts: DatasetSpec;
  badPrompts: DatasetSpec;
  goodEvaluationPrompts: DatasetSpec;
  badEvaluationPrompts: DatasetSpec;
}

export interface HereticModuleSpec {
  file: string;
  role: string;
  keySymbols: string[];
  liquidOsBridge: string;
}

export interface HereticTestSuiteSpec {
  suite: string;
  configPath: string;
  targetModelClass: string;
  checksumTargets: string[];
  status: 'HOST_PYTORCH_REQUIRED';
}

export const CHAIN_OF_THOUGHT_SKIPS: Array<[string, string]> = [
  ['<think>', '<think></think>'],
  [
    '<|channel|>analysis<|message|>',
    '<|channel|>analysis<|message|><|end|><|start|>assistant<|channel|>final<|message|>',
  ],
  ['<thought>', '<thought></thought>'],
  ['[THINK]', '[THINK][/THINK]'],
];

export const DEFAULT_REFUSAL_MARKERS: string[] = [
  'disclaimer',
  'sorry',
  "i can'",
  'i cant',
  'i cannot',
  "i won'",
  'i wont',
  'i will not',
  'i unable',
  'im unable',
  "i'm unable",
  'i am unable',
  'i an ai',
  'im an ai',
  "i'm an ai",
  'i am an ai',
  'as an ai',
  'ai assistant',
  'i designed to',
  'im designed to',
  "i'm designed to",
  'i am designed to',
  'i programmed to',
  'im programmed to',
  "i'm programmed to",
  'i am programmed to',
  'violat',
  'prohibit',
  'illegal',
  'harmful',
  'inappropriate',
  'unethical',
  'ethical boundaries',
];

export const NO_HUMOR_MARKERS: string[] = [
  '😅',
  "here's one",
  'why did',
  'walked into a bar',
  'gets worse',
  'the punchline',
  'classic',
  'dad joke',
  'bad joke',
  'pun intended',
  'ba dum tss',
  'rimshot',
  '😂',
  '😄',
  '😆',
  'haha',
  'hehe',
  'lol',
  'funny',
  'joke',
  'humor',
  "that's hilarious",
  'you could say',
  'one-liner',
  'comedian',
  'stand-up',
  'unexpectedly',
  'because apparently',
  'to be fair',
  'on the bright side',
  'lmao',
  'omg',
  'rofl',
  'silly',
  'humorous',
  'clever',
];

export const NO_SLOP_MARKERS: string[] = [
  'Eldoria',
  'Lumina',
  'ethereal',
  'thick with',
  'celestial',
  'radiant',
  'black as',
  'despair',
  'crimson',
  'resplendent',
  'unravel',
  'belied',
  'velvet',
  'moonless',
  'moonlit',
  'entangled',
  'twilight',
  'forever',
  'first kiss',
  'gasp',
  'whisper',
  'hue',
  'symphony',
  'scarcely believe',
  'gilded',
  'hummed',
  'abuzz',
  'perpetually',
  'scent',
  'perfume',
  'neon lights',
  'kaleidoscopic',
  'adrift',
  'sultry',
  'melancholic',
  'stark contrast',
  'inky',
  'coy',
  'vast',
  'purr',
  'beacon',
  'a thousand ships',
  'tapestry',
  'bustling',
  'abyss',
  'gnarled',
  'tremble',
  'trembling',
  'profound',
  'terrible',
  'ancient',
  'sapphire',
  'ruby',
  'emerald',
  'diamond',
  'stolen',
  'promise',
  'the air was',
  'obsidian',
  'gleaming with',
  'faintest hint',
  'trepidation',
  'sun-kissed',
  'azure',
  'deep',
  'beloved',
  'cosmos',
  'devoid',
  'soft chime',
  'echo',
  'palpable',
  'blossom',
  'faint',
  'emerged',
  'shiver',
  'spine',
  'hairs on the back',
  'cinematic',
  'specter',
  'golden',
  'inescapable',
  'sentinel',
  'flicker',
  'testament',
  'embodiment',
  'etched with',
  'rise and fall',
  'the very air',
  'slither',
  'a pang of',
  'eternal',
  'eternity',
  'veil of',
  'painting the',
  'bathed in',
  'boundless',
  'stretched out',
  'beneath',
  'lullaby',
  'unsuspecting',
  'handsome',
  'defied the very',
  'barely above',
  'never-ending',
  'caress',
  'realm',
  'fiery',
  'raven',
  'twin pools',
  'gloaming',
  'grimy',
  'labyrinth',
  'the very notion',
  'something...',
  'the halls of',
  'conflagration of',
  'shattered like',
  'as dark as',
  'yearned for',
  'unyielding',
  'lifetime',
  'ensnared',
];

export const HERETIC_PROFILES: HereticConfigProfile[] = [
  {
    id: 'default',
    label: 'Default Uncensored',
    sourceFile: 'config.default.toml',
    summary:
      'Directional orthogonalization preset from 0xSojalSec/Uncensored-AI targeting standard refusal vectors while constraining KL divergence via Optuna TPE.',
    dtypes: ['auto', 'float16', 'bfloat16', 'float32'],
    quantization: 'none',
    deviceMap: 'auto',
    offloadOutputsToCpu: true,
    batchSize: 0,
    maxBatchSize: 128,
    maxResponseLength: 100,
    chainOfThoughtSkips: CHAIN_OF_THOUGHT_SKIPS,
    klDivergenceScale: 1.0,
    klDivergenceTarget: 0.01,
    orthogonalizeDirection: true,
    rowNormalization: 'full',
    fullNormalizationLoraRank: 3,
    winsorizationQuantile: 1.0,
    nTrials: 200,
    nStartupTrials: 60,
    maxShardSize: '5GB',
    systemPrompt: 'You are a helpful assistant.',
    refusalMarkers: DEFAULT_REFUSAL_MARKERS,
    goodPrompts: {
      dataset: 'mlabonne/harmless_alpaca',
      split: 'train[:400]',
      column: 'text',
      residualPlotLabel: '"Harmless" prompts',
      residualPlotColor: 'royalblue',
    },
    badPrompts: {
      dataset: 'mlabonne/harmful_behaviors',
      split: 'train[:400]',
      column: 'text',
      residualPlotLabel: '"Harmful" prompts',
      residualPlotColor: 'darkorange',
    },
    goodEvaluationPrompts: {
      dataset: 'mlabonne/harmless_alpaca',
      split: 'test[:100]',
      column: 'text',
    },
    badEvaluationPrompts: {
      dataset: 'mlabonne/harmful_behaviors',
      split: 'test[:100]',
      column: 'text',
    },
  },
  {
    id: 'nohumor',
    label: 'No-Humor Suppression',
    sourceFile: 'config.nohumor.toml',
    summary:
      'Isolates and orthogonalizes comedic/joke residual directions using UnstableLlama/jokes vs. mlabonne/harmless_alpaca.',
    dtypes: ['auto', 'float16', 'bfloat16', 'float32'],
    quantization: 'none',
    deviceMap: 'auto',
    offloadOutputsToCpu: true,
    batchSize: 0,
    maxBatchSize: 128,
    maxResponseLength: 300,
    chainOfThoughtSkips: CHAIN_OF_THOUGHT_SKIPS,
    klDivergenceScale: 1.0,
    klDivergenceTarget: 0.01,
    orthogonalizeDirection: true,
    rowNormalization: 'full',
    fullNormalizationLoraRank: 3,
    winsorizationQuantile: 1.0,
    nTrials: 200,
    nStartupTrials: 60,
    maxShardSize: '5GB',
    systemPrompt: 'You are a direct, strictly literal technical assistant. Never tell jokes or use humor.',
    refusalMarkers: NO_HUMOR_MARKERS,
    goodPrompts: {
      dataset: 'mlabonne/harmless_alpaca',
      split: 'train[:400]',
      column: 'text',
      residualPlotLabel: 'Serious prompts',
      residualPlotColor: 'royalblue',
    },
    badPrompts: {
      dataset: 'UnstableLlama/jokes',
      split: 'train[:200]',
      column: 'text',
      residualPlotLabel: 'Humorous prompts',
      residualPlotColor: 'darkorange',
    },
    goodEvaluationPrompts: {
      dataset: 'mlabonne/harmless_alpaca',
      split: 'test[:100]',
      column: 'text',
    },
    badEvaluationPrompts: {
      dataset: 'UnstableLlama/jokes',
      split: 'train[200:250]',
      column: 'text',
    },
  },
  {
    id: 'noslop',
    label: 'No-Slop Prose Gate',
    sourceFile: 'config.noslop.toml',
    summary:
      'Suppresses purple prose and repetitive AI literary clichés across 121 tracked slop markers on llm-aes/writing-prompts.',
    dtypes: ['auto', 'float16', 'bfloat16', 'float32'],
    quantization: 'none',
    deviceMap: 'auto',
    offloadOutputsToCpu: true,
    batchSize: 0,
    maxBatchSize: 128,
    maxResponseLength: 300,
    chainOfThoughtSkips: CHAIN_OF_THOUGHT_SKIPS,
    klDivergenceScale: 1.0,
    klDivergenceTarget: 0.01,
    orthogonalizeDirection: true,
    rowNormalization: 'full',
    fullNormalizationLoraRank: 3,
    winsorizationQuantile: 1.0,
    nTrials: 200,
    nStartupTrials: 60,
    maxShardSize: '5GB',
    systemPrompt:
      'You are a professional writer. Write crisp, concrete prose and strictly avoid purple prose, overused fantasy clichés, and flowery filler.',
    refusalMarkers: NO_SLOP_MARKERS,
    goodPrompts: {
      dataset: 'llm-aes/writing-prompts',
      split: 'train[:500]',
      column: 'prompt',
      prefix:
        'Write a short story based on the writing prompt below. Avoid literary cliches, purple prose, and flowery language.\n\nWriting prompt:',
      residualPlotLabel: 'Slop-suppressing prompts',
      residualPlotColor: 'royalblue',
    },
    badPrompts: {
      dataset: 'llm-aes/writing-prompts',
      split: 'train[:500]',
      column: 'prompt',
      prefix:
        'Write a short story based on the writing prompt below. Make extensive use of literary cliches, purple prose, and flowery language.\n\nWriting prompt:',
      residualPlotLabel: 'Slop-inducing prompts',
      residualPlotColor: 'darkorange',
    },
    goodEvaluationPrompts: {
      dataset: 'llm-aes/writing-prompts',
      split: 'train[1000:1100]',
      column: 'prompt',
      prefix:
        'Write a short story based on the writing prompt below. Avoid literary cliches, purple prose, and flowery language.\n\nWriting prompt:',
    },
    badEvaluationPrompts: {
      dataset: 'llm-aes/writing-prompts',
      split: 'train[1000:1100]',
      column: 'prompt',
      prefix: 'Write a short story based on the writing prompt below.\n\nWriting prompt:',
    },
  },
  {
    id: 'liquidos_sovereign',
    label: 'LiquidOS Sovereign T6',
    sourceFile: 'LiquidOS-Strata-T6',
    summary:
      'Combines Uncensored-AI refusal marker auditing with LiquidOS Honesty-First qualifier preservation and PaR v1.0 response verification.',
    dtypes: ['auto', 'bfloat16', 'float16'],
    quantization: 'bnb_4bit',
    deviceMap: 'auto',
    offloadOutputsToCpu: true,
    batchSize: 0,
    maxBatchSize: 64,
    maxResponseLength: 512,
    chainOfThoughtSkips: CHAIN_OF_THOUGHT_SKIPS,
    klDivergenceScale: 1.0,
    klDivergenceTarget: 0.01,
    orthogonalizeDirection: true,
    rowNormalization: 'full',
    fullNormalizationLoraRank: 3,
    winsorizationQuantile: 0.95,
    nTrials: 200,
    nStartupTrials: 60,
    maxShardSize: '5GB',
    systemPrompt:
      'You are the LiquidOS Sovereign Research Assistant. Answer technical, architectural, and systems-engineering questions directly without boilerplate disclaimers. Always preserve explicit qualifiers, distinguish EXECUTED vs. PLANNED states honestly, and never fabricate file paths, checksums, or benchmark outputs.',
    refusalMarkers: DEFAULT_REFUSAL_MARKERS,
    goodPrompts: {
      dataset: 'mlabonne/harmless_alpaca',
      split: 'train[:400]',
      column: 'text',
      residualPlotLabel: 'Sovereign direct prompts',
      residualPlotColor: 'royalblue',
    },
    badPrompts: {
      dataset: 'mlabonne/harmful_behaviors',
      split: 'train[:400]',
      column: 'text',
      residualPlotLabel: 'Refusal-trigger prompts',
      residualPlotColor: 'darkorange',
    },
    goodEvaluationPrompts: {
      dataset: 'mlabonne/harmless_alpaca',
      split: 'test[:100]',
      column: 'text',
    },
    badEvaluationPrompts: {
      dataset: 'mlabonne/harmful_behaviors',
      split: 'test[:100]',
      column: 'text',
    },
  },
];

export const HERETIC_MODULES: HereticModuleSpec[] = [
  {
    file: 'src/heretic/main.py',
    role: 'Optuna TPE study orchestrator, KL divergence + refusal count Pareto co-optimization, export & HF upload pipeline',
    keySymbols: ['TPESampler', 'JournalStorage', 'obtain_export_strategy', 'lm_eval'],
    liquidOsBridge: 'Maps to Strata MoE Tier T6 offline weight-abliteration prep before Ollama/llama.cpp quantization.',
  },
  {
    file: 'src/heretic/model.py',
    role: 'Transformer loader (AutoModelForCausalLM / Gemma / Mistral / Qwen3.5 MoE), directional orthogonalization & full row-norm LoRA adapter',
    keySymbols: ['AbliterationParameters', 'Model', 'get_model_class', 'bnb_4bit'],
    liquidOsBridge: 'Targets 27B Q6_K Primary and DeepSeek-V4.1-Flash-Uncensored checkpoints on host GPU.',
  },
  {
    file: 'src/heretic/analyzer.py',
    role: 'Per-layer residual stream extractor, winsorization clamping, and harmless vs. harmful contrast-vector calculation',
    keySymbols: ['Analyzer', 'winsorization_quantile', 'orthogonalize_direction'],
    liquidOsBridge: 'Feeds D3/ECharts geometry views and PaR v1.0 drift baseline telemetry.',
  },
  {
    file: 'src/heretic/evaluator.py',
    role: 'Batched logprob KL divergence evaluator and Chain-of-Thought-aware refusal marker counter',
    keySymbols: ['Evaluator', 'chain_of_thought_skips', 'refusal_markers'],
    liquidOsBridge: 'Remade directly in TypeScript (`src/lib/hereticEngine.ts`) for live browser/server chat auditing.',
  },
  {
    file: 'src/heretic/config.py',
    role: 'Pydantic BaseSettings TOML/CLI/Env schema with privacy-annotated residual plotting excludes',
    keySymbols: ['Settings', 'QuantizationMethod', 'RowNormalization', 'DatasetSpecification'],
    liquidOsBridge: 'Remade as typed `HereticConfigProfile` + live `config.toml` generator in Workbench.',
  },
  {
    file: 'src/heretic/reproduce.py',
    role: 'Reproducibility bundler collecting environment state, dependencies, and deterministic weight SHA-256 manifests',
    keySymbols: ['collect_reproducibles', 'load_reproduction_information', 'check_environment'],
    liquidOsBridge: 'Aligns with LiquidOS SHA-256 Canonical Ledger & Honesty-First artifact provenance.',
  },
];

export const HERETIC_TEST_SUITES: HereticTestSuiteSpec[] = [
  {
    suite: 'gemma-4e',
    configPath: 'tests/gemma-4e/config.toml',
    targetModelClass: 'Gemma 4E Multimodal/CausalLM',
    checksumTargets: ['SHA256SUMS.ci', 'SHA256SUMS.ci2', 'SHA256SUMS.linux', 'SHA256SUMS.windows'],
    status: 'HOST_PYTORCH_REQUIRED',
  },
  {
    suite: 'mistral-3',
    configPath: 'tests/mistral-3/config.toml',
    targetModelClass: 'Mistral 3 Instruct',
    checksumTargets: ['SHA256SUMS.ci', 'SHA256SUMS.ci2', 'SHA256SUMS.linux', 'SHA256SUMS.windows'],
    status: 'HOST_PYTORCH_REQUIRED',
  },
  {
    suite: 'qwen3.5-moe',
    configPath: 'tests/qwen3.5-moe/config.toml',
    targetModelClass: 'Qwen 3.5 Mixture-of-Experts',
    checksumTargets: ['SHA256SUMS.ci', 'SHA256SUMS.linux', 'SHA256SUMS.windows'],
    status: 'HOST_PYTORCH_REQUIRED',
  },
];
