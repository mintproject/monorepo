import { describe, expect, it } from 'vitest';

import type { WorkflowCanvasPosition } from '../WorkflowCanvas';
import {
  autoLayoutWorkflow,
  refreshWorkflowEdgeEndpoints,
  workflowGraphSignature,
} from '../workflowLayout';

interface TestNode {
  id: string;
}

function node(id: string, x: number, y: number): WorkflowCanvasPosition<TestNode> {
  return {
    node: { id },
    x,
    y,
    hasInputPort: true,
    hasOutputPort: true,
  };
}

describe('workflowLayout', () => {
  it('organizes visible nodes while retaining SVO edge labels and external endpoints', async () => {
    const positions = [node('model', 190, 56), node('etl', 190, 206)];
    const edges = [
      {
        id: 'input-to-model',
        source: 'input-1',
        target: 'model',
        from: { x: 8, y: 56 },
        to: { x: 190, y: 56 },
        label: 'aquifer__water_level',
      },
      {
        id: 'model-to-etl',
        source: 'model',
        target: 'etl',
        from: { x: 290, y: 160 },
        to: { x: 290, y: 206 },
        label: 'aquifer__volume_budget',
      },
      {
        id: 'etl-to-outcome',
        source: 'etl',
        target: 'outcome',
        from: { x: 390, y: 258 },
        to: { x: 504, y: 258 },
        label: 'spring__volume_flow_rate',
      },
    ];

    const result = await autoLayoutWorkflow(positions, edges, { minWidth: 0, minHeight: 0 });

    expect(result.positions.map(({ node: item }) => item.id)).toEqual(['model', 'etl']);
    expect(result.edges.map((edge) => edge.id)).toEqual([
      'input-to-model',
      'model-to-etl',
      'etl-to-outcome',
    ]);
    expect(result.edges.map((edge) => edge.label)).toEqual([
      'aquifer__water_level',
      'aquifer__volume_budget',
      'spring__volume_flow_rate',
    ]);
    expect(result.edges.every((edge) => edge.from.x < edge.to.x)).toBe(true);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('does not treat coordinate changes as a new graph', () => {
    const positions = [node('model', 190, 56)];
    const moved = [node('model', 24, 200)];
    const edges = [
      {
        id: 'model-to-outcome',
        source: 'model',
        target: 'outcome',
        from: { x: 390, y: 56 },
        to: { x: 504, y: 56 },
        label: 'spring__volume_flow_rate',
      },
    ];

    expect(workflowGraphSignature(positions, edges)).toBe(workflowGraphSignature(moved, edges));
  });

  it('moves connected endpoints when a visible node is dragged', () => {
    const edges = [
      {
        id: 'model-to-etl',
        source: 'model',
        target: 'etl',
        from: { x: 224, y: 52 },
        to: { x: 300, y: 52 },
        label: 'aquifer__volume_budget',
      },
    ];
    const updated = refreshWorkflowEdgeEndpoints(
      [node('model', 360, 40), node('etl', 700, 40)],
      edges,
    );

    expect(updated[0]?.from).toEqual({ x: 560, y: 92 });
    expect(updated[0]?.to).toEqual({ x: 700, y: 92 });
  });

  it('returns an empty fallback for an empty graph', async () => {
    const result = await autoLayoutWorkflow([], [], { minWidth: 520, minHeight: 380 });

    expect(result.positions).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.width).toBe(520);
    expect(result.height).toBe(380);
  });
});
