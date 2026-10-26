import { describe, expect, it } from 'vitest';

import { checkEmailAddress } from './email';

describe('checkEmailAddress', () => {
  it('acepta correos de dominios conocidos y normaliza mayúsculas y espacios', () => {
    expect(checkEmailAddress(' Ana@Gmail.com ')).toEqual({ ok: true, email: 'ana@gmail.com' });
    expect(checkEmailAddress('pepe@mail.com').ok).toBe(true);
    expect(checkEmailAddress('equipo@hemeron.com').ok).toBe(true);
  });

  it('detecta errores de dedo en dominios populares y sugiere el correcto', () => {
    expect(checkEmailAddress('amigo@gmail.comj')).toMatchObject({ ok: false, suggestion: 'amigo@gmail.com' });
    expect(checkEmailAddress('amigo@gmial.com')).toMatchObject({ ok: false, suggestion: 'amigo@gmail.com' });
    expect(checkEmailAddress('amigo@hotmial.com')).toMatchObject({ ok: false, suggestion: 'amigo@hotmail.com' });
    expect(checkEmailAddress('amigo@gmail.con')).toMatchObject({ ok: false, suggestion: 'amigo@gmail.com' });
  });

  it('rechaza formas inválidas', () => {
    expect(checkEmailAddress('amigo@gmail')).toMatchObject({ ok: false, suggestion: null });
    expect(checkEmailAddress('sin-arroba.com').ok).toBe(false);
  });
});
