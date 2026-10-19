import { expect, test, type Page } from '@playwright/test';

/** Recorridos de las fases 2–4 con una cuenta nueva de prueba (valores generados en cada corrida). */

async function register(page: Page) {
  const id = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const password = `Prueba-${id}-x`;
  await page.goto('/registro');
  await page.getByLabel('Nombre').fill('Prueba E2E');
  await page.getByLabel('Correo').fill(`e2e-${id}@example.test`);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByLabel('Confirma la contraseña').fill(password);
  await page.getByLabel(/aviso de privacidad/i).check();
  await page.getByRole('button', { name: /crear cuenta|registr/i }).click();
  await page.waitForURL(/\/(hoy|onboarding)/);
}

test.describe('rutas protegidas', () => {
  for (const path of ['/progreso', '/progreso/medidas', '/progreso/fotos', '/revision', '/nutricion', '/nutricion/plan', '/progreso/inbody']) {
    test(`${path} pide sesión`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('las API privadas responden 401 sin sesión', async ({ request }) => {
    expect((await request.get('/api/files/no-existe')).status()).toBe(401);
    expect((await request.get('/api/cron/checkins')).status()).toBe(401);
    expect((await request.post('/api/nutrition/plan')).status()).toBe(401);
  });
});

test.describe('cuenta nueva', () => {
  test('progreso, medidas, revisiones y nutrición sin datos', async ({ page }) => {
    await register(page);

    await page.goto('/progreso');
    await expect(page.getByRole('heading', { name: 'Tus números' })).toBeVisible();
    await expect(page.getByText('Sin sesiones todavía')).toBeVisible();

    await page.goto('/progreso/medidas');
    await page.getByLabel('Peso (kg)').fill('72.5');
    await page.getByLabel('Cintura (cm)').fill('80');
    await page.getByRole('button', { name: 'Guardar medición' }).click();
    await expect(page.getByText('72.5 kg · cintura 80')).toBeVisible();

    await page.goto('/revision');
    await expect(page.getByText('Primero el cuestionario')).toBeVisible();

    await page.goto('/nutricion');
    await expect(page.getByText('Faltan datos de tu perfil')).toBeVisible();

    await page.goto('/progreso/fotos');
    await expect(page.getByText('Acepto guardar fotos corporales con estas condiciones.')).toBeVisible();
  });
});
