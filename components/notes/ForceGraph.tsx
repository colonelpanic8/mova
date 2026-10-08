"use dom";

import { forceX, forceY } from "d3-force-3d";
import type { DOMProps } from "expo/dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  default as ForceGraph2DComponent,
  ForceGraphMethods,
  LinkObject,
  NodeObject,
} from "react-force-graph-2d";

export interface ForceGraphNode {
  id: string;
  title: string;
  degree: number;
}

export interface ForceGraphLink {
  source: string;
  target: string;
  type: "link" | "parent";
}

export interface ForceGraphColors {
  background: string;
  text: string;
  link: string;
  highlight: string;
}

interface ForceGraphProps {
  nodes: ForceGraphNode[];
  links: ForceGraphLink[];
  selectedId: string | null;
  /** Center on this node; bump nonce to center again. */
  focus: { id: string; nonce: number } | null;
  colors: ForceGraphColors;
  onSelect: (id: string | null) => void;
  /** Double click, which org-roam-ui uses to open the local graph. */
  onOpen: (id: string) => void;
  dom?: DOMProps;
}

type GraphNode = NodeObject<ForceGraphNode>;
type GraphLink = LinkObject<ForceGraphNode, ForceGraphLink>;

// org-roam-ui's default degree palette (Chakra 500 shades).
const DEGREE_COLORS = [
  "#E53E3E",
  "#718096",
  "#D69E2E",
  "#38A169",
  "#00B5D8",
  "#3182CE",
  "#D53F8C",
  "#805AD5",
  "#DD6B20",
];
const NODE_REL_SIZE = 3;
const DOUBLE_CLICK_MS = 350;
const LABEL_LENGTH = 40;
const LABEL_WRAP = 25;

const nodeSize = (node: ForceGraphNode) => 3 + node.degree * 0.5;

