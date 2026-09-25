import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group inline-flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      aria-label="Refleja Tu Interior — inicio"
    >
      <span className="relative size-11 shrink-0 overflow-hidden rounded-full border border-[var(--brand-pink)] bg-white shadow-sm transition-transform group-hover:-rotate-3">
        <Image src="/brand/RP_CIRCULAR.jpeg" alt="" fill sizes="44px" className="object-cover" />
      </span>
      <span className={compact ? "sr-only sm:not-sr-only sm:block" : "block"}>
        <span className="block truncate font-heading text-xl font-semibold leading-none tracking-tight">
          Refleja Tu Interior
        </span>
        <span className="block text-xs text-muted-foreground">Desarrollo con propósito</span>
      </span>
    </Link>
  );
}
