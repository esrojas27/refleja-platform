import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center gap-8 px-5 py-12 sm:px-8 lg:px-12">
      <section className="max-w-2xl space-y-3">
        <p className="text-sm font-medium text-muted-foreground">
          Bootstrap web
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Refleja Tu Interior
        </h1>
        <p className="text-base leading-7 text-muted-foreground sm:text-lg">
          Base técnica mínima para construir la experiencia web en los próximos
          tickets.
        </p>
      </section>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Frontend preparado</CardTitle>
          <CardDescription>
            Next.js App Router, TypeScript, Tailwind CSS y shadcn/ui están
            configurados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Este bootstrap no contiene dashboard, datos ni lógica de negocio.
          </p>
        </CardContent>
      </Card>

      <Link
        href="/login"
        className="w-fit text-sm font-medium underline underline-offset-4"
      >
        Abrir ruta de acceso
      </Link>
    </main>
  );
}
