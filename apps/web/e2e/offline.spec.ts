import { expect, test } from '@playwright/test';

/**
 * Comportamiento sin conexión del service worker. Solo corre contra un build de producción (en desarrollo el SW
 * está apagado): PLAYWRIGHT_OFFLINE=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm test:e2e offline
 */
test.skip(!process.env.PLAYWRIGHT_OFFLINE, 'Requiere un build de producción con el service worker activo.');

test('la sesión en vivo abre sin red y las demás páginas muestran el aviso', async ({ page, context }) => {
  const id = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const password = `Prueba-${id}-x`;
  await page.goto('/registro');
  await page.getByLabel('Nombre').fill('Prueba Offline');
  await page.getByLabel('Correo').fill(`offline-${id}@example.test`);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByLabel('Confirma la contraseña').fill(password);
  await page.getByLabel(/aviso de privacidad/i).check();
  await page.getByRole('button', { name: /crear cuenta/i }).click();
  await page.waitForURL(/\/(hoy|onboarding)/);

  // Espera a que el SW controle la página y precachee.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 15_000 }).toBe(true);
  await page.goto('/entrenar');
  await expect(page.getByText(/sesión|entrenamiento/i).first()).toBeVisible();

  await context.setOffline(true);
  await page.goto('/entrenar?s=otra');
  await expect(page).toHaveTitle(/Sesión en vivo/);
  await page.goto('/progreso/medidas');
  await expect(page.getByRole('heading', { name: 'No hay red' })).toBeVisible();
  await context.setOffline(false);
});
