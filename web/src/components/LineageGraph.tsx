import { useMemo } from "react";
import type { LineageGraph, LineageNode, LineageNodeStatus, LineageStageKey } from "@/lib/lineage";
import { lineageNeighbors } from "@/lib/lineage";
import { cn } from "@/lib/utils";

const COLUMN_WIDTH = 220;
const COLUMN_GAP = 64;
const NODE_HEIGHT = 64;
const ROW_GAP = 18;
const HEADER_HEIGHT = 40;
const SELECTED_LABEL_OFFSET = 14;

const STAGE_LABELS: Record<LineageStageKey, string> = {
  brief: "BRIEF",
  requirements: "REQUIREMENTS",
  plan: "PLAN ITEMS",
  validation: "VALIDATION",
  release: "RELEASE",
};

const STATUS_TONE: Record<
  LineageNodeStatus,
  { fill: string; ring: string; dotFill: string; label: string }
> = {
  empty: {
    fill: "#0c0d10",
    ring: "#2a2c34",
    dotFill: "#3a3c45",
    label: "EMPTY",
  },
  pending: {
    fill: "#101116",
    ring: "#3a3c45",
    dotFill: "#80828d",
    label: "PENDING",
  },
  in_progress: {
    fill: "#14151a",
    ring: "#ffb000",
    dotFill: "#ffb000",
    label: "IN PROGRESS",
  },
  blocked: {
    fill: "#14151a",
    ring: "#ff3b30",
    dotFill: "#ff3b30",
    label: "BLOCKED",
  },
  passed: {
    fill: "#14151a",
    ring: "#00d68f",
    dotFill: "#00d68f",
    label: "PASSED",
  },
  failed: {
    fill: "#14151a",
    ring: "#ff3b30",
    dotFill: "#ff3b30",
    label: "FAILED",
  },
  done: {
    fill: "#14151a",
    ring: "#00d68f",
    dotFill: "#00d68f",
    label: "DONE",
  },
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
    <div className="bg-grid border border-ink-700 bg-ink-950">
      <div className="flex items-center justify-between border-b border-ink-700 bg-ink-950/80 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span className="kicker-amber">LINEAGE · STAGE GRAPH</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            BRIEF → REQ → PLAN → VALIDATION → RELEASE
          </span>
        </div>
        <Legend />
      </div>
      <div className="overflow-x-auto p-6">
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="block"
        >
          <defs>
            <marker
              id="lineage-arrow"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3a3c45" />
            </marker>
            <marker
              id="lineage-arrow-active"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#80828d" />
            </marker>
          </defs>

          {layout.stageOrder.map((stage, index) => {
            const x = index * (COLUMN_WIDTH + COLUMN_GAP);
            return (
              <g key={`stage-${stage}`}>
                <line
                  x1={x}
                  x2={x + COLUMN_WIDTH}
                  y1={HEADER_HEIGHT - 10}
                  y2={HEADER_HEIGHT - 10}
                  stroke="#2a2c34"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={HEADER_HEIGHT - 18}
                  textAnchor="start"
                  fill="#80828d"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={10}
                  letterSpacing="0.2em"
                >
                  {`§ 0${index + 1}  ${STAGE_LABELS[stage]}`}
                </text>
              </g>
            );
          })}

          {graph.edges.map((edge, index) => {
            const fromNode = positionsById.get(edge.from);
            const toNode = positionsById.get(edge.to);
            if (!fromNode || !toNode) return null;
            const isActive = !selectedNodeId || (highlight.has(edge.from) && highlight.has(edge.to));
            return (
              <EdgePath key={`edge-${index}`} from={fromNode} to={toNode} active={isActive} />
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
                className={cn(
                  "cursor-pointer transition-opacity",
                  isMuted ? "opacity-30" : "opacity-100",
                )}
              >
                {isSelected && (
                  <text
                    x={0}
                    y={-SELECTED_LABEL_OFFSET}
                    fill="#ffb000"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize={9}
                    letterSpacing="0.22em"
                  >
                    [SELECTED]
                  </text>
                )}
                <rect
                  width={COLUMN_WIDTH}
                  height={NODE_HEIGHT}
                  rx={0}
                  fill={tone.fill}
                  stroke={isSelected ? "#ffb000" : tone.ring}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <line
                  x1={0}
                  x2={COLUMN_WIDTH}
                  y1={22}
                  y2={22}
                  stroke="#1a1c22"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <rect x={0} y={0} width={3} height={NODE_HEIGHT} fill={tone.dotFill} />
                <text
                  x={12}
                  y={15}
                  fill="#80828d"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={9}
                  letterSpacing="0.2em"
                >
                  {tone.label}
                </text>
                <text
                  x={12}
                  y={38}
                  fill="#ebebef"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={11.5}
                  letterSpacing="0.02em"
                >
                  {truncate(node.label, 24)}
                </text>
                <text
                  x={12}
                  y={54}
                  fill="#80828d"
                  fontFamily="IBM Plex Sans, sans-serif"
                  fontSize={10.5}
                >
                  {truncate(node.sublabel ?? "—", 28)}
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
  const midX = x1 + (x2 - x1) / 2;
  // Orthogonal polyline: out, vertical, in
  const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  return (
    <path
      d={path}
      fill="none"
      strokeWidth={1}
      shapeRendering="crispEdges"
      stroke={active ? "#80828d" : "#2a2c34"}
      strokeDasharray={active ? undefined : "2 3"}
      markerEnd={active ? "url(#lineage-arrow-active)" : "url(#lineage-arrow)"}
    />
  );
}

function Legend() {
  const items: LineageNodeStatus[] = ["done", "passed", "in_progress", "blocked", "failed", "pending", "empty"];
  return (
    <div className="hidden flex-wrap items-center gap-3 sm:flex">
      {items.map((status) => (
        <span
          key={status}
          className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-400"
        >
          <span
            className="h-2 w-2"
            style={{ background: STATUS_TONE[status].dotFill }}
            aria-hidden
          />
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
  const height = HEADER_HEIGHT + maxRows * NODE_HEIGHT + (maxRows - 1) * ROW_GAP + 16;

  return { nodes, width, height, stageOrder: graph.stageOrder };
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}
