/**
 * Tests for MintParameters — parameter sweep configuration step.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils/render';
import { MintParameters } from '../MintParameters';
import type { ThreadExecutionData } from '@/graphql/generated/execution';

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockThreadDataNoModels: ThreadExecutionData = {
  id: 'thread-1',
  models: {},
  model_ensembles: {},
  execution_summary: {},
  data: {},
};

const mockThreadDataWithModel: ThreadExecutionData = {
  id: 'thread-1',
  models: {
    'model-1': {
      id: 'model-1',
      name: 'FloodModel',
      input_parameters: [
        {
          id: 'param-1',
          name: 'flood_depth',
          description: 'Depth threshold',
          type: 'float',
          min: '0',
          max: '100',
          default: '10',
        },
        {
          id: 'param-fixed',
          name: 'fixed_param',
          type: 'string',
          value: 'expert_value',
        },
      ],
      input_files: [],
      output_files: [],
    },
  },
  model_ensembles: {
    'model-1': {
      id: 'ensemble-1',
      bindings: {
        'param-1': ['10', '20'],
      },
    },
  },
  execution_summary: {
    'model-1': {
      total_runs: 2,
      submitted_runs: 0,
      failed_runs: 0,
      successful_runs: 0,
    },
  },
  data: {},
};

const mockThreadDataUnconfigured: ThreadExecutionData = {
  id: 'thread-1',
  models: {
    'model-1': {
      id: 'model-1',
      name: 'DroughtModel',
      input_parameters: [
        {
          id: 'param-a',
          name: 'threshold',
          type: 'int',
          min: '1',
          max: '50',
          default: '5',
        },
      ],
      input_files: [],
      output_files: [],
    },
  },
  model_ensembles: {
    'model-1': { id: 'ens-1', bindings: {} },
  },
  execution_summary: {
    'model-1': { total_runs: 0, submitted_runs: 0, failed_runs: 0, successful_runs: 0 },
  },
  data: {},
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MintParameters', () => {
  it('renders placeholder when no models are selected', () => {
    renderWithProviders(
      <MintParameters
        threadData={mockThreadDataNoModels}
        canWrite
        canExecute
        onSave={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByText(/please select model/i)).toBeInTheDocument();
  });

  it('renders model name when models exist', () => {
    renderWithProviders(
      <MintParameters
        threadData={mockThreadDataWithModel}
        canWrite
        canExecute
        onSave={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByText('FloodModel')).toBeInTheDocument();
  });

  it('shows the fixed expert parameter table', () => {
    renderWithProviders(
      <MintParameters
        threadData={mockThreadDataWithModel}
        canWrite
        canExecute
        onSave={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByText(/expert modeler has selected/i)).toBeInTheDocument();
    expect(screen.getByText('fixed param')).toBeInTheDocument();
  });

  it('shows the Continue button when parameters are already configured', () => {
    renderWithProviders(
      <MintParameters
        threadData={mockThreadDataWithModel}
        canWrite
        canExecute
        onSave={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByTestId('parameters-continue-btn')).toBeInTheDocument();
  });

  it('calls onContinue when Continue is clicked', () => {
    const onContinue = vi.fn();
    renderWithProviders(
      <MintParameters
        threadData={mockThreadDataWithModel}
        canWrite
        canExecute
        onSave={vi.fn()}
        onContinue={onContinue}
      />,
    );
    fireEvent.click(screen.getByTestId('parameters-continue-btn'));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('shows edit button and switches to edit mode when canWrite=true and params not done', () => {
    renderWithProviders(
      <MintParameters
        threadData={mockThreadDataUnconfigured}
        canWrite
        canExecute
        onSave={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    // In edit mode (isDone=false) — the save button should be present
    expect(screen.getByTestId('parameters-save-btn')).toBeInTheDocument();
  });

  it('renders adjustable parameter input field in edit mode', () => {
    renderWithProviders(
      <MintParameters
        threadData={mockThreadDataUnconfigured}
        canWrite
        canExecute
        onSave={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByTestId('param-input-param-a')).toBeInTheDocument();
  });

  it('renders "no adjustments possible" for model with only fixed params', () => {
    const dataOnlyFixed: ThreadExecutionData = {
      ...mockThreadDataWithModel,
      models: {
        'model-1': {
          id: 'model-1',
          name: 'StaticModel',
          input_parameters: [
            { id: 'p1', name: 'fixed', type: 'string', value: 'fixed_val' },
          ],
          input_files: [],
          output_files: [],
        },
      },
      model_ensembles: { 'model-1': { id: 'ens1', bindings: {} } },
    };
    renderWithProviders(
      <MintParameters
        threadData={dataOnlyFixed}
        canWrite
        canExecute
        onSave={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByText(/no adjustments possible/i)).toBeInTheDocument();
  });
});
