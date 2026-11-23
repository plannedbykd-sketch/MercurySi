import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from '../../contexts/ThemeContext';
import { TOPOLOGY_EDGES, TOPOLOGY_NODES, type TopologyNode } from '../../data/engineeringRecord';

interface D3TopologyGraphProps {
  selectedPlane: 'All' | TopologyNode['plane'];
  onSelectPlane: (plane: 'All' | TopologyNode['plane']) => void;
  onSelectNode?: (node: TopologyNode) => void;
}

interface PositionedNode extends TopologyNode {
  x: number;
  y: number;
  col: number;
}

const PLANE_COLUMNS: Record<TopologyNode['plane'], number> = {
  'Client & Mobile': 0,
  'Control & Proxy': 1,
  'Kernel & Enclave': 2,
};

export function D3TopologyGraph({
  selectedPlane,
  onSelectPlane,
  onSelectNode,
}: D3TopologyGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { resolvedTheme } = useTheme();
  const [hoveredNode, setHoveredNode] = useState<TopologyNode | null>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const width = 960;
    const height = 400;
    const colXs = [150, 480, 810];
    const isDark = resolvedTheme === 'dark';

    const grouped: Record<number, TopologyNode[]> = { 0: [], 1: [], 2: [] };
    for (const n of TOPOLOGY_NODES) {
      grouped[PLANE_COLUMNS[n.plane]].push(n);
    }

    const positionedNodes: PositionedNode[] = [];
    const nodeById = new Map<string, PositionedNode>();

    for (const col of [0, 1, 2]) {
      const list = grouped[col];
      const topPad = 68;
      const availH = height - topPad - 32;
      const step = list.length > 1 ? availH / (list.length - 1) : 0;
      list.forEach((n, idx) => {
        const pn: PositionedNode = {
          ...n,
          col,
          x: colXs[col],
          y: list.length === 1 ? height / 2 : topPad + idx * step,
        };
        positionedNodes.push(pn);
        nodeById.set(n.id, pn);
      });
    }

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const defs = svg.append('defs');

    const linkGrad = defs
      .append('linearGradient')
      .attr('id', 'd3CrimsonLink')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');
    linkGrad.append('stop').attr('offset', '0%').attr('stop-color', '#e11d48').attr('stop-opacity', 0.55);
    linkGrad.append('stop').attr('offset', '50%').attr('stop-color', '#fb7185').attr('stop-opacity', 0.9);
    linkGrad.append('stop').attr('offset', '100%').attr('stop-color', '#9f1239').attr('stop-opacity', 0.55);

    // Column Header Labels
    const headers: Array<{ label: string; plane: TopologyNode['plane']; x: number }> = [
      { label: '01. Client & Mobile', plane: 'Client & Mobile', x: colXs[0] },
      { label: '02. Control & Loopback IPC', plane: 'Control & Proxy', x: colXs[1] },
      { label: '03. Kernel & Enclave', plane: 'Kernel & Enclave', x: colXs[2] },
    ];

    svg
      .append('g')
      .selectAll('text')
      .data(headers)
      .join('text')
      .attr('x', (d) => d.x)
      .attr('y', 26)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('font-weight', 600)
      .attr('font-family', '"Plus Jakarta Sans", sans-serif')
      .attr('fill', (d) =>
        selectedPlane === d.plane
          ? isDark
            ? '#fda4af'
            : '#be123c'
          : isDark
            ? '#94a3b8'
            : '#475569'
      )
      .style('cursor', 'pointer')
      .text((d) => d.label)
      .on('click', (_event, d) => {
        onSelectPlane(selectedPlane === d.plane ? 'All' : d.plane);
      });

    // Links via d3.linkHorizontal
    const linkGen = d3
      .linkHorizontal<{ source: [number, number]; target: [number, number] }, [number, number]>()
      .x((d) => d[0])
      .y((d) => d[1]);

    const edgeData = TOPOLOGY_EDGES.map((edge) => {
      const s = nodeById.get(edge.source);
      const t = nodeById.get(edge.target);
      if (!s || !t) return null;
      return {
        ...edge,
        sourceNode: s,
        targetNode: t,
        pathD:
          linkGen({
            source: [s.x + 88, s.y],
            target: [t.x - 88, t.y],
          }) || '',
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    const linksGroup = svg.append('g').attr('fill', 'none');
    const linkPaths = linksGroup
      .selectAll('path')
      .data(edgeData)
      .join('path')
      .attr('d', (d) => d.pathD)
      .attr('stroke', 'url(#d3CrimsonLink)')
      .attr('stroke-width', 1.6)
      .attr('stroke-opacity', (d) => {
        if (selectedPlane === 'All') return 0.55;
        return d.sourceNode.plane === selectedPlane || d.targetNode.plane === selectedPlane
          ? 0.9
          : 0.14;
      });

    // Nodes
    const nodeGroups = svg
      .append('g')
      .selectAll('g')
      .data(positionedNodes)
      .join('g')
      .attr('transform', (d) => `translate(${d.x - 88}, ${d.y - 20})`)
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => {
        setHoveredNode(d);
        linkPaths
          .attr('stroke-width', (l) => (l.source === d.id || l.target === d.id ? 2.6 : 1.3))
          .attr('stroke-opacity', (l) => (l.source === d.id || l.target === d.id ? 1 : 0.12));
      })
      .on('mouseleave', () => {
        setHoveredNode(null);
        linkPaths
          .attr('stroke-width', 1.6)
          .attr('stroke-opacity', (l) => {
            if (selectedPlane === 'All') return 0.55;
            return l.sourceNode.plane === selectedPlane || l.targetNode.plane === selectedPlane
              ? 0.9
              : 0.14;
          });
      })
      .on('click', (_event, d) => {
        onSelectPlane(selectedPlane === d.plane ? 'All' : d.plane);
        onSelectNode?.(d);
      });

    nodeGroups
      .append('rect')
      .attr('width', 176)
      .attr('height', 40)
      .attr('rx', 10)
      .attr('fill', (d) => {
        const focused = selectedPlane === d.plane;
        if (focused) return isDark ? 'rgba(190, 18, 60, 0.38)' : 'rgba(190, 18, 60, 0.12)';
        return isDark ? 'rgba(18, 11, 15, 0.85)' : 'rgba(255, 255, 255, 0.86)';
      })
      .attr('stroke', (d) => {
        const focused = selectedPlane === d.plane;
        if (focused) return isDark ? '#fb7185' : '#be123c';
        return isDark ? 'rgba(251, 113, 133, 0.25)' : 'rgba(159, 18, 57, 0.22)';
      })
      .attr('stroke-width', (d) => (selectedPlane === d.plane ? 1.5 : 1))
      .attr('opacity', (d) => (selectedPlane === 'All' || selectedPlane === d.plane ? 1 : 0.42));

    nodeGroups
      .append('text')
      .attr('x', 10)
      .attr('y', 16)
      .attr('font-size', 10.5)
      .attr('font-weight', 600)
      .attr('font-family', '"DM Sans", sans-serif')
      .attr('fill', isDark ? '#f8fafc' : '#0f172a')
      .attr('opacity', (d) => (selectedPlane === 'All' || selectedPlane === d.plane ? 1 : 0.45))
      .text((d) => {
        const short = d.name.split(' (')[0];
        return short.length > 22 ? `${short.slice(0, 20)}…` : short;
      });

    nodeGroups
      .append('text')
      .attr('x', 10)
      .attr('y', 31)
      .attr('font-size', 9.5)
      .attr('font-family', '"JetBrains Mono", monospace')
      .attr('fill', isDark ? '#fda4af' : '#9f1239')
      .attr('opacity', (d) => (selectedPlane === 'All' || selectedPlane === d.plane ? 0.95 : 0.45))
      .text((d) => {
        const ep = d.endpointOrTarget.split(' ')[0];
        return ep.length > 24 ? `${ep.slice(0, 22)}…` : ep;
      });
  }, [resolvedTheme, selectedPlane, onSelectPlane, onSelectNode]);

  return (
    <div className="space-y-3">
      <div className="w-full overflow-x-auto">
        <svg
          ref={svgRef}
          className="w-full min-w-[680px] h-auto select-none"
          role="img"
          aria-label="D3.js LiquidOS 3-Plane Directed IPC Topology Graph"
        />
      </div>

      <div className="min-h-[36px] px-3 py-2 rounded-xl bg-white/55 dark:bg-black/25 border border-black/[0.07] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs">
        {hoveredNode ? (
          <>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {hoveredNode.name}
            </span>
            <span className="font-mono text-rose-700 dark:text-rose-300">
              {hoveredNode.endpointOrTarget} · {hoveredNode.keyModules.slice(0, 3).join(' · ')}
            </span>
          </>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">
            D3.js SVG Graph · Hover any node to trace connected IPC pathways or click to focus its execution plane.
          </span>
        )}
      </div>
    </div>
  );
}
