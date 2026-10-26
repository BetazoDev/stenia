import 'server-only';

import { Resolver } from 'node:dns/promises';

const NOT_FOUND = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN']);

/**
 * ¿El dominio del correo puede recibir correo? Busca registros MX (o A/AAAA, el MX implícito). Si el DNS falla por
 * otra causa (tiempo de espera, servidor caído) se deja pasar: no se bloquean registros por una falla de red.
 */
export async function domainReceivesMail(email: string): Promise<boolean> {
  const domain = email.slice(email.lastIndexOf('@') + 1);
  // Dominios reservados para pruebas (RFC 2606/6761): válidos en local y en las e2e, nunca en el servidor desplegado.
  if (process.env.STENIA_DEPLOYMENT !== 'server' && /(^|\.)(example\.(com|net|org)|test|localhost|invalid)$/.test(domain)) return true;
  const resolver = new Resolver({ timeout: 3000, tries: 1 });
  const lookups: (() => Promise<unknown[]>)[] = [() => resolver.resolveMx(domain), () => resolver.resolve4(domain), () => resolver.resolve6(domain)];
  for (const lookup of lookups) {
    try {
      if ((await lookup()).length > 0) return true;
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      if (!NOT_FOUND.has(code)) return true;
    }
  }
  return false;
}
