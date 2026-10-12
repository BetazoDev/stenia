import { expect, test } from '@playwright/test';

test.describe('acceso', () => {
  test('la raíz redirige a /login sin sesión', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('la página de registro muestra el consentimiento de privacidad', async ({ page }) => {
    await page.goto('/registro');
    await expect(page.getByLabel(/aviso de privacidad/i)).toBeVisible();
  });

  test('el endpoint de salud responde', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBe(true);
  });
});
