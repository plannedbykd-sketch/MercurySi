export type ParStatus = 'PASS' | 'DRIFT' | 'FAILOVER_REQUIRED' | 'STRUCTURAL_ERROR';

export interface ParStepInput {
  step_index: number;
  prev_step_hash: string;
  inference_id: string;
  cold_start_attested: boolean;
  qualifier_preserved: boolean;
  overclaim_detected: boolean;
  output_payload: string;
  output_sha256: string;
}

export interface ParArtifactInput {
  par_version: string;
  architecture: {
    hash: string;
  };
  non_claims: {
    shared_memory: boolean;
    deterministic_compiler: boolean;
    autonomous_failover: boolean;
  };
  steps: ParStepInput[];
  consecutive_drift_count?: number;
}

export interface StepCheckDetail {
  stepIndex: number;
  inferenceId: string;
  structuralOk: boolean;
  hashMatches: boolean;
  computedSha256: string;
  declaredSha256: string;
  coldStartAttested: boolean;
  qualifierPreserved: boolean;
  overclaimDetected: boolean;
  note: string;
}

export interface ParValidationResult {
  exit_code: 0 | 1 | 2;
  status: ParStatus;
  institutional_audit_required: boolean;
  reason: string;
  step_details: StepCheckDetail[];
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Prefixed(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  return `sha256:${await sha256Hex(bytes)}`;
}

function isValidSha256Prefixed(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('sha256:')) {
    return false;
  }
  const hex = value.slice('sha256:'.length);
  return /^[0-9a-fA-F]{64}$/.test(hex);
}

export async function validateParJson(rawJson: string): Promise<ParValidationResult> {
  let doc: ParArtifactInput;
  try {
    doc = JSON.parse(rawJson) as ParArtifactInput;
  } catch {
    return {
      exit_code: 2,
      status: 'STRUCTURAL_ERROR',
      institutional_audit_required: true,
      reason: 'Malformed JSON payload',
      step_details: [],
    };
  }

  if (
    !doc ||
    typeof doc !== 'object' ||
    doc.par_version !== '1.0' ||
    !doc.architecture ||
    !isValidSha256Prefixed(doc.architecture.hash) ||
    !doc.non_claims ||
    !Array.isArray(doc.steps) ||
    doc.steps.length === 0
  ) {
    return {
      exit_code: 2,
      status: 'STRUCTURAL_ERROR',
      institutional_audit_required: true,
      reason: 'Phase A failed: invalid par_version, missing architecture.hash, or empty steps',
      step_details: [],
    };
  }

  // Phase A: check_structure -> Exit Code 2
  let expectedPrev = `sha256:${'0'.repeat(64)}`;
  const seenIds = new Set<string>();
  const stepDetails: StepCheckDetail[] = [];

  for (let idx = 0; idx < doc.steps.length; idx++) {
    const step = doc.steps[idx];
    const computedSha = await sha256Prefixed(String(step.output_payload ?? ''));
    const validHashes =
      isValidSha256Prefixed(step.output_sha256) && isValidSha256Prefixed(step.prev_step_hash);
    const idOk = typeof step.inference_id === 'string' && step.inference_id.length > 0 && !seenIds.has(step.inference_id);
    if (typeof step.inference_id === 'string' && step.inference_id.length > 0) {
      seenIds.add(step.inference_id);
    }

    const structuralOk =
      step.step_index === idx &&
      validHashes &&
      step.prev_step_hash === expectedPrev &&
      idOk;

    stepDetails.push({
      stepIndex: idx,
      inferenceId: String(step.inference_id ?? ''),
      structuralOk,
      hashMatches: computedSha === step.output_sha256,
      computedSha256: computedSha,
      declaredSha256: String(step.output_sha256 ?? ''),
      coldStartAttested: Boolean(step.cold_start_attested),
      qualifierPreserved: Boolean(step.qualifier_preserved),
      overclaimDetected: Boolean(step.overclaim_detected),
      note: structuralOk ? 'Structure valid' : `Chain/index/inference_id error at step ${idx}`,
    });

    if (!structuralOk) {
      return {
        exit_code: 2,
        status: 'STRUCTURAL_ERROR',
        institutional_audit_required: true,
        reason: `Phase A failed at step ${idx}: linear index, prev_step_hash, or unique inference_id violated`,
        step_details: stepDetails,
      };
    }

    expectedPrev = step.output_sha256;
  }

  // Phase B: validate -> Exit Code 0 or Exit Code 1
  if (
    doc.non_claims.shared_memory ||
    doc.non_claims.deterministic_compiler ||
    doc.non_claims.autonomous_failover
  ) {
    return {
      exit_code: 1,
      status: 'DRIFT',
      institutional_audit_required: true,
      reason: 'Phase B failed: non_claims fields must all be false',
      step_details: stepDetails,
    };
  }

  let driftCount = typeof doc.consecutive_drift_count === 'number' ? doc.consecutive_drift_count : 0;

  for (let idx = 0; idx < doc.steps.length; idx++) {
    const step = doc.steps[idx];
    const detail = stepDetails[idx];
    const hasDrift =
      !detail.hashMatches ||
      !step.cold_start_attested ||
      !step.qualifier_preserved ||
      step.overclaim_detected;

    if (hasDrift) {
      driftCount += 1;
      detail.note = !detail.hashMatches
        ? 'output_sha256 mismatch'
        : !step.cold_start_attested
          ? 'cold_start_attested is false'
          : !step.qualifier_preserved
            ? 'qualifier_preserved is false'
            : 'overclaim_detected is true';

      const status: ParStatus = driftCount >= 2 ? 'FAILOVER_REQUIRED' : 'DRIFT';
      return {
        exit_code: 1,
        status,
        institutional_audit_required: true,
        reason: `Phase B ${status} at step ${idx}: ${detail.note}`,
        step_details: stepDetails,
      };
    }
  }

  return {
    exit_code: 0,
    status: 'PASS',
    institutional_audit_required: true,
    reason: 'All structural and semantic cold-start checks passed; external human architecture.hash audit required.',
    step_details: stepDetails,
  };
}

