/**
 * Co-branding presets for the app chrome.
 *
 * One flat runtime key, `BRANDING`, selects a preset by name. The logo files,
 * link targets and alt text live here rather than in the config so that they
 * stay under code review: a deployment can pick a preset, it cannot invent one
 * with the wrong alt text or a hotlinked logo.
 *
 * Unknown and absent values both resolve to no branding. Shipping UT logos to a
 * site that is not TACC's is the failure with real consequences, so anything
 * other than an exact preset name fails closed.
 */

export interface BrandingLogo {
  /** Where the logo links. Opens in a new tab. */
  href: string;
  /** Path under public/, served from the web root. */
  src: string;
  alt: string;
}

export interface BrandingPreset {
  /** Rendered left to right, separated by a vertical rule. */
  logos: BrandingLogo[];
}

const PRESETS: Record<string, BrandingPreset> = {
  /**
   * TACC and UT Austin, as mint.tacc.utexas.edu has shown since the Lit app.
   * The PNGs are the files TACC serves itself, copied from mint-ui-lit.
   */
  tacc: {
    logos: [
      {
        href: 'https://www.tacc.utexas.edu/',
        src: '/images/tacc-white.png',
        alt: 'TACC Logo',
      },
      {
        href: 'https://www.utexas.edu/',
        src: '/images/utaustin-white.png',
        alt: 'University of Texas at Austin Logo',
      },
    ],
  },
};

/**
 * Returns the preset named by the runtime `BRANDING` key, or null when the
 * deployment is unbranded.
 *
 * Reads window.__MINT_CONFIG__ directly rather than through getRuntimeConfig(),
 * whose fallback branch describes only the endpoint keys.
 */
export function getBrandingPreset(): BrandingPreset | null {
  const key = window.__MINT_CONFIG__?.BRANDING;
  if (!key || key === 'none') return null;
  return PRESETS[key] ?? null;
}
