/**
 * Tests for ExecutionFilesDialog — the archived files of one run.
 *
 * The dialog is the repair for #261: a model configuration registered from a
 * Tapis application declares no output, so publication answers 422. The user
 * promotes a file here, then publishes.
 */
import type { MockedResponse } from '@apollo/client/testing';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { AddConfigurationOutputDocument } from '@/graphql/generated/graphql';
import { EnsembleManagerError } from '@/lib/ensemble-manager';
import { renderWithProviders } from '@/test/utils/render';
import { ExecutionFilesDialog } from '../ExecutionFilesDialog';

const FILES = [
  { name: 'rainfall.tif', path: 'output/rainfall.tif', size: 2048, url: 'tapis://tacc/rainfall' },
  { name: 'notes.txt', path: 'output/notes.txt', size: 12, url: 'tapis://tacc/notes' },
];

/**
 * The mutation mock matches on a callback, not on fixed variables: the output
 * id is a fresh URI on every promotion, so a literal `variables` block would
 * never match.
 */
function addOutputMock(seen: { variables?: Record<string, unknown> }): MockedResponse {
  return {
    request: { query: AddConfigurationOutputDocument },
    variableMatcher: (variables) => {
      seen.variables = variables as Record<string, unknown>;
      return true;
    },
    result: {
      data: {
        insert_modelcatalog_configuration_output_one: {
          __typename: 'modelcatalog_configuration_output',
          configuration_id: 'http://config/1',
          output_id: 'http://output/new',
          output: {
            __typename: 'modelcatalog_dataset_specification',
            id: 'http://output/new',
            label: 'rainfall.tif',
          },
        },
      },
    },
  };
}

function renderDialog(
  props: Partial<React.ComponentProps<typeof ExecutionFilesDialog>> = {},
  apolloMocks: MockedResponse[] = [],
) {
  return renderWithProviders(
    <ExecutionFilesDialog
      open
      executionId="exec-1"
      configurationId="http://config/1"
      declaredOutputLabels={[]}
      ensembleManagerApi="http://ensemble"
      canWrite
      onClose={vi.fn()}
      {...props}
    />,
    { apolloMocks },
  );
}

describe('ExecutionFilesDialog', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: FILES }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the files the run archived', async () => {
    renderDialog();
    expect(await screen.findByText('rainfall.tif')).toBeInTheDocument();
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
    expect((globalThis.fetch as unknown as Mock).mock.calls[0]?.[0]).toBe(
      'http://ensemble/executions/exec-1/files',
    );
  });

  it('says so plainly when the run archived nothing', async () => {
    (globalThis.fetch as unknown as Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ files: [] }),
    });
    renderDialog();
    expect(await screen.findByText(/archived no file/i)).toBeInTheDocument();
  });

  it("shows the server's message when the list cannot be read", async () => {
    (globalThis.fetch as unknown as Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'This instance runs localex' }),
    });
    renderDialog();
    expect(await screen.findByText(/This instance runs localex/)).toBeInTheDocument();
  });

  it('marks a file that the configuration already declares', async () => {
    renderDialog({ declaredOutputLabels: ['rainfall.tif'] });
    await screen.findByText('rainfall.tif');
    expect(screen.getByText('Declared')).toBeInTheDocument();
    // A second promotion of the same file would make two outputs compete for it.
    expect(screen.queryByTestId('promote-output/rainfall.tif')).not.toBeInTheDocument();
    expect(screen.getByTestId('promote-output/notes.txt')).toBeInTheDocument();
  });

  it('offers no promote action to a user who cannot write', async () => {
    renderDialog({ canWrite: false });
    await screen.findByText('rainfall.tif');
    expect(screen.queryByTestId('promote-output/rainfall.tif')).not.toBeInTheDocument();
    expect(screen.getAllByText('Raw artifact')).toHaveLength(2);
  });

  it('promotes a file as an output seeded from its name and extension', async () => {
    const seen: { variables?: Record<string, unknown> } = {};
    const onPromoted = vi.fn();
    renderDialog({ onPromoted }, [addOutputMock(seen)]);

    fireEvent.click(await screen.findByTestId('promote-output/rainfall.tif'));

    await waitFor(() => expect(onPromoted).toHaveBeenCalled());
    expect(seen.variables).toMatchObject({
      configurationId: 'http://config/1',
      outputLabel: 'rainfall.tif',
      hasFormat: 'tif',
      // 1-indexed: the Ensemble Manager reads a falsy position as an absent one.
      position: 1,
      presentations: [],
    });
  });

  it('marks the file as declared once it is promoted', async () => {
    renderDialog({}, [addOutputMock({})]);
    fireEvent.click(await screen.findByTestId('promote-output/rainfall.tif'));
    expect(await screen.findByText('Declared')).toBeInTheDocument();
  });

  it('shows the write failure, so a refusal by Hasura is not a dead button', async () => {
    renderDialog({}, [
      {
        request: { query: AddConfigurationOutputDocument },
        variableMatcher: () => true,
        error: new Error('permission denied for table'),
      },
    ]);
    fireEvent.click(await screen.findByTestId('promote-output/rainfall.tif'));
    expect(await screen.findByTestId('promote-error')).toHaveTextContent(/permission denied/);
  });

  it('says an output with no standard variable cannot match a modeling task', async () => {
    renderDialog();
    expect(await screen.findByText(/cannot match a modeling task/i)).toBeInTheDocument();
  });

  it('refuses to publish while nothing is declared as an output', async () => {
    renderDialog({ onPublish: vi.fn() });
    await screen.findByText('rainfall.tif');
    expect(screen.getByTestId('publish-execution')).toBeDisabled();
  });

  it('publishes this one execution when the user asks', async () => {
    const onPublish = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onPublish, declaredOutputLabels: ['rainfall.tif'] });

    fireEvent.click(await screen.findByTestId('publish-execution'));

    await waitFor(() => expect(onPublish).toHaveBeenCalledWith('exec-1'));
    expect(await screen.findByTestId('publish-execution-done')).toBeInTheDocument();
  });

  it('asks for a promotion when publication answers 422 NO_OUTPUTS_DECLARED', async () => {
    const onPublish = vi
      .fn()
      .mockRejectedValue(
        new EnsembleManagerError(422, 'no outputs declared', 'NO_OUTPUTS_DECLARED'),
      );
    renderDialog({ onPublish, declaredOutputLabels: ['rainfall.tif'] });

    fireEvent.click(await screen.findByTestId('publish-execution'));

    expect(await screen.findByTestId('publish-execution-error')).toHaveTextContent(
      /Promote a file above/i,
    );
  });

  it('shows any other publication failure as it is', async () => {
    const onPublish = vi.fn().mockRejectedValue(new Error('CKAN returned 403'));
    renderDialog({ onPublish, declaredOutputLabels: ['rainfall.tif'] });

    fireEvent.click(await screen.findByTestId('publish-execution'));

    expect(await screen.findByTestId('publish-execution-error')).toHaveTextContent(
      /CKAN returned 403/,
    );
  });

  it('offers no publish button when publishing is not available', async () => {
    renderDialog({ declaredOutputLabels: ['rainfall.tif'] });
    await screen.findByText('rainfall.tif');
    expect(screen.queryByTestId('publish-execution')).not.toBeInTheDocument();
  });
});
