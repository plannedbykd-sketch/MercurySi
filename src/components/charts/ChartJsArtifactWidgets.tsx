import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { useTheme } from '../../contexts/ThemeContext';
import { HYBRID_ARTIFACT_FILES } from '../../data/hybridFiles';

Chart.register(...registerables);

interface ChartJsArtifactWidgetsProps {
  onSelectFile?: (path: string) => void;
}

export function ChartJsArtifactWidgets({ onSelectFile }: ChartJsArtifactWidgetsProps) {
  const barCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const doughnutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const barCanvas = barCanvasRef.current;
    const doughnutCanvas = doughnutCanvasRef.current;
    if (!barCanvas || !doughnutCanvas) return;

    const isDark = resolvedTheme === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#334155';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';

    const sortedFiles = [...HYBRID_ARTIFACT_FILES].sort(
      (a, b) => b.content.length - a.content.length
    );

    const barChart = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels: sortedFiles.map((f) => f.path.split('/').pop() || f.path),
        datasets: [
          {
            label: 'Bytes',
            data: sortedFiles.map((f) => new TextEncoder().encode(f.content).length),
            backgroundColor: sortedFiles.map((f) =>
              f.target === 'Rust FFI Core'
                ? 'rgba(225, 29, 72, 0.82)'
                : f.target === 'Android AAR/AAB'
                  ? 'rgba(190, 18, 60, 0.65)'
                  : f.target === 'iOS XCFramework'
                    ? 'rgba(251, 113, 133, 0.78)'
                    : 'rgba(148, 163, 184, 0.72)'
            ),
            borderColor: isDark ? 'rgba(255,228,230,0.22)' : 'rgba(136,19,55,0.25)',
            borderWidth: 1,
            borderRadius: 5,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_evt, elements) => {
          if (elements.length > 0 && onSelectFile) {
            const idx = elements[0].index;
            const file = sortedFiles[idx];
            if (file) onSelectFile(file.path);
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex ?? 0;
                return sortedFiles[idx]?.path ?? '';
              },
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const lines = sortedFiles[idx]?.content.split('\n').length ?? 0;
                return `${ctx.parsed.x} bytes · ${lines} lines`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } },
            grid: { color: gridColor },
          },
          y: {
            ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } },
            grid: { display: false },
          },
        },
      },
    });

    const targets = ['Rust FFI Core', 'Android AAR/AAB', 'iOS XCFramework', 'Build Scripts'] as const;
    const targetBytes = targets.map((t) =>
      HYBRID_ARTIFACT_FILES.filter((f) => f.target === t).reduce(
        (sum, f) => sum + new TextEncoder().encode(f.content).length,
        0
      )
    );

    const doughnutChart = new Chart(doughnutCanvas, {
      type: 'doughnut',
      data: {
        labels: [...targets],
        datasets: [
          {
            data: targetBytes,
            backgroundColor: [
              'rgba(225, 29, 72, 0.85)',
              'rgba(159, 18, 57, 0.82)',
              'rgba(251, 113, 133, 0.85)',
              isDark ? 'rgba(148, 163, 184, 0.65)' : 'rgba(100, 116, 139, 0.65)',
            ],
            borderColor: isDark ? '#140c10' : '#ffffff',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
              boxWidth: 10,
              padding: 12,
              font: { family: 'DM Sans', size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed} bytes`,
            },
          },
        },
      },
    });

    return () => {
      barChart.destroy();
      doughnutChart.destroy();
    };
  }, [resolvedTheme, onSelectFile]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 apple-glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Materialized Artifact Footprint (Chart.js Canvas)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Exact UTF-8 byte sizes across the 17 Rust/Android/iOS files{onSelectFile ? ' · Click a bar to inspect file' : ''}.
            </p>
          </div>
          <span className="font-mono text-[11px] text-rose-700 dark:text-rose-300">
            HTML5 &lt;canvas&gt;
          </span>
        </div>
        <div className="h-[340px]">
          <canvas ref={barCanvasRef} />
        </div>
      </div>

      <div className="lg:col-span-4 apple-glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Bytes by Target Plane
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hybrid source distribution
            </p>
          </div>
        </div>
        <div className="h-[340px]">
          <canvas ref={doughnutCanvasRef} />
        </div>
      </div>
    </div>
  );
}
