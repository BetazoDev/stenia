import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Aviso de privacidad' };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-3">
        <Link href="/login" className="label">
          ← Stenia
        </Link>
        <h1 className="text-4xl md:text-5xl">Aviso de privacidad</h1>
        <p className="text-text-2">
          Stenia trata datos de salud, que la ley mexicana considera sensibles. Por eso te pedimos consentimiento
          expreso al registrarte y, por separado, para las fotos corporales.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">Qué datos usamos</h2>
        <ul className="list-disc space-y-2 pl-5 text-text-2">
          <li>Datos de cuenta: nombre, correo y, si entras con Google, tu identificador de Google.</li>
          <li>Cuestionario inicial: fecha de nacimiento, sexo, estatura, peso, objetivo, lesiones, sueño y estrés.</li>
          <li>Entrenamiento: series, pesos, repeticiones, tiempos y notas de cada sesión.</li>
          <li>Seguimiento corporal: peso, circunferencias y, solo si lo activas, fotos.</li>
          <li>Nutrición: metas, plan de comidas y registro de alimentos.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">Para qué</h2>
        <p className="text-text-2">
          Para generar y ajustar tu rutina, mostrar tu progreso y calcular tus metas nutricionales. Parte de estos
          datos se envía a un proveedor de inteligencia artificial elegido por el administrador, sin tu nombre ni
          tu correo y solo con los campos que cada tarea necesita. Las fotos nunca se envían sin tu acción explícita.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">Tus derechos</h2>
        <ul className="list-disc space-y-2 pl-5 text-text-2">
          <li>Exportar todos tus datos en JSON y CSV desde Configuración.</li>
          <li>Borrar tu cuenta con todo su contenido desde Configuración.</li>
          <li>Borrar cada foto individualmente o todas a la vez.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">Seguridad</h2>
        <p className="text-text-2">
          Todo el tráfico va cifrado (TLS), la base de datos se respalda a diario y las claves de acceso se guardan
          cifradas en el servidor. Las consultas se hacen siempre desde el servidor verificando que los datos sean
          tuyos.
        </p>
      </section>

      <section className="rounded-card border border-border bg-card p-5 text-sm text-text-2">
        Stenia no es un dispositivo médico ni sustituye a un profesional de la salud. La aplicación describe
        tendencias y opciones; no emite diagnósticos. Si tienes una condición médica, consulta a un profesional
        antes de entrenar o cambiar tu alimentación.
      </section>
    </main>
  );
}
