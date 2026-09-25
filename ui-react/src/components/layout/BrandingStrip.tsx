import { Fragment } from 'react';

import { getBrandingPreset } from '@/lib/branding';
import { cn } from '@/lib/utils';

/**
 * The co-branding strip above the header: host-institution logos on the dark
 * chrome, centred, 50px tall. Renders nothing unless the deployment names a
 * preset via the runtime `BRANDING` key.
 *
 * Geometry copied from TACC's own branding-header, via mint-ui-lit's
 * `mint-app.ts`. The logo height is 28px rather than the 24px Lit uses: UT's
 * minimum-size rule governs the shield, which is 77.5% of the image height, so
 * 24px renders a 21.7px shield against a 25px minimum. The separator clears
 * each logo by the shield width, 17px.
 */
export function BrandingStrip({ inline = false }: { inline?: boolean }) {
  const preset = getBrandingPreset();
  if (!preset) return null;

  return (
    <div
      data-testid="branding-strip"
      className={cn(
        'mint-chrome flex items-center justify-center',
        inline
          ? 'absolute left-1/2 h-[36px] -translate-x-1/2'
          : 'h-[50px] shrink-0 border-b border-white bg-[color:var(--mint-chrome-bg)]',
      )}
    >
      {preset.logos.map((logo, i) => (
        <Fragment key={logo.href}>
          {i > 0 && <span aria-hidden="true" className="mx-[17px] h-[28px] w-px bg-white" />}
          <a href={logo.href} target="_blank" rel="noreferrer" aria-label="Opens in new window.">
            <img src={logo.src} alt={logo.alt} className="h-[28px] w-auto" />
          </a>
        </Fragment>
      ))}
    </div>
  );
}
