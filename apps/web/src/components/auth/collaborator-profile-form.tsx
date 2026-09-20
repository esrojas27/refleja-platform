"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { completeCollaboratorProfile, getCollaboratorProfile, profileErrorMessage,
  type CollaboratorProfile, type CollaboratorProfileInput, type ProfileRequestError }
  from "@/lib/auth/profile-api";

const empty: CollaboratorProfileInput = {
  fullName: "", dateOfBirth: "", phone: "", city: "", country: "", jobTitle: "",
};

export function CollaboratorProfileForm({ organizationId }: { organizationId: string }) {
  const [profile, setProfile] = useState<CollaboratorProfile>();
  const [input, setInput] = useState(empty);
  const [pending, setPending] = useState(Boolean(organizationId));
  const [message, setMessage] = useState(organizationId
    ? "Cargando tu perfil…" : "Selecciona primero una organización desde Cuenta.");
  const [invalid, setInvalid] = useState<string[]>([]);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    if (!organizationId) {
      return () => controller.abort();
    }
    getCollaboratorProfile(organizationId, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setProfile(data);
      setInput({ fullName: data.fullName ?? "", dateOfBirth: data.dateOfBirth ?? "", phone: data.phone ?? "",
        city: data.city ?? "", country: data.country ?? "", jobTitle: data.jobTitle ?? "" });
      setMessage("");
    }).catch(error => {
      if (!controller.signal.aborted) setMessage(profileErrorMessage(error));
    }).finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [organizationId]);

  function update(field: keyof CollaboratorProfileInput, value: string) {
    setInput(current => ({ ...current, [field]: value }));
    setInvalid(current => current.filter(item => item !== field));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const clean = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value.trim()])) as CollaboratorProfileInput;
    const missing = Object.entries(clean).filter(([, value]) => !value).map(([field]) => field);
    if (missing.length) { setInvalid(missing); setMessage("Completa todos los campos requeridos."); return; }
    setPending(true); setInvalid([]); setMessage("Guardando perfil…");
    const controller = new AbortController(); request.current = controller;
    try {
      const saved = await completeCollaboratorProfile(organizationId, clean, controller.signal);
      if (controller.signal.aborted) return;
      setProfile(saved); setMessage("Perfil completo. Ya puedes acceder a tus programas.");
    } catch (error) {
      if (controller.signal.aborted) return;
      setInvalid(error && typeof error === "object" && "fields" in error
        ? (error as ProfileRequestError).fields : []);
      setMessage(profileErrorMessage(error));
    } finally { if (!controller.signal.aborted) setPending(false); }
  }

  return <section className="rti-surface mx-auto w-full max-w-4xl p-6 sm:p-8 lg:p-10">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="rti-kicker">Tu información</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Perfil del colaborador</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Completa estos datos para validar tu perfil y acceder a los programas de tu empresa.
        </p>
      </div>
      {profile && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${profile.status === "COMPLETE"
        ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
        {profile.status === "COMPLETE" ? "Perfil completo" : "Perfil pendiente"}
      </span>}
    </div>
    {message && <p role="status" className="mt-5 rounded-2xl border border-border/70 bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {profile && <>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</dt>
          <dd className="mt-2 break-all font-medium">{profile.email}</dd>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empresa</dt>
          <dd className="mt-2 break-words font-medium">{profile.company}</dd>
        </div>
      </dl>
      <form aria-label="Perfil del colaborador" onSubmit={submit} noValidate className="mt-7 grid gap-5 sm:grid-cols-2">
        <ProfileField id="profile-full-name" label="Nombre completo" value={input.fullName}
          invalid={invalid.includes("fullName")} onChange={value => update("fullName", value)} disabled={pending} span />
        <ProfileField id="profile-birth-date" label="Fecha de nacimiento" value={input.dateOfBirth} type="date"
          max={yesterday()} invalid={invalid.includes("dateOfBirth")} onChange={value => update("dateOfBirth", value)} disabled={pending} />
        <ProfileField id="profile-phone" label="Teléfono" value={input.phone} type="tel" maxLength={32}
          invalid={invalid.includes("phone")} onChange={value => update("phone", value)} disabled={pending} />
        <ProfileField id="profile-city" label="Ciudad" value={input.city} maxLength={120}
          invalid={invalid.includes("city")} onChange={value => update("city", value)} disabled={pending} />
        <ProfileField id="profile-country" label="País" value={input.country} maxLength={120}
          invalid={invalid.includes("country")} onChange={value => update("country", value)} disabled={pending} />
        <ProfileField id="profile-job-title" label="Cargo" value={input.jobTitle} maxLength={160}
          invalid={invalid.includes("jobTitle")} onChange={value => update("jobTitle", value)} disabled={pending} span />
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button className="rti-button-primary" disabled={pending}>{pending ? "Guardando…" : profile.status === "COMPLETE" ? "Guardar cambios" : "Completar perfil"}</button>
          {profile.status === "COMPLETE" && <Link href="/my-programs" className="rti-button-secondary">Ir a mis programas</Link>}
          <Link href="/account" className="rti-button-secondary">Volver a Cuenta</Link>
        </div>
      </form>
    </>}
  </section>;
}

function ProfileField({ id, label, value, onChange, invalid, disabled, span = false, type = "text", max, maxLength }: {
  id: string; label: string; value: string; onChange: (value: string) => void; invalid: boolean; disabled: boolean;
  span?: boolean; type?: string; max?: string; maxLength?: number;
}) {
  return <div className={span ? "sm:col-span-2" : undefined}>
    <label htmlFor={id} className="block text-sm font-medium">{label}</label>
    <input id={id} className="rti-field" type={type} required value={value} max={max} maxLength={maxLength}
      aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}
      onChange={event => onChange(event.target.value)} disabled={disabled} />
    {invalid && <p id={`${id}-error`} className="mt-1 text-xs text-destructive">Revisa este campo.</p>}
  </div>;
}

function yesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}
