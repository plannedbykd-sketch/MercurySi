import { sha256Hex } from './parValidator';

export type LedgerMode = 'canonical_v2' | 'legacy_swift_v4';

export interface LedgerEntry {
  seq: number;
  ts: string;
  mode: LedgerMode;
  payload: string;
  prevHash: string;
  payloadDigest: string;
  entryHash: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  quarantined: boolean;
  failedAtSeq: number | null;
  reason: string;
}

export interface WgReportFrame {
  finding_id: string;
  timestamp: number;
  cell_tower: string;
  surface: string;
  severity_status: string;
}

export interface WgPackResult {
  withinMtu: boolean;
  byteLength: number;
  maxBytes: number;
  serializedJson: string;
  remainingBytes: number;
}

export const WG_MAX_FRAME_BYTES = 1232;

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function u64BeBytes(seq: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigUint64(0, BigInt(seq), false);
  return new Uint8Array(buf);
}

export async function computeCanonicalEntry(
  seq: number,
  prevHashHex: string,
  payloadText: string
): Promise<{ payloadDigest: string; entryHash: string }> {
  const payloadBytes = new TextEncoder().encode(payloadText);
  const payloadDigestHex = await sha256Hex(payloadBytes);
  const payloadDigestBytes = hexToBytes(payloadDigestHex);
  const prevHashBytes = hexToBytes(prevHashHex);
  const seqBytes = u64BeBytes(seq);

  // SHA256(seq_u64_be || prev_hash_32 || 0x00 || SHA256(payload))
  const preimage = new Uint8Array(8 + 32 + 1 + 32);
  preimage.set(seqBytes, 0);
  preimage.set(prevHashBytes, 8);
  preimage[40] = 0x00;
  preimage.set(payloadDigestBytes, 41);

  const entryHash = await sha256Hex(preimage);
  return { payloadDigest: payloadDigestHex, entryHash };
}

export async function computeLegacySwiftEntry(
  prevHashHex: string,
  payloadText: string
): Promise<{ payloadDigest: string; entryHash: string }> {
  const payloadBytes = new TextEncoder().encode(payloadText);
  const payloadDigest = await sha256Hex(payloadBytes);
  const prevHashBytes = hexToBytes(prevHashHex);

  // H_k = SHA256(R_k || H_{k-1})
  const preimage = new Uint8Array(payloadBytes.length + prevHashBytes.length);
  preimage.set(payloadBytes, 0);
  preimage.set(prevHashBytes, payloadBytes.length);

  const entryHash = await sha256Hex(preimage);
  return { payloadDigest, entryHash };
}

export async function verifyLedgerChain(entries: LedgerEntry[]): Promise<ChainVerificationResult> {
  let expectedPrev = '0'.repeat(64);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.seq !== i + 1) {
      return {
        valid: false,
        quarantined: true,
        failedAtSeq: entry.seq,
        reason: `Sequence discontinuity at index ${i}: expected ${i + 1}, got ${entry.seq}`,
      };
    }
    if (entry.prevHash !== expectedPrev) {
      return {
        valid: false,
        quarantined: true,
        failedAtSeq: entry.seq,
        reason: `prevHash mismatch at seq ${entry.seq}`,
      };
    }
    const recomputed =
      entry.mode === 'canonical_v2'
        ? await computeCanonicalEntry(entry.seq, entry.prevHash, entry.payload)
        : await computeLegacySwiftEntry(entry.prevHash, entry.payload);

    if (recomputed.entryHash !== entry.entryHash) {
      return {
        valid: false,
        quarantined: true,
        failedAtSeq: entry.seq,
        reason: `Hash mismatch at seq ${entry.seq}: QUARANTINE triggered`,
      };
    }
    expectedPrev = entry.entryHash;
  }

  return {
    valid: true,
    quarantined: false,
    failedAtSeq: null,
    reason: entries.length === 0 ? 'Empty genesis ledger' : `Verified ${entries.length} chained records`,
  };
}

export function packWireGuard5FieldFrame(frame: WgReportFrame): WgPackResult {
  const strictFiveFields: WgReportFrame = {
    finding_id: frame.finding_id,
    timestamp: Math.floor(Number(frame.timestamp) || 0),
    cell_tower: frame.cell_tower,
    surface: frame.surface,
    severity_status: frame.severity_status,
  };
  const serializedJson = JSON.stringify(strictFiveFields);
  const byteLength = new TextEncoder().encode(serializedJson).length;
  return {
    withinMtu: byteLength <= WG_MAX_FRAME_BYTES,
    byteLength,
    maxBytes: WG_MAX_FRAME_BYTES,
    serializedJson,
    remainingBytes: WG_MAX_FRAME_BYTES - byteLength,
  };
}
