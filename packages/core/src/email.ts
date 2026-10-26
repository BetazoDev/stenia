/**
 * Revisión de correos al registrarse: detecta dominios mal escritos (gmail.comj, hotmial.com) para que cada cuenta
 * tenga un correo real. La comprobación DNS del dominio vive en el servidor.
 */

/** Dominios de correo comunes en México a los que se compara un dominio escrito. */
const POPULAR_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'yahoo.com',
  'yahoo.com.mx',
  'icloud.com',
  'me.com',
  'hotmail.es',
  'outlook.es',
  'live.com.mx',
  'prodigy.net.mx',
  'protonmail.com',
  'proton.me',
];

/** Dominios reales parecidos a los populares que no deben marcarse como errores. */
const KNOWN_DOMAINS = new Set([
  ...POPULAR_DOMAINS,
  'mail.com',
  'gmx.com',
  'gmx.net',
  'ymail.com',
  'msn.com',
  'aol.com',
  'zoho.com',
  'hey.com',
  'fastmail.com',
  'yandex.com',
  'tutanota.com',
  'mac.com',
  'googlemail.com',
  'outlook.com.mx',
  'hotmail.com.mx',
  'yahoo.es',
]);

const EMAIL_SHAPE = /^[^\s@]+@([a-z0-9-]+\.)+[a-z]{2,}$/;

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = current;
    }
  }
  return row[b.length]!;
}

export type EmailCheck = { ok: true; email: string } | { ok: false; message: string; suggestion: string | null };

/** Normaliza y revisa un correo. Si el dominio parece un error de dedo de uno popular, sugiere el correcto. */
export function checkEmailAddress(raw: string): EmailCheck {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_SHAPE.test(email)) return { ok: false, message: 'Escribe un correo válido, por ejemplo nombre@gmail.com.', suggestion: null };
  const [local, domain] = [email.slice(0, email.lastIndexOf('@')), email.slice(email.lastIndexOf('@') + 1)];
  if (KNOWN_DOMAINS.has(domain)) return { ok: true, email };
  const close = POPULAR_DOMAINS.map((d) => ({ d, dist: distance(domain, d) }))
    .filter((c) => c.dist > 0 && c.dist <= 2)
    .sort((a, b) => a.dist - b.dist)[0];
  if (close) {
    const suggestion = `${local}@${close.d}`;
    return { ok: false, message: `Parece que el correo tiene un error: ¿quisiste decir ${suggestion}?`, suggestion };
  }
  return { ok: true, email };
}
