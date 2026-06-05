import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { GetModelTreeDocument } from '@/graphql/generated/graphql';
import { ModelSelectionProvider } from '@/contexts/ModelSelectionContext';
import { renderWithProviders } from '@/test/utils/render';
import { ModelTree } from '../ModelTree';

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockTreeData = {
  modelcatalog_software: [
    {
      __typename: 'modelcatalog_software' as const,
      id: 'sw1',
      label: 'PIHM',
      versions: [
        {
          __typename: 'modelcatalog_software_version' as const,
          id: 'ver1',
          label: 'v2.2',
          version_id: '2.2',
          configurations: [
            {
              __typename: 'modelcatalog_configuration' as const,
              id: 'cfg1',
              label: 'Default Config',
              child_configurations: [
                {
                  __typename: 'modelcatalog_configuration' as const,
                  id: 'setup1',
                  label: 'Ethiopia Setup',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      __typename: 'modelcatalog_software' as const,
      id: 'sw2',
      label: 'CYCLES',
      versions: [],
    },
  ],
};

const treeQueryMock = {
  request: { query: GetModelTreeDocument },
  result: { data: mockTreeData },
};

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function renderModelTree() {
  return renderWithProviders(
    <ModelSelectionProvider>
      <ModelTree />
    </ModelSelectionProvider>,
    { apolloMocks: [treeQueryMock] },
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ModelTree', () => {
  it('shows loading state initially', () => {
    renderModelTree();
    expect(screen.getByText(/loading models/i)).toBeInTheDocument();
  });

  it('renders software nodes after data loads', async () => {
    renderModelTree();
    await waitFor(() => {
      expect(screen.getByText('PIHM')).toBeInTheDocument();
      expect(screen.getByText('CYCLES')).toBeInTheDocument();
    });
  });

  it('renders a search input', () => {
    renderModelTree();
    expect(screen.getByRole('searchbox', { name: /filter models/i })).toBeInTheDocument();
  });

  it('filters nodes when user types in the search box', async () => {
    const user = userEvent.setup();
    renderModelTree();

    await waitFor(() => expect(screen.getByText('PIHM')).toBeInTheDocument());

    await user.type(screen.getByRole('searchbox'), 'CYCLES');
    expect(screen.getByText('CYCLES')).toBeInTheDocument();
    expect(screen.queryByText('PIHM')).not.toBeInTheDocument();
  });

  it('shows a "no models match" message when filter has no results', async () => {
    const user = userEvent.setup();
    renderModelTree();

    await waitFor(() => expect(screen.getByText('PIHM')).toBeInTheDocument());

    await user.type(screen.getByRole('searchbox'), 'XYZNOTEXIST');
    expect(screen.getByText(/no models match/i)).toBeInTheDocument();
  });

  it('expands a software node and shows its versions when clicked', async () => {
    const user = userEvent.setup();
    renderModelTree();

    await waitFor(() => expect(screen.getByText('PIHM')).toBeInTheDocument());

    // Children should not be visible yet (version label includes version_id in parens)
    expect(screen.queryByText(/v2\.2/)).not.toBeInTheDocument();

    // Click the expand chevron on PIHM
    const expandBtn = screen.getAllByRole('button', { name: /expand/i })[0]!;
    await user.click(expandBtn);

    expect(screen.getByText(/v2\.2/)).toBeInTheDocument();
  });

  it('renders the model hierarchy as an accessible tree', async () => {
    renderModelTree();
    await waitFor(() => expect(screen.getByText('PIHM')).toBeInTheDocument());
    expect(screen.getByRole('tree', { name: /model hierarchy/i })).toBeInTheDocument();
  });

  it('shows error state when query fails', async () => {
    const errorMock = {
      request: { query: GetModelTreeDocument },
      error: new Error('Network error'),
    };
    renderWithProviders(
      <ModelSelectionProvider>
        <ModelTree />
      </ModelSelectionProvider>,
      { apolloMocks: [errorMock] },
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
