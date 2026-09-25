import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled';

import type { WorkflowCanvasEdge, WorkflowCanvasPosition } from './WorkflowCanvas';

const NODE_HEIGHT = 104;
const EXTERNAL_NODE_SIZE = 2;
const EDGE_LABEL_WIDTH = 160;
const EDGE_LABEL_HEIGHT = 24;
const GRAPH_PADDING = 28;

export interface WorkflowAutoLayoutOptions {
  direction?: 'RIGHT' | 'DOWN';
  nodeWidth?: number;
  nodeHeight?: number;
  minWidth?: number;
  minHeight?: number;
}

export interface WorkflowAutoLayoutResult<T extends { id: string }> {
  positions: WorkflowCanvasPosition<T>[];
  edges: WorkflowCanvasEdge[];
  width: number;
  height: number;
}

interface LayoutPoint {
  x: number;
  y: number;
  width: number;
  height: number;
}

function graphSignature<T extends { id: string }>(
  positions: WorkflowCanvasPosition<T>[],
  edges: WorkflowCanvasEdge[],
): string {
  return JSON.stringify({
    nodes: positions.map(({ node }) => node.id),
    edges: edges.map((edge, index) => ({
      id: edge.id ?? `edge-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.label ?? null,
    })),
  });
}

function directionBetween(source: LayoutPoint, target: LayoutPoint): 'horizontal' | 'vertical' {
  return Math.abs(target.x - source.x) >= Math.abs(target.y - source.y) ? 'horizontal' : 'vertical';
}

function boundaryPoint(
  point: LayoutPoint,
  other: LayoutPoint,
  _role: 'source' | 'target',
): { x: number; y: number } {
  const horizontal = directionBetween(point, other) === 'horizontal';
  if (horizontal) {
    const towardRight = other.x >= point.x;
    return {
      x: towardRight ? point.x + point.width : point.x,
      y: point.y + point.height / 2,
    };
  }
  const towardBottom = other.y >= point.y;
  return {
    x: point.x + point.width / 2,
    y: towardBottom ? point.y + point.height : point.y,
  };
}

function portSides(
  source: LayoutPoint,
  target: LayoutPoint,
): Pick<WorkflowCanvasPosition<{ id: string }>, 'inputPortSide' | 'outputPortSide'> {
  if (directionBetween(source, target) === 'horizontal') {
    return { inputPortSide: 'left', outputPortSide: 'right' };
  }
  return { inputPortSide: 'top', outputPortSide: 'bottom' };
}

function fallbackResult<T extends { id: string }>(
  positions: WorkflowCanvasPosition<T>[],
  edges: WorkflowCanvasEdge[],
  minWidth: number,
  minHeight: number,
): WorkflowAutoLayoutResult<T> {
  return {
    positions,
    edges,
    width: minWidth,
    height: Math.max(minHeight, ...positions.map((position) => position.y + NODE_HEIGHT + 32)),
  };
}

function layoutPointForPosition<T extends { id: string }>(
  position: WorkflowCanvasPosition<T>,
  nodeHeight: number,
): LayoutPoint {
  return {
    x: position.x,
    y: position.y,
    width: 200,
    height: nodeHeight,
  };
}

export function refreshWorkflowEdgeEndpoints<T extends { id: string }>(
  positions: WorkflowCanvasPosition<T>[],
  edges: WorkflowCanvasEdge[],
  nodeHeight = NODE_HEIGHT,
): WorkflowCanvasEdge[] {
  const points = new Map(
    positions.map((position) => [position.node.id, layoutPointForPosition(position, nodeHeight)]),
  );

  return edges.map((edge) => {
    const source = edge.source ? points.get(edge.source) : undefined;
    const target = edge.target ? points.get(edge.target) : undefined;
    if (!source && !target) return edge;

    const sourceOther = target ?? {
      x: edge.to.x,
      y: edge.to.y,
      width: 0,
      height: 0,
    };
    const targetOther = source ?? {
      x: edge.from.x,
      y: edge.from.y,
      width: 0,
      height: 0,
    };

    return {
      ...edge,
      from: source ? boundaryPoint(source, sourceOther, 'source') : edge.from,
      to: target ? boundaryPoint(target, targetOther, 'target') : edge.to,
    };
  });
}

export function workflowGraphSignature<T extends { id: string }>(
  positions: WorkflowCanvasPosition<T>[],
  edges: WorkflowCanvasEdge[],
): string {
  return graphSignature(positions, edges);
}

export async function autoLayoutWorkflow<T extends { id: string }>(
  positions: WorkflowCanvasPosition<T>[],
  edges: WorkflowCanvasEdge[],
  options: WorkflowAutoLayoutOptions = {},
): Promise<WorkflowAutoLayoutResult<T>> {
  const nodeWidth = options.nodeWidth ?? 200;
  const nodeHeight = options.nodeHeight ?? NODE_HEIGHT;
  const minWidth = options.minWidth ?? 520;
  const minHeight = options.minHeight ?? 380;

  if (positions.length === 0) return fallbackResult(positions, edges, minWidth, minHeight);

  const visibleIds = new Set(positions.map((position) => position.node.id));
  const externalIds = new Set<string>();
  const externalRoles = new Map<string, 'source' | 'target'>();
  edges.forEach((edge, index) => {
    const source = edge.source ?? `workflow-edge-source-${index}`;
    const target = edge.target ?? `workflow-edge-target-${index}`;
    if (!visibleIds.has(source)) {
      externalIds.add(source);
      externalRoles.set(source, 'source');
    }
    if (!visibleIds.has(target)) {
      externalIds.add(target);
      externalRoles.set(target, 'target');
    }
  });

  const elkEdges = edges.map((edge, index) => ({
    id: edge.id ?? `workflow-edge-${index}`,
    sources: [edge.source ?? `workflow-edge-source-${index}`],
    targets: [edge.target ?? `workflow-edge-target-${index}`],
    labels: edge.label
      ? [
          {
            id: `${edge.id ?? `workflow-edge-${index}`}-label`,
            text: edge.label,
            width: EDGE_LABEL_WIDTH,
            height: EDGE_LABEL_HEIGHT,
          },
        ]
      : undefined,
  }));

  const graph: ElkNode = {
    id: 'workflow-root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': options.direction ?? 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.padding': `[top=${GRAPH_PADDING},left=${GRAPH_PADDING},bottom=${GRAPH_PADDING},right=${GRAPH_PADDING}]`,
      'elk.spacing.nodeNode': '48',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.layered.spacing.edgeNodeBetweenLayers': '40',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    },
    children: [
      ...positions.map((position) => ({
        id: position.node.id,
        width: nodeWidth,
        height: nodeHeight,
      })),
      ...Array.from(externalIds, (id) => ({
        id,
        width: EXTERNAL_NODE_SIZE,
        height: EXTERNAL_NODE_SIZE,
        layoutOptions: {
          'elk.layered.layering.layerConstraint':
            externalRoles.get(id) === 'source' ? 'FIRST' : 'LAST',
        },
      })),
    ],
    edges: elkEdges,
  };

  try {
    const laidOut = await new ELK().layout(graph);
    const layoutById = new Map<string, LayoutPoint>();
    laidOut.children?.forEach((child) => {
      if (child.x == null || child.y == null) return;
      layoutById.set(child.id, {
        x: child.x,
        y: child.y,
        width: child.width ?? (visibleIds.has(child.id) ? nodeWidth : EXTERNAL_NODE_SIZE),
        height: child.height ?? (visibleIds.has(child.id) ? nodeHeight : EXTERNAL_NODE_SIZE),
      });
    });

    if (layoutById.size < positions.length) {
      return fallbackResult(positions, edges, minWidth, minHeight);
    }

    const nextPositions = positions.map((position) => {
      const point = layoutById.get(position.node.id);
      if (!point) return position;
      const connectedEdges = edges.filter(
        (edge) => edge.source === position.node.id || edge.target === position.node.id,
      );
      const incoming = connectedEdges.find((edge) => edge.target === position.node.id);
      const outgoing = connectedEdges.find((edge) => edge.source === position.node.id);
      const incomingPoint = incoming ? layoutById.get(incoming.source ?? '') : undefined;
      const outgoingPoint = outgoing ? layoutById.get(outgoing.target ?? '') : undefined;
      return {
        ...position,
        x: point.x,
        y: point.y,
        inputPortSide:
          incoming && incomingPoint
            ? portSides(incomingPoint, point).inputPortSide
            : position.inputPortSide,
        outputPortSide:
          outgoing && outgoingPoint
            ? portSides(point, outgoingPoint).outputPortSide
            : position.outputPortSide,
      };
    });

    const nextEdges = edges.map((edge, index) => {
      const source = layoutById.get(edge.source ?? `workflow-edge-source-${index}`);
      const target = layoutById.get(edge.target ?? `workflow-edge-target-${index}`);
      if (!source || !target) return edge;
      return {
        ...edge,
        from: boundaryPoint(source, target, 'source'),
        to: boundaryPoint(target, source, 'target'),
      };
    });

    return {
      positions: nextPositions,
      edges: nextEdges,
      width: Math.max(minWidth, (laidOut.width ?? minWidth) + GRAPH_PADDING),
      height: Math.max(minHeight, (laidOut.height ?? minHeight) + GRAPH_PADDING),
    };
  } catch {
    return fallbackResult(positions, edges, minWidth, minHeight);
  }
}
