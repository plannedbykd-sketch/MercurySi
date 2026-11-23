import { useState } from 'react';
import statusMdRaw from '../../STATUS.md?raw';
import dataManifestRaw from '../../DATA_MANIFEST.md?raw';
import honestyMdRaw from '../../docs/HONESTY.md?raw';
import checkpointsMdRaw from '../../CHECKPOINTS.md?raw';

const BANNED_UNCITED_TERMS = [
  'verified',
  'live',
  'complete',
  'operational',
  'integrated',
  'production',
  'real-time',
];

export function HonestyAuditView() {
  const [activeDoc, setActiveDoc] = useState<
    'STATUS.md' | 'DATA_MANIFEST.md' | 'docs/HONESTY.md' | 'CHECKPOINTS.md'
  >('STATUS.md');
  const [draftText, setDraftText] = useState(
    'Rust FFI compilation is PLANNED for local Cargo/NDK execution. WebCrypto PaR v1.0 validation is EXECUTED in browser.'
  );

  const docMap: Record<typeof activeDoc, string> = {
    'STATUS.md': statusMdRaw,
    'DATA_MANIFEST.md': dataManifestRaw,
    'docs/HONESTY.md': honestyMdRaw,
    'CHECKPOINTS.md': checkpointsMdRaw,
  };

  const lower = draftText.toLowerCase();
  const flaggedTerms = BANNED_UNCITED_TERMS.filter((term) => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    return regex.test(lower);
  });

  const hasTaxonomyTag = /\b(EXECUTED|MOCK|STUB|PLANNED)\b/.test(draftText);

  return (
    <div className="space-y-8">
      <div className="border-b border-black/[0.08] dark:border-white/[0.1] pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Honesty-First Pre-Flight &amp; Vocabulary Gate
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-3xl">
          Enforces the 4-state claim taxonomy (<span className="font-mono">EXECUTED</span>,{' '}
          <span className="font-mono">MOCK</span>, <span className="font-mono">STUB</span>,{' '}
          <span className="font-mono">PLANNED</span>) and inspects pre-flight governance manifests
          written to this repository.
        </p>
      </div>

      {/* Live Vocabulary Gate Scanner */}
      <section className="apple-glass rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              01. Vocabulary Gate Checker
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Flags prohibited un-cited claims ({BANNED_UNCITED_TERMS.join(', ')}) before publishing release notes.
            </p>
          </div>
          <div
            className={`text-xs font-mono font-semibold ${
              flaggedTerms.length === 0 && hasTaxonomyTag
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {flaggedTerms.length === 0 && hasTaxonomyTag
              ? 'GATE PASS'
              : `${flaggedTerms.length} FLAGGED TERM(S)`}
          </div>
        </div>

        <textarea
          rows={4}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          className="w-full p-3 text-xs font-mono bg-white/70 dark:bg-slate-950/60 border border-black/10 dark:border-white/15 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/15 dark:focus:ring-white/20"
        />

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
          <span>
            Taxonomy tag present:{' '}
            <strong className="font-mono text-slate-900 dark:text-slate-100">
              {hasTaxonomyTag ? 'YES' : 'NO'}
            </strong>
          </span>
          <span>·</span>
          <span>
            Banned terms detected:{' '}
            <strong className="font-mono text-slate-900 dark:text-slate-100">
              {flaggedTerms.length === 0 ? 'none' : flaggedTerms.join(', ')}
            </strong>
          </span>
        </div>
      </section>

      {/* Pre-flight markdown artifacts */}
      <section className="space-y-4">
        <div className="flex items-center gap-1 p-1 bg-black/[0.05] dark:bg-white/[0.06] rounded-xl self-start overflow-x-auto max-w-full">
          {(['STATUS.md', 'DATA_MANIFEST.md', 'docs/HONESTY.md', 'CHECKPOINTS.md'] as const).map(
            (doc) => (
              <button
                key={doc}
                type="button"
                onClick={() => setActiveDoc(doc)}
                className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  activeDoc === doc
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {doc}
              </button>
            )
          )}
        </div>

        <div className="apple-glass rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-black/[0.08] dark:border-white/[0.1] bg-black/[0.02] dark:bg-white/[0.02] font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
            {activeDoc}
          </div>
          <pre className="p-4 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {docMap[activeDoc]}
          </pre>
        </div>
      </section>
    </div>
  );
}
