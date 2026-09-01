// @vitest-environment jsdom
import { FlaskConical } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { ExploreCard } from '@/components/home/ExploreCard';
import {
  EXPLORE_DESTINATIONS,
  type ExploreDestination,
} from '@/components/home/explore-destinations';
import { renderWithProviders } from '@/test/utils/render';

const destination: ExploreDestination = {
  key: 'models',
  href: '/models',
  icon: FlaskConical,
  title: 'Models',
  description: 'Simulation models and the configurations that are ready to run.',
  action: 'Browse models',
};

describe('ExploreCard', () => {
  it('makes the whole card the link to its section', () => {
    renderWithProviders(<ExploreCard destination={destination} />);

    const link = screen.getByRole('link', { name: /browse models/i });
    expect(link).toHaveAttribute('href', '/models');
    // Title and description live inside the same link, so the entire card is
    // one target rather than a card with a small link in the corner.
    expect(link).toHaveTextContent('Models');
    expect(link).toHaveTextContent(/simulation models/i);
  });

  it('names the action rather than repeating the section title', () => {
    renderWithProviders(<ExploreCard destination={destination} />);
    expect(screen.getByText('Browse models')).toBeInTheDocument();
  });

  it('shows how many things the section holds, grouped for readability', () => {
    renderWithProviders(<ExploreCard destination={destination} count={1204} />);
    expect(screen.getByText('1,204')).toBeInTheDocument();
  });

  it('renders without a number when the count is unavailable', () => {
    // The aggregate needs Hasura permissions the deployment may not have yet;
    // a missing count must cost a number, not the card.
    renderWithProviders(<ExploreCard destination={destination} />);
    expect(screen.getByRole('link', { name: /browse models/i })).toBeInTheDocument();
    expect(screen.queryByText(/^[\d,]+$/)).not.toBeInTheDocument();
  });
});

describe('EXPLORE_DESTINATIONS', () => {
  it('offers exactly the four ways into the catalog', () => {
    expect(EXPLORE_DESTINATIONS.map((d) => d.title)).toEqual([
      'Models',
      'Datasets',
      'Regions',
      'Variables',
    ]);
  });

  it('points every card at a distinct route', () => {
    const routes = EXPLORE_DESTINATIONS.map((d) => d.href);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('gives every card a distinct key, so counts cannot land on the wrong one', () => {
    const keys = EXPLORE_DESTINATIONS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
