import { ArrowRight, Building2, ClipboardCheck, UsersRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Brand } from "@/components/layout/brand";

const journey = [
  {
    title: "Organiza",
    description: "Crea el espacio de una organización y reúne sus programas en un mismo lugar.",
    icon: Building2,
  },
  {
    title: "Acompaña",
    description: "Invita a las personas que harán parte de cada proceso de desarrollo.",
    icon: UsersRound,
  },
  {
    title: "Construye",
    description: "Prepara un recorrido claro para convertir el aprendizaje en acciones observables.",
    icon: ClipboardCheck,
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Brand />
        <Link href="/login" className="rti-button-secondary">
          Iniciar sesión
        </Link>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-16 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-12 lg:pb-24 lg:pt-24">
          <div className="max-w-3xl">
            <p className="rti-kicker">Desarrollo humano con propósito</p>
            <h1 className="mt-5 max-w-2xl font-heading text-4xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
              Refleja Tu Interior
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              Un lugar para diseñar programas de desarrollo, acompañar a cada persona y hacer visible su camino de transformación.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="rti-button-primary gap-2">
                Entrar a la plataforma
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <a href="#recorrido" className="rti-button-secondary">
                Conocer el recorrido
              </a>
            </div>
          </div>

          <div className="rti-surface relative overflow-hidden p-6 sm:p-8">
            <div aria-hidden="true" className="absolute -right-16 -top-16 size-48 rounded-full bg-accent/70 blur-3xl" />
            <div className="relative">
              <div className="mb-7 overflow-hidden rounded-2xl border border-border/70 bg-white p-3 shadow-sm">
                <Image
                  src="/brand/RP_LOGO_PNG.png"
                  alt=""
                  width={2550}
                  height={811}
                  sizes="(min-width: 1024px) 36rem, 90vw"
                  className="h-auto w-full"
                />
              </div>
              <p className="rti-kicker">Una experiencia compartida</p>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                Del programa a la experiencia de cada persona.
              </h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                Consultores y colaboradores encuentran un punto común para organizar el proceso y avanzar con claridad.
              </p>
              <div className="mt-8 grid grid-cols-[auto_1fr] gap-x-4 gap-y-6">
                {["Define el programa", "Conecta a los participantes", "Acompaña el recorrido"].map((step, index) => (
                  <div key={step} className="contents">
                    <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <p className="self-center font-medium">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="recorrido" aria-labelledby="journey-title" className="border-y border-border/70 bg-card/55">
          <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
            <p className="rti-kicker">La base del producto</p>
            <h2 id="journey-title" className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Un recorrido simple para empezar a aprender con usuarios reales.
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {journey.map(({ title, description, icon: Icon }) => (
                <article key={title} className="rounded-2xl border border-border/80 bg-background/75 p-6">
                  <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-8 lg:px-12">
        <p>Refleja Tu Interior</p>
        <p>Producto en evolución, construido a partir de experiencias reales.</p>
      </footer>
    </div>
  );
}
