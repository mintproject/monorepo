import { test, expect } from '../support/fixtures';

const IDP_GLOB = 'https://portals.tapis.io/**';

test.describe('Protected route guard', () => {
  test('anonymous visit to /models/register redirects to the IdP', async ({ page }) => {
    // Stub the IdP so the OAuth redirect stays offline and controlled.
    let authRedirectUrl = '';
    await page.route(IDP_GLOB, (route) => {
      authRedirectUrl = route.request().url();
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>IdP stub</body></html>',
      });
    });

    await page.goto('/models/register');

    // No token → ProtectedRoute bounces to /login-required, which initiates the
    // OAuth2 redirect. We should land on the (stubbed) IdP authorize endpoint.
    await expect(page).toHaveURL(/portals\.tapis\.io\/v3\/oauth2\/authorize/);

    // The redirect carries the OAuth params, proving the real auth flow fired.
    expect(authRedirectUrl).toContain('client_id=');
    expect(authRedirectUrl).toContain('redirect_uri=');
    expect(decodeURIComponent(authRedirectUrl)).toContain('/oauth2/callback');

    // The protected page itself never rendered.
    await expect(page.getByRole('heading', { name: 'Register Model' })).toHaveCount(0);
  });
});
