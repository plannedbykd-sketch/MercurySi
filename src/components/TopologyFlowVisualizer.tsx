import { type TopologyNode } from '../data/engineeringRecord';
import { D3TopologyGraph } from './charts/D3TopologyGraph';

interface TopologyFlowVisualizerProps {
  selectedPlane: 'All' | TopologyNode['plane'];
  onSelectPlane: (plane: 'All' | TopologyNode['plane']) => void;
}

export function TopologyFlowVisualizer({
  selectedPlane,
  onSelectPlane,
}: TopologyFlowVisualizerProps) {
  return (
    <div className="apple-glass rounded-2xl p-5 space-y-4 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Execution Plane Flow &amp; IPC Graph (D3.js SVG)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select any plane header or node to filter its modules in the topology table below.
          </p>
        </div>
        {selectedPlane !== 'All' && (
          <button
            type="button"
            onClick={() => onSelectPlane('All')}
            className="text-xs font-medium text-rose-700 dark:text-rose-300 hover:underline self-start sm:self-auto"
          >
            Reset plane focus
          </button>
        )}
      </div>

      <D3TopologyGraph selectedPlane={selectedPlane} onSelectPlane={onSelectPlane} />
    </div>
  );
}
