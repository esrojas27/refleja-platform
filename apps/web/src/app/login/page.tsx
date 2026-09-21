import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { LoginButton } from "@/components/auth/login-button";
import { Brand } from "@/components/layout/brand";

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-7xl items-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-12">
      <section className="order-2 max-w-xl lg:order-1">
        <Brand />
        <p className="rti-kicker mt-10">Tu espacio de desarrollo</p>
        <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Todo comienza con una mirada honesta hacia adentro.
        </h2>
        <p className="mt-5 leading-7 text-muted-foreground">
          Accede a los programas de tu organización y continúa el recorrido que estás construyendo.
        </p>
      </section>

      <section className="rti-surface order-1 w-full p-6 sm:p-9 lg:order-2 lg:p-12">
        <p className="rti-kicker">Acceso seguro</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Iniciar sesión</h1>
        <p className="mt-4 max-w-xl leading-7 text-muted-foreground">
          Continuarás en Cognito, el servicio seguro que administra tus credenciales. Refleja Tu Interior no recibe ni almacena tu contraseña.
        </p>
        <p className="mt-4 rounded-2xl border border-border/70 bg-muted/60 px-4 py-3 text-sm leading-6 text-muted-foreground">
          Si recibiste una invitación y es tu primer ingreso, utiliza las credenciales enviadas por Cognito. El servicio te pedirá establecer tu contraseña antes de regresar a tus invitaciones.
        </p>

        <LoginButton />

        <div className="mt-7 grid gap-3 border-t border-border/70 pt-6 text-sm text-muted-foreground sm:grid-cols-2">
          <p className="flex items-start gap-2">
            <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            Acceso mediante código seguro y PKCE.
          </p>
          <p className="flex items-start gap-2">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            Tus permisos se validan en cada organización.
          </p>
        </div>

        <Link href="/" className="rti-link mt-7 inline-flex items-center gap-2 text-sm">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
