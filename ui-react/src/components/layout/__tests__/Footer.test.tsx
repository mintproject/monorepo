import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Footer } from '../Footer';

afterEach(() => {
  delete (window as { __MINT_CONFIG__?: unknown }).__MINT_CONFIG__;
});

describe('Footer', () => {
  it('credits MINT and links to the project site', () => {
    render(<Footer />);
    expect(screen.getByText(/Powered by/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'MINT' })).toHaveAttribute(
      'href',
      'http://mint-project.info/index.html',
    );
  });

  // The MINT credit is not co-branding: it shows for an unbranded deployment
  // too, unlike the institutional strip.
  it('renders without a runtime config', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
