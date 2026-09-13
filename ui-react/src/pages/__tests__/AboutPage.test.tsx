// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { AboutPage } from '@/pages/AboutPage';
import { EXPLORE_DESTINATIONS } from '@/components/home/explore-destinations';
import { renderWithProviders } from '@/test/utils/render';

describe('AboutPage', () => {
  it('keeps the DYNAMO description the landing page used to carry', () => {
    renderWithProviders(<AboutPage />);

    expect(
      screen.getByText(/helps analysts seamlessly use advanced simulation models/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/a hydrology model incorporates physical laws/i)).toBeInTheDocument();
    expect(
      screen.getByText(/reduce the time and effort needed to build integrated models/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/results are immediately accessible to the entire team/i),
    ).toBeInTheDocument();
  });

  it('orients the reader with the navigation the app actually has', () => {
    renderWithProviders(<AboutPage />);

    expect(screen.getByRole('heading', { name: 'Finding your way around' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Explore' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Decide' })).toBeInTheDocument();

    for (const destination of EXPLORE_DESTINATIONS) {
      expect(screen.getByRole('link', { name: destination.title })).toHaveAttribute(
        'href',
        destination.href,
      );
    }
  });

  it('does not resurrect the stale Getting Started instructions', () => {
    renderWithProviders(<AboutPage />);

    // The old card told users to use a "top menu" and a main-region control in
    // the top right. Neither exists.
    expect(screen.queryByText(/top menu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/always visible in the top right/i)).not.toBeInTheDocument();
  });

  it('offers a way back to the home page', () => {
    renderWithProviders(<AboutPage />);
    expect(screen.getByRole('link', { name: /back to the home page/i })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
