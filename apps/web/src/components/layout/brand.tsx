import { Sparkles } from "lucide-react";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group inline-flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      aria-label="Refleja Tu Interior — inicio"
    >
      <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-rotate-3">
        <span className="absolute inset-1 rounded-xl border border-primary-foreground/25" />
        <Sparkles aria-hidden="true" className="relative size-5" strokeWidth={1.8} />
      </span>
      <span className={compact ? "sr-only sm:not-sr-only sm:block" : "block"}>
        <span className="block truncate font-heading text-base font-semibold leading-tight tracking-tight">
          Refleja Tu Interior
        </span>
        <span className="block text-xs text-muted-foreground">Desarrollo con propósito</span>
      </span>
    </Link>
  );
}
