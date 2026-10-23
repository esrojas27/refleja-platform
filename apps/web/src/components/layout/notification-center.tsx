"use client";

import { Bell, Check, CheckCheck, RefreshCw, X } from "lucide-react";
import { Hub } from "aws-amplify/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listNotifications, readNotification, notificationDestination, notificationLabels,
  NotificationRequestError, type AppNotification, type NotificationPage } from "@/lib/notifications-api";

export function NotificationCenter() {
  const [page, setPage] = useState<NotificationPage>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const alive = useRef(false);
  const sessionEnded = useRef(false);
  const writing = useRef(false);

  const load = useCallback(async (last?: AppNotification) => {
    if (sessionEnded.current || writing.current) return;
    controller.current?.abort();
    const active = new AbortController(); controller.current = active;
    setBusy(true); setError("");
    try {
      const result = await listNotifications(active.signal, last);
      if (!active.signal.aborted && alive.current) {
        setDisabled(false);
        setPage(previous => last && previous ? { ...result, items: [...previous.items, ...result.items.filter(n => !previous.items.some(p => p.id === n.id))] } : result);
      }
    } catch (failure) {
      if (!active.signal.aborted && alive.current) {
        // Do not leave potentially revoked organization content visible after a failed refresh.
        setPage(undefined);
        if (failure instanceof NotificationRequestError && [401, 403].includes(failure.status)) {
          setDisabled(true); setOpen(false);
        } else setError("No pudimos cargar tus notificaciones. Inténtalo de nuevo.");
      }
    } finally { if (!active.signal.aborted && alive.current) setBusy(false); }
  }, []);

  useEffect(() => {
    alive.current = true;
    sessionEnded.current = false;
    const refresh = () => { if (document.visibilityState !== "hidden") void load(); };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("rti:notifications-changed", refresh);
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signedOut") {
        sessionEnded.current = true;
        controller.current?.abort(); setPage(undefined); setOpen(false); setDisabled(true);
      }
    });
    return () => {
      alive.current = false; controller.current?.abort(); window.clearInterval(timer); unsubscribe();
      window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("rti:notifications-changed", refresh);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = trigger.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = previous; previousFocus?.focus(); };
  }, [open]);

  async function mark(item: AppNotification, navigate: boolean) {
    if (sessionEnded.current || writing.current) return;
    writing.current = true;
    // Revalidate authorization even for an already-read item before following its link.
    controller.current?.abort();
    const active = new AbortController(); controller.current = active;
    setBusy(true); setError("");
    try {
      await readNotification(item.id, active.signal);
      if (active.signal.aborted || !alive.current) return;
      setPage(current => current && ({ ...current,
        unreadCount: Math.max(0, current.unreadCount - (item.readAt ? 0 : 1)),
        items: current.items.map(n => n.id === item.id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n),
      }));
      if (navigate) window.location.assign(notificationDestination(item));
    } catch {
      if (active.signal.aborted || !alive.current) return;
      setPage(undefined);
      setError("El aviso no está disponible o no se pudo actualizar. Actualiza la bandeja para comprobar tu acceso.");
    } finally {
      writing.current = false;
      if (!active.signal.aborted && alive.current) setBusy(false);
    }
  }

  if (disabled) return null;
  const unread = page?.unreadCount ?? 0;
  return <>
    <button ref={trigger} type="button" aria-label={unread ? `Notificaciones: ${unread} sin leer` : "Notificaciones"}
      aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { setOpen(true); void load(); }}
      className="relative inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:flex-row sm:gap-2 sm:px-3 sm:text-sm">
      <Bell aria-hidden="true" className="size-4" /><span className="sm:sr-only lg:not-sr-only">Avisos</span>
      {unread > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1 text-center text-[10px] leading-5 text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && createPortal(<dialog ref={dialog} aria-labelledby="notifications-title"
      onCancel={event => { event.preventDefault(); setOpen(false); }} onClose={() => setOpen(false)}
      onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}
      className="m-auto w-[calc(100%_-_1.5rem)] max-w-xl overflow-hidden rounded-3xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/35 backdrop:backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div><p className="rti-kicker">Tu espacio</p><h2 id="notifications-title" className="mt-1 text-2xl font-semibold">Notificaciones</h2></div>
        <button type="button" aria-label="Cerrar notificaciones" onClick={() => setOpen(false)}
          className="inline-flex size-11 items-center justify-center rounded-full border border-border hover:bg-muted"><X className="size-5" aria-hidden="true" /></button>
      </div>
      <div className="rti-modal-scroll max-h-[70dvh] overflow-y-auto px-5 py-4 sm:px-6">
        <p className="text-sm text-muted-foreground">Novedades de tus programas. Estos avisos solo aparecen aquí; no enviamos correos por estas actividades.</p>
        <div className="my-4 flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{page ? `${unread} sin leer` : "Tu bandeja"}</p>
          <button className="rti-button-secondary gap-2" type="button" disabled={busy} onClick={() => void load()}><RefreshCw className="size-4" aria-hidden="true" />Actualizar</button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-xl border border-border bg-muted p-3 text-sm">{error}</p>}
        {busy && <p role="status" className="mb-3 text-sm text-muted-foreground">Actualizando notificaciones…</p>}
        {page?.items.length === 0 && <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <CheckCheck aria-hidden="true" className="mx-auto mb-3 size-8 text-muted-foreground" /><h3 className="font-semibold">No tienes notificaciones</h3>
          <p className="mt-2 text-sm text-muted-foreground">Aquí aparecerán las novedades de tus programas activos.</p></div>}
        <ul className="space-y-3">{page?.items.map(item => <li key={item.id}
          className={`rounded-2xl border p-4 ${item.readAt ? "border-border bg-background" : "border-primary/25 bg-accent/35"}`}>
          <div className="flex items-start justify-between gap-2"><p className="font-semibold">{notificationLabels[item.kind]}</p>
            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs">{item.readAt ? "Leída" : "Nueva"}</span></div>
          <p className="mt-2 break-words text-sm font-medium">{item.activityTitle}</p>
          {item.kind === "SESSION_RESCHEDULED" && <div className="mt-2 text-sm"><p>{item.previousDate} → {item.scheduledDate}</p><p className="mt-1 whitespace-pre-wrap break-words">{item.reason}</p></div>}
          {item.kind === "SUBMISSION_RECEIVED" && item.participantName && <p className="mt-1 break-words text-sm">De: {item.participantName}</p>}
          <p className="mt-1 break-words text-xs text-muted-foreground">{item.organizationName} · {item.programName}</p>
          <time dateTime={item.createdAt} className="mt-2 block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</time>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy} className="rti-button-primary" onClick={() => void mark(item, true)}>{item.kind === "SESSION_RESCHEDULED" ? "Ver sesión" : "Ver actividad"}</button>
            {!item.readAt && <button type="button" disabled={busy} className="rti-button-secondary gap-2" onClick={() => void mark(item, false)}><Check aria-hidden="true" className="size-4" />Marcar como leída</button>}
          </div>
        </li>)}</ul>
        {page?.hasMore && <button type="button" disabled={busy} className="rti-button-secondary mt-4 w-full" onClick={() => void load(page.items.at(-1))}>Ver anteriores</button>}
      </div>
    </dialog>, document.body)}
  </>;
}
