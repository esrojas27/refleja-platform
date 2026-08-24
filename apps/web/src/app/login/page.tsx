import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-5 py-12 sm:px-8">
      <section className="w-full rounded-xl border bg-background p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-muted-foreground">
          Ruta pública de prueba
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Iniciar sesión
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-muted-foreground">
          La autenticación se incorporará en un ticket posterior. Esta página no
          recibe ni envía credenciales.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium underline underline-offset-4"
        >
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
