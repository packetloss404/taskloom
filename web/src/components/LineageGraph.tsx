import { useMemo } from "react";
import type { LineageGraph, LineageNode, LineageNodeStatus, LineageStageKey } from "@/lib/lineage";
import { lineageNeighbors } from "@/lib/lineage";
import { cn } from "@/lib/utils";

const COLUMN_WIDTH = 220;
const COLUMN_GAP = 56;
const NODE_HEIGHT = 64;
const ROW_GAP = 16;
const HEADER_HEIGHT = 32;

const STAGE_LABELS: Record<LineageStageKey, string> = {
  brief: "Brief",
  requirements: "Requirements",
  plan: "Plan items",
  validation: "Validation",
  release: "Release",
};

const STATUS_TONE: Record<LineageNodeStatus, { fill: string; ring: string; dot: string; label: string }> = {
  empty:       { fill: "fill-ink-900",       ring: "stroke-ink-700",        dot: "bg-ink-600",       label: "empty" },
  pending:     { fill: "fill-ink-800",       ring: "stroke-ink-600",        dot: "bg-ink-400",       label: "pending" },
  in_progress: { fill: "fill-amber-900/40",  ring: "stroke-amber-400/70",   dot: "bg-amber-300",     label: "in progress" },
  blocked:     { fill: "fill-rose-900/40",   ring: "stroke-rose-400/70",    dot: "bg-rose-300",      label: "blocked" },
  passed:      { fill: "fill-emerald-900/40",ring: "stroke-emerald-400/70", dot: "bg-emerald-300",   label: "passed" },
  failed:      { fill: "fill-rose-900/50",   ring: "stroke-rose-400/80",    dot: "bg-rose-400",      label: "failed" },
  done:        { fill: "fill-emerald-900/50",ring: "stroke-emerald-400/80", dot: "bg-emerald-400",   label: "done" },
};

interface LineageGraphProps {
  graph: LineageGraph;
  selectedNodeId?: string | null;
  onSelect?: (node: LineageNode | null) => void;
}

interface PositionedNode extends LineageNode {
  x: number;
  y: number;
  column: number;
  row: number;
}

export default function LineageGraphView({ graph, selectedNodeId, onSelect }: LineageGraphProps) {
  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const highlight = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const { upstream, downstream } = lineageNeighbors(graph, selectedNodeId);
    return new Set<string>([selectedNodeId, ...upstream, ...downstream]);
  }, [graph, selectedNodeId]);

  const positionsById = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    for (const node of layout.nodes) map.set(node.id, node);
    return map;
  }, [layout.nodes]);

  return (
    <div className="card overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between gap-3 px-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Workflow lineage</h3>
          <p className="mt-1 text-xs text-ink-500">Brief → Requirements → Plan → Validation → Release. Click a node to focus its chain.</p>
        </div>
        <Legend />
      </div>
      <div className="overflow-x-auto">
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="block"
        >
          {layout.stageOrder.map((stage, index) => (
            <text
              key={`stage-${stage}`}
              x={index * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_WIDTH / 2}
              y={18}
              textAnchor="middle"
              className="fill-ink-500 text-[11px] uppercase tracking-[0.18em]"
            >
              {STAGE_LABELS[stage]}
            </text>
          ))}

          {graph.edges.map((edge, index) => {
            const fromNode = positionsById.get(edge.from);
            const toNode = positionsById.get(edge.to);
            if (!fromNode || !toNode) return null;
            const isActive = !selectedNodeId || (highlight.has(edge.from) && highlight.has(edge.to));
            return (
              <EdgePath
                key={`edge-${index}`}
                from={fromNode}
                to={toNode}
                active={isActive}
              />
            );
          })}

          {layout.nodes.map((node) => {
            const tone = STATUS_TONE[node.status];
            const isSelected = selectedNodeId === node.id;
            const isMuted = Boolean(selectedNodeId) && !highlight.has(node.id);
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => onSelect?.(isSelected ? null : node)}
                className={cn("cursor-pointer transition-opacity", isMuted ? "opacity-40" : "opacity-100")}
              >
                <rect
                  width={COLUMN_WIDTH}
                  height={NODE_HEIGHT}
                  rx={14}
                  className={cn(tone.fill, tone.ring, isSelected && "stroke-accent-400")}
                  strokeWidth={isSelected ? 2 : 1}
                />
                <circle cx={14} cy={NODE_HEIGHT / 2} r={4} className={cn(tone.dot)} fill="currentColor" />
                <text x={28} y={24} className="fill-ink-100 text-[12px] font-medium">
                  {truncate(node.label, 26)}
                </text>
                <text x={28} y={42} className="fill-ink-400 text-[11px]">
                  {truncate(node.sublabel ?? tone.label, 30)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function EdgePath({ from, to, active }: { from: PositionedNode; to: PositionedNode; active: boolean }) {
  const x1 = from.x + COLUMN_WIDTH;
  const y1 = from.y + NODE_HEIGHT / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_HEIGHT / 2;
  const midX = (x1 + x2) / 2;
  const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  return (
    <path
      d={path}
      fill="none"
      strokeWidth={1.5}
      className={cn(
        "transition-opacity",
        active ? "stroke-ink-500" : "stroke-ink-700 opacity-30",
      )}
    />
  );
}

function Legend() {
  const items: LineageNodeStatus[] = ["done", "passed", "in_progress", "blocked", "failed", "pending", "empty"];
  return (
    <div className="hidden flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-ink-500 sm:flex">
      {items.map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5 rounded-full border border-ink-800 bg-ink-900/40 px-2 py-1">
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_TONE[status].dot)} />
          {STATUS_TONE[status].label}
        </span>
      ))}
    </div>
  );
}

function layoutGraph(graph: LineageGraph) {
  const stageBuckets = new Map<LineageStageKey, LineageNode[]>();
  for (const stage of graph.stageOrder) stageBuckets.set(stage, []);
  for (const node of graph.nodes) {
    const bucket = stageBuckets.get(node.stage);
    if (bucket) bucket.push(node);
  }

  const nodes: PositionedNode[] = [];
  graph.stageOrder.forEach((stage, columnIndex) => {
    const bucket = stageBuckets.get(stage) ?? [];
    bucket.forEach((node, rowIndex) => {
      nodes.push({
        ...node,
        column: columnIndex,
        row: rowIndex,
        x: columnIndex * (COLUMN_WIDTH + COLUMN_GAP),
        y: HEADER_HEIGHT + rowIndex * (NODE_HEIGHT + ROW_GAP),
      });
    });
  });

  const maxRows = Math.max(1, ...Array.from(stageBuckets.values()).map((bucket) => bucket.length));
  const width = graph.stageOrder.length * COLUMN_WIDTH + (graph.stageOrder.length - 1) * COLUMN_GAP;
  const height = HEADER_HEIGHT + maxRows * NODE_HEIGHT + (maxRows - 1) * ROW_GAP + 8;

  return { nodes, width, height, stageOrder: graph.stageOrder };
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}
