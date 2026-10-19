import type { Metadata } from 'next';
import Link from 'next/link';
import { ViewTransition } from 'react';

import { ExerciseMedia } from '@/components/exercise-media';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Select } from '@/components/ui/input';
import { searchCatalog } from '@/lib/exercises';
import { LOAD_TYPE_LABELS_ES, PATTERN_LABELS_ES, musclesText } from '@/lib/labels';
import { requireSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Ejercicios' };

type Props = { searchParams: Promise<{ q?: string; patron?: string; carga?: string; todos?: string; p?: string }> };

export default async function ExercisesPage({ searchParams }: Props) {
  const { user } = await requireSession();
  const sp = await searchParams;
  const available = sp.todos !== '1';
  const result = await searchCatalog(user.id, { q: sp.q, pattern: sp.patron, loadType: sp.carga, available, page: Number(sp.p ?? '1') || 1 });
  const qs = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: sp.q, patron: sp.patron, carga: sp.carga, todos: sp.todos, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/ejercicios?${s}` : '/ejercicios';
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="label">Catálogo</span>
        <h1 className="text-4xl">Ejercicios</h1>
      </header>

      <form className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]" action="/ejercicios" role="search">
        <Input name="q" defaultValue={sp.q ?? ''} placeholder="Buscar: sentadilla, dominadas, press…" aria-label="Buscar ejercicio" />
        <Select name="patron" defaultValue={sp.patron ?? ''} aria-label="Patrón de movimiento">
          <option value="">Todos los patrones</option>
          {Object.entries(PATTERN_LABELS_ES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select name="carga" defaultValue={sp.carga ?? ''} aria-label="Tipo de carga">
          <option value="">Cualquier carga</option>
          {Object.entries(LOAD_TYPE_LABELS_ES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        {!available ? <input type="hidden" name="todos" value="1" /> : null}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <Button type="submit" size="sm">
            Buscar
          </Button>
          <Link href={qs({ todos: available ? '1' : undefined, p: undefined }) as never} className="text-sm text-text-2 underline underline-offset-4">
            {available ? 'Ver también los que no puedo hacer con mi equipo' : 'Solo con mi equipo'}
          </Link>
          <span className="label ml-auto tnum">{result.total} resultados</span>
        </div>
      </form>

      {result.items.length === 0 ? (
        <EmptyState title="Sin resultados" description="Prueba con otra palabra o quita filtros. Si el catálogo está vacío, un administrador debe importarlo." />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
          {result.items.map((e) => (
            <li key={e.id}>
              <Link href={`/ejercicios/${e.slug}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-card-hover">
                <ViewTransition name={`exercise-${e.id}`}>
                  <ExerciseMedia start={e.media?.start ?? null} end={e.media?.end ?? null} main={e.media?.main ?? null} alt={e.nameEs} />
                </ViewTransition>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{e.nameEs}</p>
                  <p className="truncate text-sm text-text-3">
                    {PATTERN_LABELS_ES[e.pattern] ?? e.pattern} · {musclesText(e.primaryMuscles)}
                  </p>
                </div>
                <span className="hidden text-sm text-text-3 sm:block">{LOAD_TYPE_LABELS_ES[e.loadType]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.pages > 1 ? (
        <nav className="flex items-center justify-between" aria-label="Paginación">
          {result.page > 1 ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={qs({ p: String(result.page - 1) }) as never}>Anterior</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="label tnum">
            Página {result.page} de {result.pages}
          </span>
          {result.page < result.pages ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={qs({ p: String(result.page + 1) }) as never}>Siguiente</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
