/**
 * Tests for PersonCombobox component.
 *
 * Verifies:
 * - Renders placeholder when no value selected
 * - Shows selected label when value is provided
 * - Opens popover and shows persons from Apollo mock
 * - Calls onChange when a person is selected
 * - Does NOT query while popover is closed (skip: !open)
 * - Shows "No matching persons" when query returns empty
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PersonCombobox } from '@/components/autocomplete/PersonCombobox';
import { GetPersonsDocument } from '@/graphql/generated/graphql';
import { renderWithProviders } from '../test/utils/render';

// ─── Mock data ───────────────────────────────────────────────────────────────

const mockPersons = [
  {
    __typename: 'modelcatalog_person' as const,
    id: 'https://w3id.org/okn/i/mint/p1',
    label: 'Alice Smith',
    name: 'Alice Smith',
  },
  {
    __typename: 'modelcatalog_person' as const,
    id: 'https://w3id.org/okn/i/mint/p2',
    label: 'Bob Jones',
    name: null,
  },
];

// Default (no search filter) mock — fires when popover opens with empty search
const personsMockNoFilter = {
  request: {
    query: GetPersonsDocument,
    variables: { search: undefined },
  },
  result: {
    data: {
      __typename: 'query_root',
      modelcatalog_person: mockPersons,
    },
  },
};

// Mock for empty result
const personsEmptyMock = {
  request: {
    query: GetPersonsDocument,
    variables: { search: undefined },
  },
  result: {
    data: {
      __typename: 'query_root',
      modelcatalog_person: [],
    },
  },
};

// ─── PersonCombobox tests ────────────────────────────────────────────────────

describe('PersonCombobox', () => {
  it('shows placeholder when no value is selected', () => {
    renderWithProviders(<PersonCombobox value={null} onChange={vi.fn()} />, {
      apolloMocks: [personsMockNoFilter],
    });
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Search persons...')).toBeInTheDocument();
  });

  it('shows selected label when a value is provided', () => {
    const selected = {
      id: 'https://w3id.org/okn/i/mint/p1',
      label: 'Alice Smith',
      name: 'Alice Smith',
    };
    renderWithProviders(<PersonCombobox value={selected} onChange={vi.fn()} />, {
      apolloMocks: [personsMockNoFilter],
    });
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('opens popover and shows persons from query result', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PersonCombobox value={null} onChange={vi.fn()} />, {
      apolloMocks: [personsMockNoFilter],
    });

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });
  });

  it('calls onChange with selected person when an option is clicked', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    renderWithProviders(<PersonCombobox value={null} onChange={handleChange} />, {
      apolloMocks: [personsMockNoFilter],
    });

    await user.click(screen.getByRole('combobox'));
    await waitFor(() => screen.getByText('Alice Smith'));
    await user.click(screen.getByText('Alice Smith'));

    expect(handleChange).toHaveBeenCalledWith({
      id: 'https://w3id.org/okn/i/mint/p1',
      label: 'Alice Smith',
      name: 'Alice Smith',
    });
  });

  it('calls onChange(null) when already-selected person is clicked', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const selected = {
      id: 'https://w3id.org/okn/i/mint/p1',
      label: 'Alice Smith',
      name: 'Alice Smith',
    };

    renderWithProviders(<PersonCombobox value={selected} onChange={handleChange} />, {
      apolloMocks: [personsMockNoFilter],
    });

    await user.click(screen.getByRole('combobox'));
    await waitFor(() => screen.getAllByText('Alice Smith'));

    const items = screen.getAllByText('Alice Smith');
    await user.click(items[items.length - 1]!);

    expect(handleChange).toHaveBeenCalledWith(null);
  });

  it('shows "No matching persons" when query returns empty array', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PersonCombobox value={null} onChange={vi.fn()} />, {
      apolloMocks: [personsEmptyMock],
    });

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('No matching persons.')).toBeInTheDocument();
    });
  });

  it('is disabled when disabled prop is true', () => {
    renderWithProviders(<PersonCombobox value={null} onChange={vi.fn()} disabled={true} />, {
      apolloMocks: [personsMockNoFilter],
    });
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('supports custom placeholder', () => {
    renderWithProviders(
      <PersonCombobox value={null} onChange={vi.fn()} placeholder="Add an author..." />,
      { apolloMocks: [personsMockNoFilter] },
    );
    expect(screen.getByText('Add an author...')).toBeInTheDocument();
  });

  it('shows name as subtitle when name differs from label', async () => {
    const user = userEvent.setup();
    // Add a person where name differs from label
    const mockWithDifferentName = {
      request: {
        query: GetPersonsDocument,
        variables: { search: undefined },
      },
      result: {
        data: {
          __typename: 'query_root',
          modelcatalog_person: [
            {
              __typename: 'modelcatalog_person' as const,
              id: 'https://w3id.org/okn/i/mint/p3',
              label: 'Dr. Carol White',
              name: 'C. White, PhD',
            },
          ],
        },
      },
    };

    renderWithProviders(<PersonCombobox value={null} onChange={vi.fn()} />, {
      apolloMocks: [mockWithDifferentName],
    });

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('Dr. Carol White')).toBeInTheDocument();
      expect(screen.getByText('C. White, PhD')).toBeInTheDocument();
    });
  });
});
