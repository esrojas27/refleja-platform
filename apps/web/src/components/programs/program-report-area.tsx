"use client";

import Link from "next/link";
import { Download, FileChartColumn, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { getProgramReport, exportProgramReport, ProgramReportError, reportErrorMessage,
  type ProgramReport, type ReportFormat, type ReportParticipant, type ReportSummary } from "@/lib/participation/program-report-api";
import { enrollmentStatusLabels } from "@/lib/participation/enrollment-administration-api";
import { activityStatusLabel } from "@/lib/participation/progress";
import { SurveyReportDetails } from "./program-survey-results-area";

const percentage = (value: number | null) => value === null ? "No aplica" : `${value.toLocaleString("es-CO", { maximumFractionDigits: 2 })}%`;
const programStates = { DRAFT: "Borrador", SCHEDULED: "Programado", ACTIVE: "Activo", COMPLETED: "Finalizado", CANCELLED: "Cancelado" };

export function ProgramReportArea(props: { organizationId: string; programId: string }) {
  return <ReportContent key={`${props.organizationId}/${props.programId}`} {...props} />;
}
function ReportContent({ organizationId, programId }: { organizationId: string; programId: string }) {
  const [report, setReport] = useState<ProgramReport>();
  const [people, setPeople] = useState<ReportParticipant[]>([]);
  const [selected, setSelected] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("Comprobando acceso y preparando reportes…");
  const [exportMessage, setExportMessage] = useState("");
  const exportRequest = useRef<AbortController | null>(null);
  const downloading = useRef(false);
  useEffect(() => () => exportRequest.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const identity = await fetchCurrentIdentity(organizationId, controller.signal);
        if (controller.signal.aborted) return;
        if (identity.activeOrganizationId !== organizationId || !identity.roles.includes("CONSULTANT")) throw new ProgramReportError(403);
        const result = await getProgramReport(organizationId, programId, selected || undefined, controller.signal);
        if (!controller.signal.aborted) {
          setReport(result); if (!selected) setPeople(result.participants); setMessage("");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setReport(undefined);
          const failure = error instanceof IdentityRequestError ? new ProgramReportError(error.status) : error;
          if (failure instanceof ProgramReportError && [401, 403, 404].includes(failure.status)) setPeople([]);
          setMessage(reportErrorMessage(failure));
        }
      } finally { if (!controller.signal.aborted) setPending(false); }
    }
    void load(); return () => controller.abort();
  }, [organizationId, programId, selected, attempt]);
  function change(enrollment: string) {
    setReport(undefined); setMessage("Preparando reporte…"); setExportMessage(""); setPending(true); setSelected(enrollment);
  }
  function refresh() { change(selected); setAttempt(a => a + 1); }
  async function download(format: ReportFormat) {
    if (!report || downloading.current) return;
    downloading.current = true; setExporting(true); setExportMessage("Preparando archivo…");
    const controller = new AbortController(); exportRequest.current = controller;
    try {
      const blob = await exportProgramReport(organizationId, programId, format, selected || undefined, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = `reporte-${programId}${selected ? `-${selected}` : ""}.${format}`; document.body.appendChild(a);
      try { a.click(); } finally { a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setExportMessage("Archivo preparado. Contiene datos personales: compártelo únicamente con personas autorizadas.");
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof ProgramReportError && [401, 403, 404].includes(error.status)) { setReport(undefined); setPeople([]); }
        setExportMessage(reportErrorMessage(error));
      }
    } finally { downloading.current = false; if (!controller.signal.aborted) setExporting(false); }
  }
  return <section className="rti-surface min-w-0 p-5 sm:p-8 lg:p-10">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="rti-kicker">Entregables para el cliente</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Reportes</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Participación, avance y encuestas en un solo lugar. Consulta el programa completo o el recorrido de una persona.</p></div>
      <FileChartColumn aria-hidden="true" className="hidden size-8 text-primary sm:block" />
    </div>
    {message && <p role="status" className="mt-5 rounded-2xl bg-muted/60 p-4 text-sm">{message}</p>}
    {exportMessage && <p role="status" className="mt-5 rounded-2xl bg-accent/50 p-4 text-sm">{exportMessage}</p>}
    {(people.length > 0 || report) && <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-background/60 p-4 lg:flex-row lg:items-end">
      <label className="min-w-0 flex-1 text-sm font-medium">Alcance del reporte
        <select className="rti-field mt-2 w-full" value={selected} disabled={pending || exporting} onChange={e => change(e.target.value)}>
          <option value="">Programa completo</option>{people.map(p => <option key={p.enrollmentId} value={p.enrollmentId}>{p.name} · {p.email}</option>)}
        </select></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rti-button-primary gap-2" disabled={!report || pending || exporting} onClick={() => void download("xlsx")}><Download aria-hidden="true" className="size-4" />Exportar Excel</button>
        <button type="button" className="rti-button-secondary gap-2" disabled={!report || pending || exporting} onClick={() => void download("csv")}><Download aria-hidden="true" className="size-4" />Exportar CSV</button>
      </div>
    </div>}
    {report && <div className="mt-7 space-y-7">
      <div><h2 className="break-words text-2xl font-semibold">{report.enrollmentId ? `Reporte individual · ${report.participants[0]?.name ?? "Participante"}` : report.programName}</h2>
        <p className="mt-2 break-words text-sm text-muted-foreground">{report.organizationName} · {programStates[report.programStatus]}{report.enrollmentId && ` · ${report.programName}`}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Corte {report.asOfDate} · {report.timeZone} · Generado {new Date(report.generatedAt).toLocaleString("es-CO", { timeZone: report.timeZone })}</p>
      </div>
      <Metrics summary={report.summary} />
      <details className="rounded-2xl border border-border p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Cómo interpretar estos datos</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-6 text-muted-foreground">
          <li><strong>Avance:</strong> los formularios de actividades aportan el 80% de cada sesión y su encuesta de cierre el 20% restante. No equivale a aprobación del consultor.</li>
          <li><strong>Aprobación:</strong> actividades aprobadas por el consultor entre todas las asignaciones vigentes.</li>
          <li><strong>Participación:</strong> personas con al menos una entrega entre todas las inscripciones del alcance, incluidas invitadas, suspendidas y retiradas.</li>
          <li><strong>Cumplimiento de fecha:</strong> de los plazos que ya terminaron, cuántas asignaciones tienen su última entrega y encuesta enviadas dentro de la fecha límite. No mide la primera entrega ni la aprobación. El día del vencimiento aún no se incluye.</li>
          <li><strong>Vencidas:</strong> plazo terminado y actividad aún no aprobada, aunque esté en revisión. Sin denominador, el porcentaje no aplica.</li>
          <li>Se usa el contenido vigente, sin archivados. Las fechas, estados y nombres son los actuales; no es un reporte histórico. Cada descarga vuelve a consultar los datos.</li>
        </ul>
      </details>
      <div className="flex flex-wrap gap-2" aria-label="Estados de inscripción">{Object.entries(report.enrollmentCounts).map(([status, count]) =>
        <span className="rounded-full bg-muted px-3 py-1 text-xs" key={status}>{enrollmentStatusLabels[status as keyof typeof enrollmentStatusLabels]}: {count}</span>)}</div>
      <ParticipantList key={selected || "all"} people={report.participants} disabled={pending || exporting} onSelect={change} individual={Boolean(selected)} />
      <details className="rounded-2xl border border-border p-4" open={selected ? true : undefined}>
        <summary className="cursor-pointer font-semibold">Detalle de actividades ({report.work.length} asignaciones)</summary>
        <WorkList key={`${selected}/${report.generatedAt}`} report={report} />
      </details>
      <details className="rounded-2xl border border-border p-4">
        <summary className="cursor-pointer font-semibold">Resultados y comparación de encuestas</summary>
        <SurveyReportDetails key={`${selected}/${report.generatedAt}`} report={report.surveys} />
      </details>
      <p className="text-xs leading-5 text-muted-foreground">Excel incluye Ficha, Participación, Actividades y Encuestas. CSV consolida esas secciones en columnas fijas; puedes filtrar la columna Sección. No se incluyen DISC ni textos de entregas. PDF corporativo: próximo incremento.</p>
    </div>}
    <button type="button" className="rti-button-secondary mt-7 gap-2" disabled={pending || exporting} onClick={refresh}><RefreshCw aria-hidden="true" className="size-4" />Actualizar reporte</button>
    <nav className="mt-8 flex flex-wrap gap-4 border-t border-border pt-6 text-sm" aria-label="Navegación de reportes">
      <Link className="rti-link" href={`/organizations/${encodeURIComponent(organizationId)}/programs/${encodeURIComponent(programId)}`}>Volver al programa</Link>
      <Link className="rti-link" href="/account">Volver a Cuenta</Link>
    </nav>
  </section>;
}
function Metrics({ summary: s }: { summary: ReportSummary }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {[["Avance del colaborador", percentage(s.progressPercentage), `${s.submitted} de ${s.assigned} entregas enviadas`],
      ["Aprobación del consultor", percentage(s.approvalPercentage), `${s.approved} de ${s.assigned} actividades aprobadas`],
      ["Participación", percentage(s.participationPercentage), `${s.participatingCount} de ${s.participantCount} personas con entregas`],
      ["Cumplimiento de fecha", percentage(s.onTimePercentage), `${s.onTime} de ${s.due} plazos terminados cumplidos`]].map(([title, value, help]) =>
      <article key={title} className="min-w-0 rounded-2xl border border-border bg-background/70 p-4"><h3 className="text-sm text-muted-foreground">{title}</h3>
        <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{help}</p></article>)}
    <p className="text-sm leading-6 text-muted-foreground sm:col-span-2 xl:col-span-4">Pendientes: {s.pending} · En revisión: {s.inReview} · Requiere cambios: {s.changesRequested} · Vencidas: {s.overdue} · Encuestas: {s.surveysCompleted}/{s.surveysAssigned}</p>
  </div>;
}
function ParticipantList({ people, onSelect, disabled, individual }: { people: ReportParticipant[]; onSelect: (id: string) => void; disabled: boolean; individual: boolean }) {
  const [page, setPage] = useState(0);
  return <div><h3 className="text-lg font-semibold">{individual ? "Participación individual" : `Participantes (${people.length})`}</h3>
    {people.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Aún no hay personas inscritas. Puedes exportar la ficha del programa sin resultados.</p>
      : <ul className="mt-4 grid gap-3 lg:grid-cols-2">{people.slice(page * 6, (page + 1) * 6).map(p => <li key={p.enrollmentId} className="min-w-0 rounded-2xl border border-border p-4">
        <p className="break-words font-semibold">{p.name}</p><p className="mt-1 break-all text-xs text-muted-foreground">{p.email}</p>
        <p className="mt-2 text-xs">Inscripción {enrollmentStatusLabels[p.status].toLocaleLowerCase("es")}</p>
        <p className="mt-3 text-sm">Avance {percentage(p.summary.progressPercentage)} · {p.summary.approved}/{p.summary.assigned} aprobadas</p>
        <p className="mt-1 text-xs text-muted-foreground">{p.summary.assigned === 0 ? "Sin actividades asignadas" : `${p.summary.overdue} vencidas · ${p.summary.surveysCompleted}/${p.summary.surveysAssigned} encuestas`}</p>
        {!individual && <button type="button" disabled={disabled} onClick={() => onSelect(p.enrollmentId)} className="rti-button-secondary mt-3">Ver reporte de {p.name}</button>}
      </li>)}</ul>}
    <Pager page={page} size={6} count={people.length} onPage={setPage} label="Páginas de participantes" />
  </div>;
}
function WorkList({ report }: { report: ProgramReport }) {
  const [page, setPage] = useState(0);
  const names = new Map(report.participants.map(p => [p.enrollmentId, p.name]));
  return <div className="mt-4">
    {report.work.length === 0 ? <p className="text-sm text-muted-foreground">No hay actividades asignadas en este alcance.</p> : <ul className="space-y-3">
      {report.work.slice(page * 10, (page + 1) * 10).map(w => <li key={w.assignmentId} className="rounded-xl bg-muted/40 p-4">
        <p className="break-words text-xs text-muted-foreground">{w.dimensionName} · {w.sessionName} · {names.get(w.enrollmentId)}</p>
        <p className="mt-1 break-words font-semibold">{w.activityTitle}</p>
        <p className="mt-2 text-sm">{activityStatusLabel(w.status)} · Avance {w.progressPercentage}%{w.overdue ? " · Vencida" : ""}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{w.dueDate ? `Fecha límite ${w.dueDate}` : "Sesión sin agendar"} · {w.surveyRequired ? w.surveyCompletedAt ? "Encuesta respondida" : "Encuesta pendiente" : "Sin encuesta"}</p>
      </li>)}
    </ul>}
    <Pager page={page} size={10} count={report.work.length} onPage={setPage} label="Páginas de actividades" />
  </div>;
}
function Pager({ page, size, count, onPage, label }: { page: number; size: number; count: number; onPage: (page: number) => void; label: string }) {
  if (count <= size) return null;
  return <nav aria-label={label} className="mt-4 flex flex-wrap items-center gap-3 text-sm">
    <button className="rti-button-secondary" disabled={page === 0} onClick={() => onPage(page - 1)}>Anterior</button>
    <span>{page + 1}/{Math.ceil(count / size)}</span><button className="rti-button-secondary" disabled={(page + 1) * size >= count} onClick={() => onPage(page + 1)}>Siguiente</button>
  </nav>;
}
