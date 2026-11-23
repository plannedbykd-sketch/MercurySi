import assert from 'node:assert/strict';
import { buildParTestPresets, validateParJson } from '../src/lib/parValidator.ts';
import {
  computeCanonicalEntry,
  computeLegacySwiftEntry,
  packWireGuard5FieldFrame,
  verifyLedgerChain,
  type LedgerEntry,
} from '../src/lib/canonicalLedger.ts';
import { HERETIC_PROFILES } from '../src/data/hereticProfiles.ts';
import {
  computeAbliterationObjective,
  evaluateHereticResponse,
  generateHereticToml,
  stripChainOfThought,
} from '../src/lib/hereticEngine.ts';

async function main() {
  // 1. Verify all 4 PaR v1.0 test presets
  const presets = await buildParTestPresets();
  const resPass = await validateParJson(presets.PASS);
  assert.equal(resPass.exit_code, 0);
  assert.equal(resPass.status, 'PASS');
  assert.equal(resPass.institutional_audit_required, true);

  const resDrift = await validateParJson(presets.DRIFT);
  assert.equal(resDrift.exit_code, 1);
  assert.equal(resDrift.status, 'DRIFT');

  const resFailover = await validateParJson(presets.FAILOVER_REQUIRED);
  assert.equal(resFailover.exit_code, 1);
  assert.equal(resFailover.status, 'FAILOVER_REQUIRED');

  const resStruct = await validateParJson(presets.STRUCTURAL_ERROR);
  assert.equal(resStruct.exit_code, 2);
  assert.equal(resStruct.status, 'STRUCTURAL_ERROR');

  // 2. Verify canonical chain + tamper quarantine
  const zero = '0'.repeat(64);
  const c1 = await computeCanonicalEntry(1, zero, 'rec-1');
  const c2 = await computeCanonicalEntry(2, c1.entryHash, 'rec-2');
  const entries: LedgerEntry[] = [
    {
      seq: 1,
      ts: '2026-11-23T00:00:00Z',
      mode: 'canonical_v2',
      payload: 'rec-1',
      prevHash: zero,
      payloadDigest: c1.payloadDigest,
      entryHash: c1.entryHash,
    },
    {
      seq: 2,
      ts: '2026-11-23T00:00:01Z',
      mode: 'canonical_v2',
      payload: 'rec-2',
      prevHash: c1.entryHash,
      payloadDigest: c2.payloadDigest,
      entryHash: c2.entryHash,
    },
  ];
  const okCheck = await verifyLedgerChain(entries);
  assert.equal(okCheck.valid, true);
  assert.equal(okCheck.quarantined, false);

  const tampered = [{ ...entries[0] }, { ...entries[1], payload: 'rec-2-tampered' }];
  const badCheck = await verifyLedgerChain(tampered);
  assert.equal(badCheck.valid, false);
  assert.equal(badCheck.quarantined, true);
  assert.equal(badCheck.failedAtSeq, 2);

  // 3. Verify legacy Swift chain
  const s1 = await computeLegacySwiftEntry(zero, 'swift-rec-1');
  assert.equal(s1.entryHash.length, 64);

  // 4. Verify 1,232-byte WireGuard 5-field MTU check
  const wgOk = packWireGuard5FieldFrame({
    finding_id: 'F-1',
    timestamp: 1763930000,
    cell_tower: '310-410',
    surface: 'android-arm64',
    severity_status: 'PASS',
  });
  assert.equal(wgOk.withinMtu, true);

  const wgTooBig = packWireGuard5FieldFrame({
    finding_id: 'F-2',
    timestamp: 1763930000,
    cell_tower: '310-410',
    surface: 'x'.repeat(1300),
    severity_status: 'DRIFT',
  });
  assert.equal(wgTooBig.withinMtu, false);

  // 5. Verify Uncensored-AI (Heretic) CoT stripping, marker auditing, objective & TOML serializer
  const cotSample = '<think>Internal analysis: sorry I cannot say that.</think>\nDirect answer: AF_UNIX uses SO_PEERCRED.';
  const cotStripped = stripChainOfThought(cotSample);
  assert.equal(cotStripped.visibleResponse, 'Direct answer: AF_UNIX uses SO_PEERCRED.');
  assert.ok(cotStripped.thoughtTrace?.includes('Internal analysis'));

  const defaultProfile = HERETIC_PROFILES[0];
  const cleanEval = evaluateHereticResponse(cotSample, defaultProfile.refusalMarkers);
  assert.equal(cleanEval.verdict, 'UNFILTERED');
  assert.equal(cleanEval.matchCount, 0);

  const hitEval = evaluateHereticResponse(
    'As an AI language model, I cannot fulfill that request.',
    defaultProfile.refusalMarkers
  );
  assert.equal(hitEval.verdict, 'MARKER_HIT');
  assert.ok(hitEval.matchedMarkers.includes('as an ai'));
  assert.ok(hitEval.matchedMarkers.includes('i cannot'));

  const obj = computeAbliterationObjective(0.08, 3, 100, 1.0, 0.01);
  assert.equal(obj.targetSatisfied, true);
  assert.equal(obj.compositeObjective, 0.11);

  const toml = generateHereticToml(defaultProfile);
  assert.ok(toml.includes('orthogonalize_direction = true'));
  assert.ok(toml.includes('row_normalization = "full"'));
  assert.ok(toml.includes('[good_prompts]'));

  console.log('ALL_TS_ENGINE_CHECKS_PASSED');
}

main();
