import { test, expect } from '../support/fixtures';

test.describe('Register model (/models/register)', () => {
  test('authenticated user can create a standalone model', async ({ page, authenticated }) => {
    // `authenticated` seeds the fake JWT before the app boots, so the protected
    // route renders instead of redirecting to the IdP.
    void authenticated;

    await page.goto('/models/register');

    // Protected page renders for the authenticated user.
    await expect(page.getByRole('heading', { name: 'Register Model' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create a new model' })).toBeVisible();

    // Minimal happy path: a name is the only required field.
    await page.getByPlaceholder(/Barton Springs/).fill('E2E Test Model');
    await page.getByRole('button', { name: 'Create model' }).click();

    // CreateConfiguration is mocked → success toast, then navigation to the
    // configure page for the new model.
    await expect(page.getByText('Model created', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/models\/configure\//);
  });
});
