import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BrandingStrip } from '../BrandingStrip';

function setBranding(value?: string) {
  if (value === undefined) {
    delete (window as { __MINT_CONFIG__?: unknown }).__MINT_CONFIG__;
    return;
  }
  window.__MINT_CONFIG__ = { BRANDING: value } as never;
}

afterEach(() => {
  delete (window as { __MINT_CONFIG__?: unknown }).__MINT_CONFIG__;
});

describe('BrandingStrip', () => {
  it('renders the TACC and UT Austin logos under BRANDING=tacc', () => {
    setBranding('tacc');
    render(<BrandingStrip />);

    const tacc = screen.getByAltText('TACC Logo');
    const ut = screen.getByAltText('University of Texas at Austin Logo');
    expect(tacc).toHaveAttribute('src', '/images/tacc-white.png');
    expect(ut).toHaveAttribute('src', '/images/utaustin-white.png');
    expect(tacc.closest('a')).toHaveAttribute('href', 'https://www.tacc.utexas.edu/');
    expect(ut.closest('a')).toHaveAttribute('href', 'https://www.utexas.edu/');
  });

  // Shipping UT's shield to a site that is not TACC's is the failure with real
  // consequences, so every non-'tacc' value is asserted, not just the default.
  it.each([['none'], ['isi'], ['']])('renders nothing under BRANDING=%o', (value) => {
    setBranding(value);
    const { container } = render(<BrandingStrip />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByAltText(/University of Texas/)).not.toBeInTheDocument();
  });

  it('renders nothing when the key is absent', () => {
    window.__MINT_CONFIG__ = { HASURA_ENDPOINT: 'http://x/v1/graphql' } as never;
    const { container } = render(<BrandingStrip />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there is no runtime config at all', () => {
    setBranding(undefined);
    const { container } = render(<BrandingStrip />);
    expect(container).toBeEmptyDOMElement();
  });
});
