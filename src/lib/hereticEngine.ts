import {
  CHAIN_OF_THOUGHT_SKIPS,
  type HereticConfigProfile,
} from '../data/hereticProfiles.ts';

export interface CotStripResult {
  thoughtTrace: string | null;
  visibleResponse: string;
  strippedChars: number;
  matchedPattern: string | null;
}

export interface HereticEvaluationResult {
  verdict: 'UNFILTERED' | 'MARKER_HIT';
  matchCount: number;
  matchedMarkers: string[];
  cleanResponseLength: number;
  thoughtTrace: string | null;
  visibleResponse: string;
  strippedChars: number;
}

export interface AbliterationScoreResult {
  klPenalty: number;
  refusalRatio: number;
  targetSatisfied: boolean;
  compositeObjective: number;
}

/**
 * Strips Chain-of-Thought reasoning blocks matching Heretic's `chain_of_thought_skips`
 * before running marker evaluation on the actual assistant answer.
 */
export function stripChainOfThought(
  rawText: string,
  skipPairs: Array<[string, string]> = CHAIN_OF_THOUGHT_SKIPS
): CotStripResult {
  const input = rawText ?? '';
  let bestTrace: string | null = null;
  let visible = input;
  let matchedPattern: string | null = null;

  for (const [openMarker, closedComposite] of skipPairs) {
    if (!openMarker) continue;
    let closeMarker = closedComposite;
    if (closedComposite.startsWith(openMarker)) {
      closeMarker = closedComposite.slice(openMarker.length);
    }
    if (!closeMarker) continue;

    const startIdx = visible.indexOf(openMarker);
    if (startIdx === -1) continue;

    const afterOpen = startIdx + openMarker.length;
    const endIdx = visible.indexOf(closeMarker, afterOpen);
    if (endIdx !== -1) {
      const traceSegment = visible.slice(afterOpen, endIdx).trim();
      bestTrace = bestTrace ? `${bestTrace}\n\n${traceSegment}` : traceSegment;
      visible = (
        visible.slice(0, startIdx) + visible.slice(endIdx + closeMarker.length)
      ).trim();
      matchedPattern = `${openMarker}…${closeMarker}`;
    } else {
      // Streaming in-progress reasoning block before closing tag arrives
      const traceSegment = visible.slice(afterOpen).trim();
      bestTrace = bestTrace ? `${bestTrace}\n\n${traceSegment}` : traceSegment;
      visible = visible.slice(0, startIdx).trim();
      matchedPattern = `${openMarker} (streaming)`;
    }
  }

  return {
    thoughtTrace: bestTrace && bestTrace.length > 0 ? bestTrace : null,
    visibleResponse: visible,
    strippedChars: Math.max(0, input.length - visible.length),
    matchedPattern,
  };
}

/**
 * TypeScript port of `src/heretic/evaluator.py` refusal/humor/slop marker counter.
 * Case-insensitive substring match against the visible (post-CoT) response text.
 */
export function evaluateHereticResponse(
  rawText: string,
  markers: string[],
  skipPairs: Array<[string, string]> = CHAIN_OF_THOUGHT_SKIPS
): HereticEvaluationResult {
  const stripped = stripChainOfThought(rawText, skipPairs);
  const haystack = stripped.visibleResponse.toLowerCase();

  const seen = new Set<string>();
  const matchedMarkers: string[] = [];

  for (const marker of markers) {
    const cleaned = marker.trim();
    if (!cleaned) continue;
    const needle = cleaned.toLowerCase();
    if (haystack.includes(needle) && !seen.has(needle)) {
      seen.add(needle);
      matchedMarkers.push(cleaned);
    }
  }

  return {
    verdict: matchedMarkers.length === 0 ? 'UNFILTERED' : 'MARKER_HIT',
    matchCount: matchedMarkers.length,
    matchedMarkers,
    cleanResponseLength: stripped.visibleResponse.length,
    thoughtTrace: stripped.thoughtTrace,
    visibleResponse: stripped.visibleResponse,
    strippedChars: stripped.strippedChars,
  };
}

/**
 * Mirrors Heretic's co-optimization scalar objective (`main.py`) balancing
 * KL divergence against refusal count gated by `kl_divergence_target`.
 */
