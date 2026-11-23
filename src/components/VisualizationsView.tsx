import { useState } from 'react';
import { type TopologyNode } from '../data/engineeringRecord';
import { ChartJsArtifactWidgets } from './charts/ChartJsArtifactWidgets';
import { D3TopologyGraph } from './charts/D3TopologyGraph';
import { EChartsSovereignMatrix } from './charts/EChartsSovereignMatrix';

type EngineFilter = 'All' | 'D3.js' | 'Chart.js' | 'Apache ECharts';

const COMPARISON_ROWS = [
  {
    library: 'D3.js',
    engine: 'SVG / HTML / Canvas',
    learningCurve: 'High',
    idealUseCase: 'Custom visual storytelling & unique diagrams',
    appliedIn: '13-Node LiquidOS 3-Plane Directed IPC Topology Graph',
  },
  {
    library: 'Chart.js',
    engine: 'HTML5 Canvas',
    learningCurve: 'Low',
    idealUseCase: 'Simple, modern SaaS & web app widgets',
    appliedIn: '17-File Hybrid Artifact Byte Footprint & Plane Breakdown',
  },
  {
    library: 'Apache ECharts',
    engine: 'Canvas / SVG',
    learningCurve: 'Medium',
    idealUseCase: 'Complex analytics & high-volume dashboards',
    appliedIn: '51-Module Sovereign Registry (DataZoom) & Gap Register Stack',
  },
];

export function VisualizationsView() {
  const [engineFilter, setEngineFilter] = useState<EngineFilter>('All');
  const [selectedPlane, setSelectedPlane] = useState<'All' | TopologyNode['plane']>('All');

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-black/[0.08] dark:border-white/[0.1] pb-6">
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Data Visualization Engines
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Applied <span className="font-semibold text-slate-900 dark:text-slate-100">D3.js</span>,{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">Chart.js</span>, and{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">Apache ECharts</span>{' '}
            rendering real LiquidOS topology, hybrid artifact, and sovereign registry data.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-black/[0.05] dark:bg-white/[0.06] rounded-xl self-start">
          {(['All', 'D3.js', 'Chart.js', 'Apache ECharts'] as const).map((engine) => (
            <button
              key={engine}
              type="button"
              onClick={() => setEngineFilter(engine)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                engineFilter === engine
                  ? 'crimson-metallic-active'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {engine}
            </button>
          ))}
        </div>
      </div>

      {/* Library Comparison Matrix */}
      <div className="apple-glass rounded-2xl overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-black/[0.08] dark:border-white/[0.1] text-xs font-medium text-slate-500 dark:text-slate-400 bg-black/[0.02] dark:bg-white/[0.02]">
              <th className="py-2.5 px-4">Library</th>
              <th className="py-2.5 px-4">Rendering Engine</th>
              <th className="py-2.5 px-4">Learning Curve</th>
              <th className="py-2.5 px-4">Ideal UI/UX Use Case</th>
              <th className="py-2.5 px-4">Applied Widget</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.08] text-xs">
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.library} className="hover:bg-black/[0.025] dark:hover:bg-white/[0.03]">
                <td className="py-3 px-4 font-semibold text-rose-700 dark:text-rose-300 whitespace-nowrap">
                  {row.library}
                </td>
                <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {row.engine}
                </td>
                <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {row.learningCurve}
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{row.idealUseCase}</td>
                <td className="py-3 px-4 text-slate-800 dark:text-slate-200">{row.appliedIn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(engineFilter === 'All' || engineFilter === 'Apache ECharts') && <EChartsSovereignMatrix />}

      {(engineFilter === 'All' || engineFilter === 'D3.js') && (
        <section className="apple-glass rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Custom Directed Architecture Diagram (D3.js SVG)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bespoke DOM/SVG data binding via <span className="font-mono">d3.linkHorizontal</span> across 13 nodes and 15 IPC edges.
              </p>
            </div>
            {selectedPlane !== 'All' && (
              <button
                type="button"
                onClick={() => setSelectedPlane('All')}
                className="text-xs font-medium text-rose-700 dark:text-rose-300 hover:underline self-start sm:self-auto"
              >
                Reset plane focus
              </button>
            )}
          </div>
          <D3TopologyGraph selectedPlane={selectedPlane} onSelectPlane={setSelectedPlane} />
        </section>
      )}

      {(engineFilter === 'All' || engineFilter === 'Chart.js') && <ChartJsArtifactWidgets />}
    </div>
  );
}
