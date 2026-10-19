# Despliegue manual en Dokploy (servidor 93.188.167.69)

Guía para terminar el despliegue desde la interfaz de Dokploy, sin el MCP. Lo que ya existe en ese servidor desde
el 2026-10-12: proyecto `stenia`, Postgres `stenia-db` desplegada, aplicación `stenia-web` con sus variables de
entorno, dominio `stenia.halonso.digital` con HTTPS y la tarea diaria `stenia-checkin-reminders`. El DNS del
dominio ya apunta a este servidor.

La imagen de la app la publica GitHub Actions en cada push a `main`: `ghcr.io/betazodev/stenia-web:latest`.

## 1. Dar acceso a la imagen (elige una opción)

**Opción A · paquete público (la más simple).** La imagen no contiene secretos: las variables se inyectan al
arrancar.

1. Abre https://github.com/users/BetazoDev/packages/container/stenia-web/settings
2. En *Danger Zone*, *Change visibility* → *Public*.

**Opción B · paquete privado.**

1. Crea un token clásico con solo `read:packages`: https://github.com/settings/tokens/new?scopes=read:packages
2. Úsalo como contraseña en el paso 2 (usuario `BetazoDev`).

## 2. Apuntar la aplicación a la imagen

Proyecto `stenia` → aplicación `stenia-web` → pestaña **General** → proveedor **Docker**:

| Campo | Valor |
| --- | --- |
| Docker Image | `ghcr.io/betazodev/stenia-web:latest` |
| Registry URL | `ghcr.io` |
| Username | vacío (opción A) o `BetazoDev` (opción B) |
| Password | vacío (opción A) o el token `read:packages` (opción B) |

Guarda.

## 3. Revisar antes de desplegar

- **Environment**: deben estar `DATABASE_URL` (host `stenia-db-qfrn1l`), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `ADMIN_EMAILS`, `ENCRYPTION_KEY` y `CRON_SECRET`. Copia local de los valores en `.env.production.local`.
- **Advanced → Resources**: límite de memoria `1073741824` y reserva `268435456`. En `stenia-db`, límite
  `536870912` y reserva `268435456`. Si ves un valor raro (se guardaron por API con un espacio inicial), reescríbelo.
- **Domains**: `stenia.halonso.digital`, puerto `3000`, HTTPS con Let's Encrypt.

## 4. Desplegar y verificar

1. Botón **Deploy** de la aplicación.
2. En **Logs** debe aparecer `Migraciones aplicadas desde /app/drizzle` y luego el arranque de Next.
3. Abre https://stenia.halonso.digital/api/health → `{"ok":true,"db":"ok",…}`.
4. Regístrate en https://stenia.halonso.digital/registro con `manuel.gonzalez@hemeron.com`: esa cuenta recibe rol
   admin y puede abrir `/settings/developer` para cargar la API key del LLM.

## 5. Redespliegue automático en cada push

1. Aplicación `stenia-web` → pestaña **Deployments** → copia la **Webhook URL**.
2. Guárdala como secreto del repo (el comando la pide sin mostrarla):

```bash
gh secret set DOKPLOY_DEPLOY_WEBHOOK --repo BetazoDev/stenia
```

Desde ese momento, cada push a `main` que pase CI construye la imagen y redespliega.

## 6. Respaldos diarios a R2

Los buckets `stenia-backups`, `stenia-private` y `stenia-public` ya existen en la cuenta de Cloudflare de Hemeron.
Si prefieres otra cuenta, crea ahí los mismos tres nombres.

1. Cloudflare → **R2** → **Manage API tokens** → *Create API token* con permiso *Object Read & Write* limitado a
   los tres buckets. Guarda **Access Key ID**, **Secret Access Key** y el endpoint
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
2. Dokploy → **Settings → S3 Destinations** → *Add*:

   | Campo | Valor |
   | --- | --- |
   | Name | `r2-stenia-backups` |
   | Provider | Cloudflare |
   | Access Key / Secret | los del paso anterior |
   | Bucket | `stenia-backups` |
   | Region | `auto` |
   | Endpoint | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |

   Pulsa *Test* y luego *Create*.
3. Proyecto `stenia` → `stenia-db` → pestaña **Backups** → *Create backup*:

   | Campo | Valor |
   | --- | --- |
   | Destination | `r2-stenia-backups` |
   | Database | `stenia` |
   | Schedule | `0 9 * * *` (03:00 en CDMX si el servidor usa UTC) |
   | Prefix | `stenia/postgres` |
   | Keep latest | `14` |

4. Ejecuta un respaldo manual y confirma que aparece el archivo en el bucket.
5. Opcional por ahora: añade `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_PUBLIC_BASE_URL` a las
   variables de la app. En la Fase 0 solo los usan los importadores locales.

## 7. Opcional · Google OAuth

1. Google Cloud Console → *Credentials* → *OAuth client ID* tipo *Web application*.
2. Origen autorizado `https://stenia.halonso.digital`; redirect `https://stenia.halonso.digital/api/auth/callback/google`.
3. Pon `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en las variables de la app y vuelve a desplegar.

## 8. Comprobación final (paso 9 del runbook)

- La app responde por HTTPS y el registro funciona.
- Hay al menos un respaldo en `stenia-backups`.
- El servidor conserva al menos 1 GB de RAM libre y ningún otro proyecto cambió de estado.
