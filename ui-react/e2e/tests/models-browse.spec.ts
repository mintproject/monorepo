import { test, expect } from '../support/fixtures';

test.describe('Models browse (/models)', () => {
  test('renders grouped models and shows detail when a configuration is selected', async ({
    page,
  }) => {
    await page.goto('/models');

    // Both model groups from the full fixture render.
    await expect(page.getByRole('button', { name: 'MODFLOW' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PIHM' })).toBeVisible();

    // Empty detail prompt until something is selected.
    await expect(page.getByText('Select a configuration or setup on the left.')).toBeVisible();

    // Expand the MODFLOW group and open its configuration.
    await page.getByRole('button', { name: 'MODFLOW' }).click();
    await page.getByRole('link', { name: 'MODFLOW Barton Springs' }).click();

    // URL becomes the deep link and the detail pane resolves the configuration.
    await expect(page).toHaveURL(/\/modelconfigurations\/cfg-modflow$/);
    await expect(
      page.getByRole('heading', { name: 'MODFLOW Barton Springs', level: 2 }),
    ).toBeVisible();
    await expect(page.getByText('Inputs (1)')).toBeVisible();
    await expect(page.getByText('Outputs (1)')).toBeVisible();
  });

  test('text search filters the list locally without touching the URL', async ({ page }) => {
    await page.goto('/models');
    await expect(page.getByRole('button', { name: 'MODFLOW' })).toBeVisible();

    await page.getByPlaceholder('Filter by model name…').fill('PIHM');

    // Server-side-filtered fixture returns only PIHM; MODFLOW disappears.
    await expect(page.getByRole('button', { name: 'PIHM' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'MODFLOW' })).toHaveCount(0);

    // Text search is intentionally local — the URL must stay clean (no ?q=).
    await expect(page).toHaveURL(/\/models$/);
  });

  test('selecting a region facet writes to the URL and re-filters the list', async ({ page }) => {
    await page.goto('/models');
    await expect(page.getByRole('button', { name: 'PIHM' })).toBeVisible();

    // Open the Region facet and pick Texas (exact avoids the sidebar "Regions" nav).
    await page.getByRole('button', { name: 'Region', exact: true }).click();
    // Select via the cmdk search + Enter — the animated list overlay makes direct
    // option clicks flaky (intercepted pointer events).
    await page.getByPlaceholder('Search region…').fill('Texas');
    await page.getByRole('option', { name: 'Texas' }).waitFor();
    await page.keyboard.press('Enter');
    // Dismiss the popover.
    await page.keyboard.press('Escape');

    // The facet drives the URL (repeated `region` param).
    await expect(page).toHaveURL(/[?&]region=/);

    // The region-filtered fixture returns only MODFLOW.
    await expect(page.getByRole('button', { name: 'MODFLOW' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PIHM' })).toHaveCount(0);
  });
});
