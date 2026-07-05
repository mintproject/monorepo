import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/utils/render';
import { ModelGroupList } from '@/components/models-browse/ModelGroupList';
import type { ModelGroup } from '@/lib/groupConfigurations';

const groups: ModelGroup[] = [
  {
    softwareId: 'm1',
    softwareLabel: 'MODFLOW',
    configs: [
      {
        id: 'https://w3id.org/okn/i/mint/cfg-1',
        label: 'Calibration',
        versionId: 'v2.0',
        synthesized: false,
        setups: [{ id: 'https://w3id.org/okn/i/mint/setup-1', label: 'Travis Co.' }],
      },
      {
        id: 'https://w3id.org/okn/i/mint/cfg-2',
        label: 'Forecast (container)',
        versionId: null,
        synthesized: true,
        setups: [],
      },
    ],
  },
];

describe('ModelGroupList', () => {
  it('shows an empty message when there are no groups', () => {
    renderWithProviders(<ModelGroupList groups={[]} selectedSlug={null} expandAll={false} />);
    expect(screen.getByText(/no models match/i)).toBeInTheDocument();
  });

  it('renders model, configs, version badge, and nested setups when expanded', () => {
    renderWithProviders(<ModelGroupList groups={groups} selectedSlug={null} expandAll />);
    expect(screen.getByText('MODFLOW')).toBeInTheDocument();
    expect(screen.getByText('Calibration')).toBeInTheDocument();
    expect(screen.getByText('v2.0')).toBeInTheDocument();
    expect(screen.getByText('Travis Co.')).toBeInTheDocument();
  });

  it('links rows to /modelconfigurations/<slug>', () => {
    renderWithProviders(<ModelGroupList groups={groups} selectedSlug={null} expandAll />);
    const setupLink = screen.getByText('Travis Co.').closest('a');
    expect(setupLink).toHaveAttribute('href', '/modelconfigurations/setup-1');
  });

  it('links rows under a custom basePath (configure mode)', () => {
    renderWithProviders(
      <ModelGroupList groups={groups} selectedSlug={null} expandAll basePath="/models/configure" />,
    );
    const configLink = screen.getByText('Calibration').closest('a');
    expect(configLink).toHaveAttribute('href', '/models/configure/cfg-1');
    const setupLink = screen.getByText('Travis Co.').closest('a');
    expect(setupLink).toHaveAttribute('href', '/models/configure/setup-1');
  });

  it('dims a synthesized container config', () => {
    renderWithProviders(<ModelGroupList groups={groups} selectedSlug={null} expandAll />);
    const link = screen.getByText('Forecast (container)').closest('a');
    expect(link?.className).toContain('italic');
  });

  it('highlights the selected slug', () => {
    renderWithProviders(<ModelGroupList groups={groups} selectedSlug="cfg-1" expandAll />);
    const link = screen.getByText('Calibration').closest('a');
    expect(link?.className).toContain('bg-accent');
  });
});
