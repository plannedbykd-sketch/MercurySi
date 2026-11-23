import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  computeCanonicalEntry,
  computeLegacySwiftEntry,
  packWireGuard5FieldFrame,
  verifyLedgerChain,
  WG_MAX_FRAME_BYTES,
  type ChainVerificationResult,
  type LedgerEntry,
  type LedgerMode,
} from '../lib/canonicalLedger';

export function LedgerWgView() {
  const [mode, setMode] = useState<LedgerMode>('canonical_v2');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [payloadText, setPayloadText] = useState(
    '{"event":"cold_start_verified","surface":"android-arm64","seq_gate":"ok"}'
  );
  const [verification, setVerification] = useState<ChainVerificationResult>({
    valid: true,
    quarantined: false,
    failedAtSeq: null,
    reason: 'Empty genesis ledger',
  });

  // WireGuard 5-field MTU state
  const [findingId, setFindingId] = useState('LOS-WG-2026-001');
  const [cellTower, setCellTower] = useState('310-410-88421');
  const [surface, setSurface] = useState('android-arm64-aar');
  const [severityStatus, setSeverityStatus] = useState('NOMINAL');
  const [wgTimestamp, setWgTimestamp] = useState(1763930000);

  useEffect(() => {
    let active = true;
    (async () => {
      const zero = '0'.repeat(64);
      const r1 = await computeCanonicalEntry(1, zero, 'genesis:crates/liquid_ffi:init');
      const e1: LedgerEntry = {
        seq: 1,
        ts: '2026-11-23T13:00:00Z',
        mode: 'canonical_v2',
        payload: 'genesis:crates/liquid_ffi:init',
        prevHash: zero,
        payloadDigest: r1.payloadDigest,
        entryHash: r1.entryHash,
      };
      const r2 = await computeCanonicalEntry(2, e1.entryHash, 'par_v1:cold_start_attested');
      const e2: LedgerEntry = {
        seq: 2,
        ts: '2026-11-23T13:01:00Z',
        mode: 'canonical_v2',
        payload: 'par_v1:cold_start_attested',
        prevHash: e1.entryHash,
        payloadDigest: r2.payloadDigest,
        entryHash: r2.entryHash,
      };
      const initial = [e1, e2];
      const check = await verifyLedgerChain(initial);
      if (active) {
        setEntries(initial);
        setVerification(check);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleAppend = async () => {
    if (!payloadText.trim()) return;
    const nextSeq = entries.length + 1;
    const prevHash = entries.length > 0 ? entries[entries.length - 1].entryHash : '0'.repeat(64);
    const computed =
      mode === 'canonical_v2'
        ? await computeCanonicalEntry(nextSeq, prevHash, payloadText)
        : await computeLegacySwiftEntry(prevHash, payloadText);

    const nextEntry: LedgerEntry = {
      seq: nextSeq,
      ts: new Date().toISOString(),
      mode,
      payload: payloadText,
      prevHash,
      payloadDigest: computed.payloadDigest,
      entryHash: computed.entryHash,
    };

    const nextList = [...entries, nextEntry];
    setEntries(nextList);
    setVerification(await verifyLedgerChain(nextList));
  };

  const handleTamperLast = async () => {
    if (entries.length === 0) return;
    const modified = entries.map((item, idx) =>
      idx === entries.length - 1 ? { ...item, payload: `${item.payload} [TAMPERED]` } : item
    );
    setEntries(modified);
    setVerification(await verifyLedgerChain(modified));
  };

  const handleReset = async () => {
    setEntries([]);
    setVerification(await verifyLedgerChain([]));
  };

  const wgPacked = packWireGuard5FieldFrame({
    finding_id: findingId,
    timestamp: wgTimestamp,
    cell_tower: cellTower,
    surface,
    severity_status: severityStatus,
  });

  const mtuPct = Math.min(100, Math.round((wgPacked.byteLength / wgPacked.maxBytes) * 100));

  return (
    <div className="space-y-10">
      <div className="border-b border-black/[0.08] dark:border-white/[0.1] pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Canonical SHA-256 Ledger &amp; WireGuard 5-Field MTU
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-3xl">
          Interactive workbench for the unified mobile hash chain (Turn 09/19 binary concatenation vs.
          legacy JarvisUltra Swift <span className="font-mono">H_k</span>) and the 1,232-byte WireGuard
          5-field report frame constraint.
        </p>
      </div>

      {/* Ledger Chain Workbench */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              01. Cryptographic Provenance Ledger
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Canonical: <span className="font-mono">SHA256(seq_be || prev_hash || 0x00 || SHA256(payload))</span>
              {' · '}
              Legacy Swift: <span className="font-mono">SHA256(R_k || H_&#123;k-1&#125;)</span>
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-black/[0.05] dark:bg-white/[0.06] rounded-xl self-start">
            <button
              type="button"
              onClick={() => setMode('canonical_v2')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                mode === 'canonical_v2'
                  ? 'crimson-metallic-active'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Canonical v2
            </button>
            <button
              type="button"
              onClick={() => setMode('legacy_swift_v4')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                mode === 'legacy_swift_v4'
                  ? 'crimson-metallic-active'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Legacy Swift v4
            </button>
          </div>
        </div>

        <div className="apple-glass rounded-2xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              placeholder="Enter audit record payload"
              className="flex-1 px-3 py-2 text-xs font-mono bg-white/70 dark:bg-slate-950/60 border border-black/10 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/25"
            />
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={handleAppend}
                disabled={verification.quarantined}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium crimson-metallic-btn rounded-xl disabled:opacity-50 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Append Record
              </button>
              <button
                type="button"
                onClick={handleTamperLast}
                disabled={entries.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white/75 dark:bg-white/10 border border-black/10 dark:border-white/15 text-amber-700 dark:text-amber-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-50 whitespace-nowrap"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Simulate Tamper
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white/75 dark:bg-white/10 border border-black/10 dark:border-white/15 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-white dark:hover:bg-white/15 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-black/[0.08] dark:border-white/[0.1] text-xs">
            <div className="flex items-center gap-2">
              {verification.quarantined ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              )}
              <span
                className={`font-mono font-semibold ${
                  verification.quarantined
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {verification.quarantined ? 'QUARANTINE LOCKOUT' : 'CHAIN VERIFIED'}
              </span>
              <span className="text-slate-500 dark:text-slate-400">· {verification.reason}</span>
            </div>
            <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {entries.length} entries
            </span>
          </div>
        </div>

        <div className="apple-glass rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.08] dark:border-white/[0.1] text-xs font-medium text-slate-500 dark:text-slate-400 bg-black/[0.02] dark:bg-white/[0.02]">
                <th className="py-2.5 px-4 w-16">Seq</th>
                <th className="py-2.5 px-4">Mode</th>
                <th className="py-2.5 px-4">Payload</th>
                <th className="py-2.5 px-4">Prev Hash</th>
                <th className="py-2.5 px-4">Entry Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.08] text-xs font-mono">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 px-4 text-center font-sans text-slate-500 dark:text-slate-400">
                    Ledger is at genesis state. Append a record above to compute SHA-256 chain hashes.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={`${entry.seq}-${entry.entryHash}`}
                    className={
                      verification.failedAtSeq === entry.seq
                        ? 'bg-rose-500/15'
                        : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.03]'
                    }
                  >
                    <td className="py-2.5 px-4 tabular-nums text-slate-900 dark:text-slate-100">
                      #{entry.seq}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {entry.mode}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200 max-w-xs truncate">
                      {entry.payload}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                      {entry.prevHash.slice(0, 14)}…
                    </td>
                    <td className="py-2.5 px-4 text-rose-700 dark:text-rose-300 font-medium">
                      {entry.entryHash.slice(0, 18)}…
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* WireGuard 5-Field Frame Packer */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            02. WireGuard 5-Field MTU Frame Budget ({WG_MAX_FRAME_BYTES} bytes max)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Enforces strict 5-field serialization matching <span className="font-mono">pack_wg_5field_frame</span> in{' '}
            <span className="font-mono">crates/liquid_ffi/src/core_logic.rs</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 apple-glass rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                finding_id
              </label>
              <input
                type="text"
                value={findingId}
                onChange={(e) => setFindingId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-white/70 dark:bg-slate-950/60 border border-black/10 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                timestamp
              </label>
              <input
                type="number"
                value={wgTimestamp}
                onChange={(e) => setWgTimestamp(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs font-mono bg-white/70 dark:bg-slate-950/60 border border-black/10 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                cell_tower
              </label>
              <input
                type="text"
                value={cellTower}
                onChange={(e) => setCellTower(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-white/70 dark:bg-slate-950/60 border border-black/10 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                severity_status
              </label>
              <input
                type="text"
                value={severityStatus}
                onChange={(e) => setSeverityStatus(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-white/70 dark:bg-slate-950/60 border border-black/10 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                surface
              </label>
              <textarea
                rows={3}
                value={surface}
                onChange={(e) => setSurface(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-white/70 dark:bg-slate-950/60 border border-black/10 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="lg:col-span-6 apple-glass rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Serialized Payload Size</div>
                <div className="text-lg font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {wgPacked.byteLength} / {wgPacked.maxBytes} bytes ({mtuPct}%)
                </div>
              </div>
              <div
                className={`text-xs font-mono font-semibold ${
                  wgPacked.withinMtu
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {wgPacked.withinMtu
                  ? `WITHIN MTU (${wgPacked.remainingBytes} B free)`
                  : `EXCEEDS MTU (Err -32)`}
              </div>
            </div>

            {/* Metallic MTU Budget Gauge */}
            <div className="h-2.5 w-full rounded-full bg-black/[0.08] dark:bg-white/[0.08] overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  wgPacked.withinMtu
                    ? 'bg-gradient-to-r from-rose-700 via-rose-500 to-amber-400'
                    : 'bg-rose-600'
                }`}
                style={{ width: `${mtuPct}%` }}
              />
            </div>

            <pre className="p-3 bg-white/60 dark:bg-slate-950/60 border border-black/[0.08] dark:border-white/[0.1] rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap break-all">
              {wgPacked.serializedJson}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
