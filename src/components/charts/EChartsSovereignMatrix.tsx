import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { useTheme } from '../../contexts/ThemeContext';
import { GAP_REGISTER, SOVEREIGN_PLANES } from '../../data/engineeringRecord';

export function EChartsSovereignMatrix() {
  const planesChartRef = useRef<HTMLDivElement | null>(null);
  const gapChartRef = useRef<HTMLDivElement | null>(null);
  const { resolvedTheme } = useTheme();
  const [renderer, setRenderer] = useState<'canvas' | 'svg'>('canvas');

  useEffect(() => {
    const planesEl = planesChartRef.current;
    const gapEl = gapChartRef.current;
    if (!planesEl || !gapEl) return;

    const isDark = resolvedTheme === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#334155';
    const splitLineColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const tooltipBg = isDark ? 'rgba(18, 10, 14, 0.94)' : 'rgba(255, 255, 255, 0.96)';

    const planesChart = echarts.init(planesEl, undefined, { renderer });
    planesChart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: tooltipBg,
        borderColor: isDark ? 'rgba(251,113,133,0.3)' : 'rgba(190,18,60,0.22)',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12 },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const first = arr[0] as { dataIndex?: number };
          const p = SOVEREIGN_PLANES[first?.dataIndex ?? 0];
          if (!p) return '';
          return `
            <div style="font-weight:600;margin-bottom:4px;">${p.plane} (${p.range}) · ${p.domain}</div>
            <div style="font-family:JetBrains Mono,monospace;font-size:11px;margin-bottom:4px;">Modules: ${p.moduleCount}</div>
            <div style="font-size:11px;opacity:0.85;">${p.highlights.join('<br/>')}</div>
          `;
        },
      },
      grid: { left: 42, right: 18, top: 24, bottom: 72 },
      dataZoom: [
        {
          type: 'slider',
          height: 18,
          bottom: 8,
          borderColor: splitLineColor,
          fillerColor: 'rgba(225, 29, 72, 0.22)',
          handleStyle: { color: '#e11d48' },
          textStyle: { color: textColor, fontSize: 10 },
        },
        { type: 'inside' },
      ],
      xAxis: {
        type: 'category',
        data: SOVEREIGN_PLANES.map((p) => `${p.plane}\n(${p.range})`),
        axisLabel: { color: textColor, fontSize: 10, fontFamily: 'JetBrains Mono' },
        axisLine: { lineStyle: { color: splitLineColor } },
      },
      yAxis: {
        type: 'value',
        name: 'Modules',
        minInterval: 1,
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: { color: textColor, fontFamily: 'JetBrains Mono', fontSize: 10 },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      series: [
        {
          name: 'Modules',
          type: 'bar',
          barWidth: '52%',
          data: SOVEREIGN_PLANES.map((p) => p.moduleCount),
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#fb7185' },
              { offset: 0.5, color: '#e11d48' },
              { offset: 1, color: '#881337' },
            ]),
          },
        },
      ],
    });

    const categories = ['Governance & Build', 'Monorepo Concurrency & Bugs', 'Hybrid FFI & Transcript'] as const;
    const statuses = ['Resolved in Hybrid Core', 'Patch Specified', 'Pending Host Execution'] as const;
    const statusColors: Record<(typeof statuses)[number], string> = {
      'Resolved in Hybrid Core': '#10b981',
      'Patch Specified': '#f59e0b',
      'Pending Host Execution': '#e11d48',
    };

    const gapChart = echarts.init(gapEl, undefined, { renderer });
    gapChart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: tooltipBg,
        borderColor: isDark ? 'rgba(251,113,133,0.3)' : 'rgba(190,18,60,0.22)',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12 },
      },
      legend: {
        bottom: 4,
        textStyle: { color: textColor, fontSize: 11 },
      },
      grid: { left: 40, right: 16, top: 20, bottom: 64 },
      xAxis: {
        type: 'category',
        data: ['Governance', 'Monorepo Bugs', 'Hybrid FFI'],
        axisLabel: { color: textColor, fontSize: 11 },
        axisLine: { lineStyle: { color: splitLineColor } },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: textColor, fontFamily: 'JetBrains Mono', fontSize: 10 },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      series: statuses.map((st) => ({
        name: st,
        type: 'bar',
        stack: 'gaps',
        barWidth: '46%',
        itemStyle: { color: statusColors[st], borderRadius: [3, 3, 0, 0] },
        data: categories.map(
          (cat) =>
            GAP_REGISTER.filter((g) => g.category === cat && g.remediationStatus === st).length
        ),
      })),
    });

    const ro = new ResizeObserver(() => {
      planesChart.resize();
      gapChart.resize();
    });
    ro.observe(planesEl);
    ro.observe(gapEl);

    return () => {
      ro.disconnect();
      planesChart.dispose();
      gapChart.dispose();
    };
  }, [resolvedTheme, renderer]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            51-Module Sovereign Ledger &amp; Gap Analytics (Apache ECharts)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Interactive DataZoom slider, dynamic tooltips for Planes 0–X (modules 00–50), and stacked Gap Register status.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-black/[0.05] dark:bg-white/[0.06] rounded-xl self-start">
          {(['canvas', 'svg'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setRenderer(mode)}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-colors uppercase ${
                renderer === mode
                  ? 'crimson-metallic-active'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 apple-glass rounded-2xl p-4 space-y-2">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Sovereign Engineering Registry (51 Modules across 11 Planes)
          </div>
          <div ref={planesChartRef} className="w-full h-[320px]" />
        </div>

        <div className="lg:col-span-5 apple-glass rounded-2xl p-4 space-y-2">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            12-Item Gap Register by Category &amp; State
          </div>
          <div ref={gapChartRef} className="w-full h-[320px]" />
        </div>
      </div>
    </div>
  );
}
