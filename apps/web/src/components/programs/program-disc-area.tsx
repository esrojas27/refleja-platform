"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, CircleDashed, Sparkles, UserRound } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { DiscProfileInput, DiscRequestError, ProgramDiscParticipant, discErrorMessage,
  listProgramDiscProfiles, saveProgramDiscProfile } from "@/lib/participation/disc-api";

export function ProgramDiscArea({ organizationId, programId }: { organizationId: string; programId: string }) {
  const [items, setItems] = useState<ProgramDiscParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Consultando fichas DISC…");
  const [authorized, setAuthorized] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const identity = await fetchCurrentIdentity(organizationId, controller.signal);
        if (!identity.roles.some(role => role === "CONSULTANT" || role === "LEADER")) {
          setMessage("Sólo consultores y líderes autorizados del programa pueden ver las fichas DISC.");
          return;
        }
        setAuthorized(true);
        const response = await listProgramDiscProfiles(organizationId, programId, controller.signal);
        setItems(response.items);
        setMessage(response.items.length === 0 ? "No hay colaboradores activos disponibles en este programa." : "");
      } catch (error) {
        if (!controller.signal.aborted) {
          const normalized = error instanceof IdentityRequestError
            ? new DiscRequestError(error.status) : error;
          setMessage(discErrorMessage(normalized));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [organizationId, programId]);

  const pending = items.filter(item => !item.profile);
  const completed = items.length - pending.length;
  const selected = items.find(item => item.enrollmentId === selectedId)
    ?? pending[0] ?? items[0] ?? null;

  function openQueue(item?: ProgramDiscParticipant) {
    setSelectedId(item?.enrollmentId ?? pending[0]?.enrollmentId ?? items[0]?.enrollmentId ?? null);
    setQueueOpen(true);
  }

  function saved(value: ProgramDiscParticipant) {
    const updated = items.map(item => item.enrollmentId === value.enrollmentId ? value : item);
    setItems(updated);
    const next = updated.find(item => !item.profile && item.enrollmentId !== value.enrollmentId);
    if (next) setSelectedId(next.enrollmentId);
    else setQueueOpen(false);
  }

  return <main className="rti-surface p-6 sm:p-9">
    <p className="rti-kicker">Conocimiento del equipo</p>
    <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Ficha DISC</h1>
    <p className="mt-3 max-w-3xl text-muted-foreground">
      Registra una lectura independiente de los rasgos Dominante, Influyente, Sereno y Concienzudo de cada colaborador.
    </p>

    {loading ? <p role="status" className="mt-6 rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>
      : !authorized || items.length === 0 ? <EmptyState message={message} />
      : <>
        <section aria-label="Estado de fichas DISC" className="mt-7 grid gap-3 sm:grid-cols-3">
          <Metric label="Colaboradores" value={items.length} />
          <Metric label="Fichas completas" value={completed} accent />
          <Metric label="Pendientes" value={pending.length} />
        </section>

        <section aria-labelledby="disc-queue-title" className="mt-7 rounded-3xl border border-primary/15 bg-accent/25 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="rti-kicker">Recorrido individual</p>
              <h2 id="disc-queue-title" className="mt-2 text-xl font-semibold">Completar fichas DISC</h2></div>
            {!queueOpen && <button type="button" className="rti-button-primary" onClick={() => openQueue()}>
              {pending.length > 0 ? `Completar pendientes (${pending.length})` : "Revisar fichas"}
            </button>}
          </div>
          {!queueOpen ? <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
            {pending.length === 0 ? <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-primary" />
              : <CircleDashed aria-hidden="true" className="size-5 shrink-0 text-primary" />}
            <p>{pending.length === 0 ? "Todas las fichas DISC están completas."
              : `Hay ${pending.length} ${pending.length === 1 ? "ficha pendiente" : "fichas pendientes"}.`}</p>
          </div> : selected && <DiscForm key={`${selected.enrollmentId}-${selected.profile?.version ?? "new"}`}
            organizationId={organizationId} programId={programId} participant={selected}
            onSaved={saved} onClose={() => setQueueOpen(false)} />}
        </section>

        <section aria-labelledby="disc-team-title" className="mt-7">
          <h2 id="disc-team-title" className="text-xl font-semibold">Integrantes del programa</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {items.map(item => <article key={item.enrollmentId} className="rounded-2xl border border-border/70 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3"><span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <UserRound aria-hidden="true" className="size-5" /></span><div className="min-w-0">
                    <p className="font-semibold">{participantName(item)}</p><p className="truncate text-sm text-muted-foreground">{item.email}</p>
                  </div></div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.profile ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  {item.profile ? "Completa" : "Pendiente"}</span>
              </div>
              <button type="button" onClick={() => openQueue(item)} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                {item.profile ? "Editar ficha" : "Completar ficha"}<ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </article>)}
          </div>
        </section>
      </>}
  </main>;
}

