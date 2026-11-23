import { useState } from 'react';
import { Check, Copy, Download, FileCode2 } from 'lucide-react';
import { HYBRID_ARTIFACT_FILES, type HybridArtifactFile } from '../data/hybridFiles';
import { ChartJsArtifactWidgets } from './charts/ChartJsArtifactWidgets';

export function HybridFilesView() {
  const [targetFilter, setTargetFilter] = useState<'All' | HybridArtifactFile['target']>('All');
  const [selectedPath, setSelectedPath] = useState<string>(HYBRID_ARTIFACT_FILES[0].path);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const visibleFiles = HYBRID_ARTIFACT_FILES.filter(
    (f) => targetFilter === 'All' || f.target === targetFilter
  );

  const activeFile =
    visibleFiles.find((f) => f.path === selectedPath) ?? visibleFiles[0] ?? HYBRID_ARTIFACT_FILES[0];

  const handleCopy = async (file: HybridArtifactFile) => {
    await navigator.clipboard.writeText(file.content);
    setCopiedPath(file.path);
    setTimeout(() => setCopiedPath(null), 1500);
  };

  const handleDownloadFile = (file: HybridArtifactFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path.split('/').pop() || 'artifact.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectFromChart = (path: string) => {
    setTargetFilter('All');
    setSelectedPath(path);
  };

  const toolchainMatrix = [
    {
      stage: 'Rust FFI Unit Tests & Lints',
      command: 'cargo test --manifest-path crates/liquid_ffi/Cargo.toml',
      state: 'PLANNED',
      requirement: 'Local Rust / Cargo toolchain',
    },
    {
      stage: 'Android arm64-v8a .so + 16 KiB Align + .aar',
      command: './scripts/build_android_hybrid.sh',
      state: 'PLANNED',
      requirement: 'Android NDK r28+, cargo-ndk, JDK 17, Gradle',
    },
    {
      stage: 'iOS XCFramework + SwiftPM Linkage',
      command: './scripts/build_ios_xcframework.sh && swift build --package-path ios-liquid-kit',
      state: 'PLANNED',
      requirement: 'macOS host with Xcode & rustup Apple targets',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 border-b border-black/[0.08] dark:border-white/[0.1] pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Android &amp; iOS Hybrid FFI Artifacts
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
          Every file below is written directly to this workspace repository. Native cross-compilation
          remains <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">PLANNED</span> until
          executed on your host workstation with Cargo, Android NDK, and Xcode.
        </p>
      </div>

      {/* Toolchain Execution Matrix */}
      <div className="apple-glass rounded-2xl overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-black/[0.08] dark:border-white/[0.1] text-xs font-medium text-slate-500 dark:text-slate-400 bg-black/[0.02] dark:bg-white/[0.02]">
              <th className="py-2.5 px-4">Build Stage</th>
              <th className="py-2.5 px-4">Host Command</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">Host Requirement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.08] text-sm">
            {toolchainMatrix.map((row) => (
              <tr key={row.stage} className="hover:bg-black/[0.025] dark:hover:bg-white/[0.03]">
                <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">{row.stage}</td>
                <td className="py-2.5 px-4 font-mono text-xs text-rose-700 dark:text-rose-300">
                  {row.command}
                </td>
                <td className="py-2.5 px-4 font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {row.state}
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400">{row.requirement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chart.js Artifact Footprint Widgets */}
      <ChartJsArtifactWidgets onSelectFile={handleSelectFromChart} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-black/[0.05] dark:bg-white/[0.06] rounded-xl overflow-x-auto">
          {(['All', 'Rust FFI Core', 'Android AAR/AAB', 'iOS XCFramework', 'Build Scripts'] as const).map(
            (target) => (
              <button
                key={target}
                type="button"
                onClick={() => setTargetFilter(target)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  targetFilter === target
                    ? 'crimson-metallic-active'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {target}
              </button>
            )
          )}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          {visibleFiles.length} materialized files
        </div>
      </div>

      {/* Master-detail file explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 apple-glass rounded-2xl divide-y divide-black/[0.06] dark:divide-white/[0.08] overflow-hidden">
          {visibleFiles.map((file) => {
            const isSelected = activeFile.path === file.path;
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedPath(file.path)}
                className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-2.5 ${
                  isSelected
                    ? 'crimson-metallic-active'
                    : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-slate-900 dark:text-slate-100'
                }`}
              >
                <FileCode2
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    isSelected
                      ? 'text-rose-100'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <div className="min-w-0">
                  <div className="font-mono text-xs font-medium truncate">{file.path}</div>
                  <div
                    className={`text-xs mt-0.5 ${
                      isSelected
                        ? 'text-rose-100/90'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {file.target} · {file.language}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-8 apple-glass rounded-2xl overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.1] bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="min-w-0">
              <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {activeFile.path}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {activeFile.purpose}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy(activeFile)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/15 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-white/15 whitespace-nowrap"
              >
                {copiedPath === activeFile.path ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleDownloadFile(activeFile)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium crimson-metallic-btn rounded-lg whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          </div>

          <pre className="p-4 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto leading-relaxed max-h-[560px] overflow-y-auto">
            <code>{activeFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