export async function buildParTestPresets(): Promise<Record<'PASS' | 'DRIFT' | 'FAILOVER_REQUIRED' | 'STRUCTURAL_ERROR', string>> {
  const zeroHash = `sha256:${'0'.repeat(64)}`;
  const archHash = `sha256:${'a'.repeat(64)}`;
  const p0 = 'Cold-start attestation step 0: Rust FFI arena enforces generational handles.';
  const h0 = await sha256Prefixed(p0);
  const p1 = 'Step 1: Host compilation remains PLANNED until local cargo/xcodebuild runs.';
  const h1 = await sha256Prefixed(p1);

  const passDoc: ParArtifactInput = {
    par_version: '1.0',
    architecture: { hash: archHash },
    non_claims: {
      shared_memory: false,
      deterministic_compiler: false,
      autonomous_failover: false,
    },
    consecutive_drift_count: 0,
    steps: [
      {
        step_index: 0,
        prev_step_hash: zeroHash,
        inference_id: 'inf-cold-001',
        cold_start_attested: true,
        qualifier_preserved: true,
        overclaim_detected: false,
        output_payload: p0,
        output_sha256: h0,
      },
      {
        step_index: 1,
        prev_step_hash: h0,
        inference_id: 'inf-cold-002',
        cold_start_attested: true,
        qualifier_preserved: true,
        overclaim_detected: false,
        output_payload: p1,
        output_sha256: h1,
      },
    ],
  };

  const driftDoc: ParArtifactInput = {
    ...passDoc,
    consecutive_drift_count: 0,
    steps: [
      passDoc.steps[0],
      {
        ...passDoc.steps[1],
        qualifier_preserved: false,
      },
    ],
  };

  const failoverDoc: ParArtifactInput = {
    ...passDoc,
    consecutive_drift_count: 1,
    steps: [
      passDoc.steps[0],
      {
        ...passDoc.steps[1],
        overclaim_detected: true,
      },
    ],
  };

  const structuralDoc: ParArtifactInput = {
    ...passDoc,
    steps: [
      passDoc.steps[0],
      {
        ...passDoc.steps[1],
        inference_id: 'inf-cold-001', // Duplicate inference_id -> Exit Code 2
      },
    ],
  };

  return {
    PASS: JSON.stringify(passDoc, null, 2),
    DRIFT: JSON.stringify(driftDoc, null, 2),
    FAILOVER_REQUIRED: JSON.stringify(failoverDoc, null, 2),
    STRUCTURAL_ERROR: JSON.stringify(structuralDoc, null, 2),
  };
}