function DiscForm({ organizationId, programId, participant, onSaved, onClose }: {
  organizationId: string; programId: string; participant: ProgramDiscParticipant;
  onSaved: (value: ProgramDiscParticipant) => void; onClose: () => void;
}) {
  const original = participant.profile;
  const [input, setInput] = useState<DiscProfileInput>({
    dominant: original?.dominant ?? "", influential: original?.influential ?? "",
    serene: original?.serene ?? "", conscientious: original?.conscientious ?? "",
    version: original?.version ?? null,
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const clean = { ...input, dominant: input.dominant.trim(), influential: input.influential.trim(),
      serene: input.serene.trim(), conscientious: input.conscientious.trim() };
    if ([clean.dominant, clean.influential, clean.serene, clean.conscientious].some(value => !value)) {
      setMessage("Completa los cuatro campos de la ficha DISC."); return;
    }
    submitting.current = true; setPending(true); setMessage("Guardando ficha DISC…");
    try {
      const saved = await saveProgramDiscProfile(organizationId, programId, participant.enrollmentId, clean);
      setMessage("Ficha DISC guardada."); onSaved(saved);
    } catch (error) { setMessage(discErrorMessage(error)); }
    finally { submitting.current = false; setPending(false); }
  }

  return <form aria-label={`Ficha DISC de ${participantName(participant)}`} onSubmit={submit}
    className="mt-5 animate-in slide-in-from-bottom-6 fade-in rounded-2xl border border-border/70 bg-card p-5 shadow-sm motion-reduce:animate-none sm:p-6">
    <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="rti-kicker">Integrante actual</p><h3 className="mt-1 text-lg font-semibold">{participantName(participant)}</h3>
        <p className="text-sm text-muted-foreground">{participant.email}</p></div>
      <button type="button" onClick={onClose} className="rti-button-secondary">Cerrar recorrido</button>
    </div>
    <div className="mt-5 grid gap-5 md:grid-cols-2">
      <DiscField code="D" label="Dominante" value={input.dominant} disabled={pending}
        onChange={value => setInput({ ...input, dominant: value })} />
      <DiscField code="I" label="Influyente" value={input.influential} disabled={pending}
        onChange={value => setInput({ ...input, influential: value })} />
      <DiscField code="S" label="Sereno" value={input.serene} disabled={pending}
        onChange={value => setInput({ ...input, serene: value })} />
      <DiscField code="C" label="Concienzudo" value={input.conscientious} disabled={pending}
        onChange={value => setInput({ ...input, conscientious: value })} />
    </div>
    {message && <p role="status" className="mt-5 rounded-xl bg-muted/60 px-3 py-2 text-sm">{message}</p>}
    <button className="rti-button-primary mt-5" disabled={pending}>{pending ? "Guardando…" : "Guardar y continuar"}</button>
  </form>;
}

function DiscField({ code, label, value, disabled, onChange }: { code: string; label: string; value: string;
  disabled: boolean; onChange: (value: string) => void }) {
  const id = `disc-${code.toLowerCase()}`;
  return <div><label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold">
    <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{code}</span>{label}</label>
    <textarea id={id} className="rti-field mt-2 min-h-32 resize-y" required maxLength={5000}
      value={value} onChange={event => onChange(event.target.value)} disabled={disabled} /></div>;
}

function Metric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${accent ? "border-primary/25 bg-accent/40" : "border-border/70 bg-card"}`}>
    <p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="mt-7 rounded-3xl border border-border/70 bg-muted/35 p-6 text-sm">
    <Sparkles aria-hidden="true" className="size-6 text-primary" /><p role="status" className="mt-3 text-muted-foreground">{message}</p>
    <Link href="/account" className="mt-4 inline-block font-semibold text-primary hover:underline">Volver a Cuenta</Link>
  </div>;
}

function participantName(item: ProgramDiscParticipant) {
  return [item.firstName, item.lastName].filter(Boolean).join(" ") || item.email;
}
