import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TreeNode } from '../TreeNode';
import type { TreeNodeData } from '@/hooks/useModelTree';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const leafNode: TreeNodeData = {
  nodeId: 'config:cfg1',
  entityId: 'cfg1',
  entityType: 'config',
  label: 'Default Config',
  children: [],
};

const setupNode: TreeNodeData = {
  nodeId: 'setup:setup1',
  entityId: 'setup1',
  entityType: 'setup',
  label: 'Ethiopia Setup',
  children: [],
};

const configWithSetup: TreeNodeData = {
  ...leafNode,
  children: [setupNode],
};

const versionNode: TreeNodeData = {
  nodeId: 'version:ver1',
  entityId: 'ver1',
  entityType: 'version',
  label: 'v2.2',
  children: [configWithSetup],
};

const softwareNode: TreeNodeData = {
  nodeId: 'software:sw1',
  entityId: 'sw1',
  entityType: 'software',
  label: 'PIHM',
  children: [versionNode],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeHandlers() {
  return {
    isExpanded: vi.fn().mockReturnValue(false),
    onToggle: vi.fn(),
    onSelect: vi.fn(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TreeNode', () => {
  it('renders the node label', () => {
    const { isExpanded, onToggle, onSelect } = makeHandlers();
    render(
      <ul>
        <TreeNode
          node={leafNode}
          depth={0}
          isExpanded={isExpanded}
          onToggle={onToggle}
          selectedEntityId={null}
          onSelect={onSelect}
        />
      </ul>,
    );
    expect(screen.getByText('Default Config')).toBeInTheDocument();
  });

  it('does not show a chevron for leaf nodes', () => {
    const { isExpanded, onToggle, onSelect } = makeHandlers();
    render(
      <ul>
        <TreeNode
          node={leafNode}
          depth={0}
          isExpanded={isExpanded}
          onToggle={onToggle}
          selectedEntityId={null}
          onSelect={onSelect}
        />
      </ul>,
    );
    expect(screen.queryByRole('button', { name: /expand|collapse/i })).not.toBeInTheDocument();
  });

  it('shows a chevron button for nodes with children', () => {
    const { isExpanded, onToggle, onSelect } = makeHandlers();
    render(
      <ul>
        <TreeNode
          node={configWithSetup}
          depth={0}
          isExpanded={isExpanded}
          onToggle={onToggle}
          selectedEntityId={null}
          onSelect={onSelect}
        />
      </ul>,
    );
    expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
  });

  it('calls onToggle when the chevron is clicked', async () => {
    const { isExpanded, onToggle, onSelect } = makeHandlers();
    const user = userEvent.setup();
    render(
      <ul>
        <TreeNode
          node={configWithSetup}
          depth={0}
          isExpanded={isExpanded}
          onToggle={onToggle}
          selectedEntityId={null}
          onSelect={onSelect}
        />
      </ul>,
    );
    await user.click(screen.getByRole('button', { name: /expand/i }));
    expect(onToggle).toHaveBeenCalledWith('config:cfg1');
  });

  it('calls onSelect when the node row is clicked', async () => {
    const { isExpanded, onToggle, onSelect } = makeHandlers();
    const user = userEvent.setup();
    render(
      <ul>
        <TreeNode
          node={leafNode}
          depth={0}
          isExpanded={isExpanded}
          onToggle={onToggle}
          selectedEntityId={null}
          onSelect={onSelect}
        />
      </ul>,
    );
    await user.click(screen.getByText('Default Config'));
    expect(onSelect).toHaveBeenCalledWith(leafNode);
  });

  it('highlights the selected node', () => {
    const { isExpanded, onToggle, onSelect } = makeHandlers();
    render(
      <ul>
        <TreeNode
          node={leafNode}
          depth={0}
          isExpanded={isExpanded}
          onToggle={onToggle}
          selectedEntityId="cfg1"
          onSelect={onSelect}
        />
      </ul>,
    );
    // We check aria-selected on the treeitem
    const item = screen.getByRole('treeitem');
    expect(item).toHaveAttribute('aria-selected', 'true');
  });

  it('renders children when expanded', () => {
    const isExpanded = vi.fn().mockImplementation((id) => id === 'config:cfg1');
    const { onToggle, onSelect } = makeHandlers();
    render(
      <ul>
        <TreeNode
          node={configWithSetup}
          depth={0}
          isExpanded={isExpanded}
          onToggle={onToggle}
          selectedEntityId={null}
          onSelect={onSelect}
        />
      </ul>,
    );
    // Ethiopia Setup child should be visible
    expect(screen.getByText('Ethiopia Setup')).toBeInTheDocument();
  });

  it('does not render children when collapsed', () => {
    const { isExpanded, onToggle, onSelect } = makeHandlers();
    isExpanded.mockReturnValue(false);
    render(
      <ul>
        <TreeNode
          node={configWithSetup}
          depth={0}
          isExpanded={isExpanded}
          onToggle={onToggle}
          selectedEntityId={null}
          onSelect={onSelect}
        />
      </ul>,
    );
    expect(screen.queryByText('Ethiopia Setup')).not.toBeInTheDocument();
  });

  it('renders the full hierarchy when all nodes are expanded', () => {
    // Expand all levels
    const isExpanded = vi.fn().mockReturnValue(true);
    const { onToggle, onSelect } = makeHandlers();
    render(
      <ul>
        <TreeNode
          node={softwareNode}
          depth={0}
          isExpanded={isExpanded}
          onToggle={onToggle}
          selectedEntityId={null}
          onSelect={onSelect}
        />
      </ul>,
    );
    expect(screen.getByText('PIHM')).toBeInTheDocument();
    expect(screen.getByText('v2.2')).toBeInTheDocument();
    expect(screen.getByText('Default Config')).toBeInTheDocument();
    expect(screen.getByText('Ethiopia Setup')).toBeInTheDocument();
  });

  it('sets aria-expanded on expandable nodes', () => {
    const isExpanded = vi.fn().mockReturnValue(true);
    const { onToggle, onSelect } = makeHandlers();
    render(
      <ul>
        <TreeNode
          node={configWithSetup}
          depth={0}
          isExpanded={isExpanded}
          onToggle={onToggle}
          selectedEntityId={null}
          onSelect={onSelect}
        />
      </ul>,
    );
    const item = screen.getAllByRole('treeitem')[0];
    expect(item).toHaveAttribute('aria-expanded', 'true');
  });
});