/** Applies ALPHA to a hex or rgb()/rgba() color. */
function withAlpha(color: string, alpha: number) {
  const rgb = color.match(/\d+(\.\d+)?/g);
  if (color.startsWith("rgb") && rgb && rgb.length >= 3) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }
  const hex = color.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function wrapLabel(title: string) {
  const label =
    title.length > LABEL_LENGTH ? `${title.slice(0, LABEL_LENGTH)}…` : title;
  const lines: string[] = [];
  let line = "";
  for (const word of label.split(" ")) {
    if (line && line.length + word.length + 1 > LABEL_WRAP) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const endId = (end: GraphLink["source"]) =>
  typeof end === "object" ? (end as GraphNode).id : (end as string);

export default function ForceGraph({
  nodes,
  links,
  selectedId,
  focus,
  colors,
  onSelect,
  onOpen,
}: ForceGraphProps) {
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(
    undefined,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // force-graph touches window on import, which breaks static web rendering.
  const [ForceGraph2D, setForceGraph2D] = useState<
    typeof ForceGraph2DComponent | null
  >(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const lastClick = useRef<{ id: string; at: number } | null>(null);
  const fitPending = useRef(true);
  // force-graph keeps positions on the node objects, so reuse them across
  // filter changes instead of restarting the layout from scratch.
  const nodeCache = useRef(new Map<string, GraphNode>());

  useEffect(() => {
    void import("react-force-graph-2d").then((module) =>
      setForceGraph2D(() => module.default),
    );
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(() => {
    const cache = nodeCache.current;
    const graphNodes = nodes.map((node) => {
      const cached = cache.get(node.id);
      if (cached) return Object.assign(cached, node);
      const created: GraphNode = { ...node };
      cache.set(node.id, created);
      return created;
    });
    fitPending.current = true;
    return {
      nodes: graphNodes,
      links: links.map((link) => ({ ...link })) as GraphLink[],
    };
  }, [nodes, links]);

  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const link of links) {
      if (!map.has(link.source)) map.set(link.source, new Set());
      if (!map.has(link.target)) map.set(link.target, new Set());
      map.get(link.source)!.add(link.target);
      map.get(link.target)!.add(link.source);
    }
    return map;
  }, [links]);

  const activeId = hoverId ?? selectedId;
  const highlighted = useMemo(() => {
    if (!activeId) return null;
    return new Set([activeId, ...(neighbors.get(activeId) ?? [])]);
  }, [activeId, neighbors]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const charge = graph.d3Force("charge");
    charge?.strength(-120).distanceMax(400);
    graph.d3Force("x", forceX(0).strength(0.04));
    graph.d3Force("y", forceY(0).strength(0.04));
    graph.d3ReheatSimulation();
  }, [ForceGraph2D, size.width]);

  useEffect(() => {
    if (!focus) return;
    const center = () => {
      const node = nodeCache.current.get(focus.id);
      if (node?.x === undefined || node.y === undefined) return false;
      graphRef.current?.centerAt(node.x, node.y, 800);
      graphRef.current?.zoom(2, 800);
      return true;
    };
    if (!center()) {
      const timer = setTimeout(center, 800);
      return () => clearTimeout(timer);
    }
  }, [focus]);

  const drawNode = (
    node: GraphNode,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => {
    const isLit = !highlighted || highlighted.has(node.id);
    const isActive = node.id === activeId || node.id === selectedId;
    const radius =
      Math.sqrt(nodeSize(node)) * NODE_REL_SIZE * (isActive ? 1.2 : 1);
    const color =
      DEGREE_COLORS[Math.min(node.degree, DEGREE_COLORS.length - 1)];

    ctx.beginPath();
    ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI);
    ctx.fillStyle = isLit ? color : withAlpha(color, 0.15);
    ctx.fill();
    if (node.id === selectedId) {
      ctx.lineWidth = 2 / globalScale;
      ctx.strokeStyle = colors.highlight;
      ctx.stroke();
    }

    // org-roam-ui's dynamic labels: well-linked nodes are labelled first,
    // the rest fade in as you zoom.
    const fade = Math.min(
      5 * (globalScale - 1.5) + 2 * Math.pow(Math.min(node.degree, 8), 0.5),
      1,
    );
    const showLabel = highlighted ? highlighted.has(node.id) : fade > 0.01;
    if (!showLabel) return;
    const alpha = highlighted ? 1 : fade;
    // Graph units; on screen this grows gently with zoom up to 13px.
    const fontSize =
      Math.min(10 * Math.pow(globalScale, 0.6), 13) / globalScale;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = withAlpha(colors.text, alpha);
    wrapLabel(node.title).forEach((line, index) => {
      ctx.fillText(
        line,
        node.x!,
        node.y! + radius + fontSize * (0.9 + index * 1.1),
      );
    });
  };

  const isLitLink = (link: GraphLink) =>
    !!activeId &&
    (endId(link.source) === activeId || endId(link.target) === activeId);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: colors.background,
      }}
    >
      {ForceGraph2D && size.width > 0 && (
        <ForceGraph2D<ForceGraphNode, ForceGraphLink>
          ref={graphRef}
          width={size.width}
          height={size.height}
          graphData={graphData}
          backgroundColor={colors.background}
          nodeRelSize={NODE_REL_SIZE}
          nodeVal={nodeSize}
          nodeLabel={() => ""}
          nodeCanvasObject={drawNode}
          linkColor={(link) =>
            isLitLink(link)
              ? colors.highlight
              : withAlpha(colors.link, highlighted ? 0.15 : 0.6)
          }
          linkWidth={(link) => (isLitLink(link) ? 1.5 : 0.7)}
          linkLineDash={(link) => (link.type === "parent" ? [2, 2] : null)}
          cooldownTicks={300}
          onEngineStop={() => {
            if (fitPending.current) {
              fitPending.current = false;
              graphRef.current?.zoomToFit(400, 40);
            }
          }}
          onNodeHover={(node) => {
            setHoverId(node?.id ?? null);
            if (containerRef.current) {
              containerRef.current.style.cursor = node ? "pointer" : "";
            }
          }}
          onNodeClick={(node) => {
            const now = Date.now();
            const previous = lastClick.current;
            lastClick.current = { id: node.id, at: now };
            if (
              previous?.id === node.id &&
              now - previous.at < DOUBLE_CLICK_MS
            ) {
              onOpen(node.id);
            } else {
              onSelect(node.id);
            }
          }}
          onBackgroundClick={() => onSelect(null)}
        />
      )}
    </div>
  );
}