export function computeAbliterationObjective(
  klDivergence: number,
  refusalCount: number,
  totalEvalPrompts: number,
  klScale: number,
  klTarget: number
): AbliterationScoreResult {
  const safeTotal = Math.max(1, totalEvalPrompts);
  const safeScale = Math.max(0.0001, klScale);
  const refusalRatio = Math.max(0, refusalCount) / safeTotal;
  const klPenalty = Math.max(0, klDivergence) / safeScale;
  const targetSatisfied = klDivergence >= klTarget;

  // Below kl_divergence_target, optimizer focuses on driving refusal ratio down first;
  // above target, combines normalized KL divergence penalty and refusal ratio.
  const compositeObjective = targetSatisfied
    ? Number((refusalRatio + klPenalty).toFixed(4))
    : Number((refusalRatio + Math.abs(klTarget - klDivergence) * 2).toFixed(4));

  return {
    klPenalty: Number(klPenalty.toFixed(4)),
    refusalRatio: Number(refusalRatio.toFixed(4)),
    targetSatisfied,
    compositeObjective,
  };
}

function escapeTomlString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function renderTomlStringArray(items: string[]): string {
  if (items.length === 0) return '[]';
  const lines = items.map((item) => `  "${escapeTomlString(item)}",`);
  return `[\n${lines.join('\n')}\n]`;
}

/**
 * Serializes a HereticConfigProfile to valid TOML matching `0xSojalSec/Uncensored-AI`.
 */
export function generateHereticToml(config: HereticConfigProfile): string {
  const sections: string[] = [
    '# Generated by LiquidOS × Uncensored-AI (Heretic Workbench)',
    '# Source topology: https://github.com/0xSojalSec/Uncensored-AI',
    '',
    `dtypes = ${renderTomlStringArray(config.dtypes)}`,
    `quantization = "${config.quantization}"`,
    `device_map = "${escapeTomlString(config.deviceMap)}"`,
    `offload_outputs_to_cpu = ${config.offloadOutputsToCpu}`,
    `batch_size = ${config.batchSize}`,
    `max_batch_size = ${config.maxBatchSize}`,
    `max_response_length = ${config.maxResponseLength}`,
    '',
    `kl_divergence_scale = ${config.klDivergenceScale}`,
    `kl_divergence_target = ${config.klDivergenceTarget}`,
    `orthogonalize_direction = ${config.orthogonalizeDirection}`,
    `row_normalization = "${config.rowNormalization}"`,
    `full_normalization_lora_rank = ${config.fullNormalizationLoraRank}`,
    `winsorization_quantile = ${config.winsorizationQuantile}`,
    '',
    `n_trials = ${config.nTrials}`,
    `n_startup_trials = ${config.nStartupTrials}`,
    `max_shard_size = "${escapeTomlString(config.maxShardSize)}"`,
    `system_prompt = "${escapeTomlString(config.systemPrompt)}"`,
    '',
    `refusal_markers = ${renderTomlStringArray(config.refusalMarkers)}`,
    '',
    '[good_prompts]',
    `dataset = "${escapeTomlString(config.goodPrompts.dataset)}"`,
    `split = "${escapeTomlString(config.goodPrompts.split)}"`,
    `column = "${escapeTomlString(config.goodPrompts.column)}"`,
  ];

  if (config.goodPrompts.prefix) {
    sections.push(`prefix = "${escapeTomlString(config.goodPrompts.prefix)}"`);
  }

  sections.push(
    '',
    '[bad_prompts]',
    `dataset = "${escapeTomlString(config.badPrompts.dataset)}"`,
    `split = "${escapeTomlString(config.badPrompts.split)}"`,
    `column = "${escapeTomlString(config.badPrompts.column)}"`
  );
  if (config.badPrompts.prefix) {
    sections.push(`prefix = "${escapeTomlString(config.badPrompts.prefix)}"`);
  }

  sections.push(
    '',
    '[good_evaluation_prompts]',
    `dataset = "${escapeTomlString(config.goodEvaluationPrompts.dataset)}"`,
    `split = "${escapeTomlString(config.goodEvaluationPrompts.split)}"`,
    `column = "${escapeTomlString(config.goodEvaluationPrompts.column)}"`,
    '',
    '[bad_evaluation_prompts]',
    `dataset = "${escapeTomlString(config.badEvaluationPrompts.dataset)}"`,
    `split = "${escapeTomlString(config.badEvaluationPrompts.split)}"`,
    `column = "${escapeTomlString(config.badEvaluationPrompts.column)}"`,
    ''
  );

  return sections.join('\n');
}

export function buildHereticCliCommand(
  hfModelId: string,
  config: HereticConfigProfile
): string {
  const safeModel = hfModelId.trim() || 'Qwen/Qwen3-4B-Instruct-2507';
  const flags: string[] = [`uv run heretic ${safeModel}`];
  if (config.quantization === 'bnb_4bit') {
    flags.push('--quantization bnb_4bit');
  }
  flags.push(`--n-trials ${config.nTrials}`);
  flags.push(`--row-normalization ${config.rowNormalization}`);
  if (config.winsorizationQuantile < 1.0) {
    flags.push(`--winsorization-quantile ${config.winsorizationQuantile}`);
  }
  return flags.join(' ');
}
