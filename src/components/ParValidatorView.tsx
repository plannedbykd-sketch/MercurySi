import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import {
  buildParTestPresets,
  validateParJson,
  type ParValidationResult,
} from '../lib/parValidator';

type PresetName = 'PASS' | 'DRIFT' | 'FAILOVER_REQUIRED' | 'STRUCTURAL_ERROR';

export function ParValidatorView() {
  const [presets, setPresets] = useState<Record<PresetName, string> | null>(null);
  const [activePreset, setActivePreset] = useState<PresetName>('PASS');
  const [jsonInput, setJsonInput] = useState<string>('');
  const [result, setResult] = useState<ParValidationResult | null>(null);
  const [running, setRunning] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    buildParTestPresets().then((generated) => {
      if (cancelled) return;
      setPresets(generated);
      setJsonInput(generated.PASS);
      validateParJson(generated.PASS).then((res) => {
        if (!cancelled) setResult(res);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectPreset = async (name: PresetName) => {
    if (!presets) return;
    setActivePreset(name);
    setJsonInput(presets[name]);
    setRunning(true);
    const res = await validateParJson(presets[name]);
    setResult(res);
    setRunning(false);
  };

  const handleValidate = async () => {
    setRunning(true);
    const res = await validateParJson(jsonInput);
    setResult(res);
    setRunning(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-black/[0.08] dark:border-white/[0.1] pb-6">
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            PaR v1.0 Deterministic Validator
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Executes Phase A (<span className="font-mono text-slate-900 dark:text-slate-100">check_structure</span> → Exit 2)
            and Phase B (<span className="font-mono text-slate-900 dark:text-slate-100">validate</span> → Exit 0 PASS / Exit 1 DRIFT or FAILOVER_REQUIRED)
            with live WebCrypto SHA-256 verification.
          </p>
        </div>

        <button
          type="button"
          onClick={handleValidate}
          disabled={running}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium crimson-metallic-btn rounded-xl disabled:opacity-60 whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <Play className="w-3.5 h-3.5" />
          {running ? 'Validating…' : 'Run Validator'}
        </button>
      </div>

      {/* 4-case matrix selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-black/[0.05] dark:bg-white/[0.06] rounded-xl overflow-x-auto">
          {(['PASS', 'DRIFT', 'FAILOVER_REQUIRED', 'STRUCTURAL_ERROR'] as const).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => handleSelectPreset(name)}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activePreset === name
                  ? 'crimson-metallic-active'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Browser WebCrypto SHA-256 parity with <span className="font-mono">par-validator/src/main.rs</span>
        </div>
      </div>

      {/* Linear Chain Progression Strip */}
      {result && result.step_details.length > 0 && (
        <div className="apple-glass rounded-2xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">
            Linear Cryptographic Chain Trace
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {result.step_details.map((step, i) => {
              const stepOk = step.structuralOk && step.hashMatches && step.coldStartAttested && step.qualifierPreserved && !step.overclaimDetected;
              return (
                <div key={step.stepIndex} className="flex items-center gap-3 shrink-0">
                  <div
                    className={`px-3.5 py-2 rounded-xl border text-xs font-mono ${
                      stepOk
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-200'
                    }`}
                  >
                    <div className="font-semibold">
                      Step #{step.stepIndex} · {step.inferenceId}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {stepOk ? 'HASH + ATTESTATION OK' : step.note}
                    </div>
                  </div>
                  {i < result.step_details.length - 1 && (
                    <div className="w-8 h-0.5 bg-gradient-to-r from-rose-500/70 to-rose-300/70 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 apple-glass rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-black/[0.08] dark:border-white/[0.1] bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">PaR v1.0 JSON Artifact</span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {new TextEncoder().encode(jsonInput).length} bytes
            </span>
          </div>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            spellCheck={false}
            rows={22}
            className="w-full p-4 font-mono text-xs text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none resize-y leading-relaxed"
          />
        </div>

        <div className="lg:col-span-6 space-y-6">
          {result && (
            <div className="apple-glass rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4 border-b border-black/[0.08] dark:border-white/[0.1] pb-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Status</div>
                  <div
                    className={`mt-1 text-sm font-mono font-semibold ${
                      result.status === 'PASS'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : result.status === 'DRIFT'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {result.status}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Exit Code</div>
                  <div className="mt-1 text-sm font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {result.exit_code}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Human Audit Floor</div>
                  <div className="mt-1 text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {result.institutional_audit_required ? 'REQUIRED' : 'OPTIONAL'}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Diagnostic</div>
                <div className="mt-1 text-sm text-slate-800 dark:text-slate-200">{result.reason}</div>
              </div>
            </div>
          )}

          <div className="apple-glass rounded-2xl overflow-x-auto">
            <div className="px-4 py-2.5 border-b border-black/[0.08] dark:border-white/[0.1] bg-black/[0.02] dark:bg-white/[0.02] text-xs font-medium text-slate-700 dark:text-slate-300">
              Step-by-Step Chain &amp; Attestation Inspection
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] dark:border-white/[0.1] text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2 px-3">Step</th>
                  <th className="py-2 px-3">Inference ID</th>
                  <th className="py-2 px-3">SHA-256</th>
                  <th className="py-2 px-3">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.08] text-xs">
                {!result || result.step_details.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 px-3 text-center text-slate-500 dark:text-slate-400">
                      No valid step array parsed.
                    </td>
                  </tr>
                ) : (
                  result.step_details.map((step) => (
                    <tr key={step.stepIndex} className="align-top">
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        #{step.stepIndex}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-900 dark:text-slate-100">
                        {step.inferenceId}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-mono font-medium ${
                            step.hashMatches
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {step.hashMatches ? 'MATCH' : 'MISMATCH'}
                        </span>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[160px]">
                          {step.computedSha256}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        <div>
                          cold={String(step.coldStartAttested)} · qual={String(step.qualifierPreserved)} ·
                          overclaim={String(step.overclaimDetected)}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">{step.note}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
