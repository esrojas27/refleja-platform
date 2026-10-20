"use client";

import Link from "next/link";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { exportSurveyResults, getSurveyResults, surveyResultsErrorMessage, SurveyResultsRequestError,
  type SurveyActivityOption, type SurveyFilters, type SurveyQuestionResult, type SurveyRespondent,
  type SurveyResult, type SurveyResults, type SurveySummary } from "@/lib/participation/survey-results-api";
import { AGREEMENT_OPTIONS, LIKELIHOOD_OPTIONS } from "@/lib/participation/evaluation-api";

export function ProgramSurveyResultsArea({ organizationId, programId }: { organizationId: string; programId: string }) {
  return <ResultsContent key={`${organizationId}/${programId}`} organizationId={organizationId} programId={programId} />;
}
function ResultsContent({ organizationId, programId }: { organizationId: string; programId: string }) {
  const [report, setReport] = useState<SurveyResults>();
  const [options, setOptions] = useState<SurveyActivityOption[]>([]);
  const [filters, setFilters] = useState<SurveyFilters>({});
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("Comprobando acceso y consultando encuestas…");
  const [exportMessage, setExportMessage] = useState("");
  const [level, setLevel] = useState<"dimensions" | "sessions" | "activities">("dimensions");
  const exportRequest = useRef<AbortController | null>(null);
  const downloading = useRef(false);
  useEffect(() => () => exportRequest.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const identity = await fetchCurrentIdentity(organizationId, controller.signal);
        if (controller.signal.aborted) return;
        if (identity.activeOrganizationId !== organizationId || !identity.roles.includes("CONSULTANT"))
          throw new SurveyResultsRequestError(403);
        const data = await getSurveyResults(organizationId, programId, filters, controller.signal);
        if (!controller.signal.aborted) { setReport(data); setOptions(data.options); setMessage(""); }
      } catch (error) {
        if (!controller.signal.aborted) {
          setReport(undefined);
          const failure = error instanceof IdentityRequestError ? new SurveyResultsRequestError(error.status) : error;
          if (failure instanceof SurveyResultsRequestError && [401, 403].includes(failure.status)) setOptions([]);
          setMessage(surveyResultsErrorMessage(failure));
        }
      } finally { if (!controller.signal.aborted) setPending(false); }
    }
    void load();
    return () => controller.abort();
  }, [organizationId, programId, filters, attempt]);
  function change(next: SurveyFilters) {
    setReport(undefined); setPending(true); setMessage("Actualizando resultados…"); setExportMessage(""); setFilters(next);
  }
  function refresh() { change(filters); setAttempt(value => value + 1); }
  async function download() {
    if (downloading.current || !report) return;
    downloading.current = true; setExporting(true); setExportMessage("Preparando CSV…");
    const controller = new AbortController(); exportRequest.current = controller;
    try {
      const blob = await exportSurveyResults(organizationId, programId, filters, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `encuestas-${programId}.csv`;
      document.body.appendChild(anchor);
      try { anchor.click(); } finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setExportMessage("CSV preparado con los filtros actuales. Contiene datos personales; compártelo únicamente con personas autorizadas.");
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof SurveyResultsRequestError && [401, 403].includes(error.status)) { setReport(undefined); setOptions([]); }
        setExportMessage(surveyResultsErrorMessage(error));
      }
    } finally { downloading.current = false; if (!controller.signal.aborted) setExporting(false); }
  }
  const dimensions = [...new Map(options.map(a => [a.dimensionId, a.dimensionName])).entries()];
  const sessionOptions = options.filter(a => !filters.dimensionId || a.dimensionId === filters.dimensionId);
  const sessions = [...new Map(sessionOptions.map(a => [a.sessionId, a])).values()];
  const activityOptions = sessionOptions.filter(a => !filters.sessionId || a.sessionId === filters.sessionId);
  return <section className="rti-surface w-full min-w-0 p-6 sm:p-8 lg:p-10">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="rti-kicker">Escucha y aprendizaje</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Resultados de encuestas</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Explora la experiencia de los participantes, desde el programa completo hasta cada actividad.</p></div>
      {report && <button type="button" disabled={pending || exporting} className="rti-button-primary shrink-0" onClick={() => void download()}>
        <Download aria-hidden="true" className="size-4" />{exporting ? "Exportando…" : "Exportar CSV"}</button>}
    </div>
    {message && <p role="status" className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {exportMessage && <p role="status" className="mt-5 rounded-2xl bg-accent/50 px-4 py-3 text-sm">{exportMessage}</p>}
    {options.length > 0 && <fieldset disabled={pending || exporting} className="mt-6 grid gap-4 rounded-2xl border border-border bg-background/60 p-4 md:grid-cols-3">
      <legend className="px-2 text-sm font-semibold">Filtrar resultados</legend>
      <label className="min-w-0 text-sm font-medium">Dimensión<select className="rti-field w-full" value={filters.dimensionId ?? ""}
        onChange={event => change({ dimensionId: event.target.value || undefined })}>
        <option value="">Todas las dimensiones</option>{dimensions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="min-w-0 text-sm font-medium">Sesión<select className="rti-field w-full" value={filters.sessionId ?? ""}
        onChange={event => change({ dimensionId: filters.dimensionId, sessionId: event.target.value || undefined })}>
        <option value="">Todas las sesiones</option>{sessions.map(a => <option key={a.sessionId} value={a.sessionId}>{a.dimensionName} · {a.sessionName}</option>)}</select></label>
      <label className="min-w-0 text-sm font-medium">Actividad<select className="rti-field w-full" value={filters.activityId ?? ""}
        onChange={event => change({ ...filters, activityId: event.target.value || undefined })}>
        <option value="">Todas las actividades</option>{activityOptions.map(a => <option key={a.id} value={a.id}>{a.sessionName} · {a.title}</option>)}</select></label>
    </fieldset>}
    {report && <div className="mt-7 space-y-8">
      <div><h2 className="text-xl font-semibold">Resumen del alcance seleccionado</h2>
        <p className="mt-2 text-sm text-muted-foreground">{report.programName} · {report.summary.surveyCount} encuestas · {report.summary.respondentCount} de {report.summary.participantCount} participantes con encuesta asignada respondieron al menos una.</p>
        <div className="mt-4"><Summary summary={report.summary} /></div></div>
      <p className="rounded-xl border border-border bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">
        Las pendientes no cuentan como cero. Acuerdo y probabilidad se calculan por separado, sobre respuestas enviadas (n).
        Las medias por dimensión, sesión y actividad son descriptivas y pueden incluir preguntas distintas; no son una calificación ni una medición de impacto.
        El contenido archivado sin entregas queda fuera del alcance.
      </p>
      {report.summary.surveyCount === 0 ? <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">Aún no hay encuestas configuradas en el contenido vigente de este programa.</p>
        : <>
          {report.summary.responseCount === 0 && <p className="rounded-2xl bg-muted/50 p-4 text-sm">Todavía no hay respuestas enviadas. Las distribuciones están en cero y los promedios no están disponibles.</p>}
          <section aria-labelledby="survey-comparison-title">
            <div className="flex flex-wrap items-center justify-between gap-4"><h2 id="survey-comparison-title" className="text-xl font-semibold">Comparar resultados</h2>
              <label className="text-sm">Comparar por<select className="rti-field" value={level} onChange={event => setLevel(event.target.value as typeof level)}>
                <option value="dimensions">Dimensión</option><option value="sessions">Sesión</option><option value="activities">Actividad</option></select></label></div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">{report[level].map(item => <article key={item.id} className="min-w-0 rounded-2xl border border-border p-4">
              {item.context && <p className="text-xs text-muted-foreground">{item.context}</p>}<h3 className="mt-1 break-words font-semibold">{item.name}</h3>
              <div className="mt-4"><Summary summary={item.summary} compact /></div>
            </article>)}</div>
          </section>
          <section aria-labelledby="survey-detail-title"><h2 id="survey-detail-title" className="text-xl font-semibold">Detalle de las encuestas</h2>
            <p className="mt-2 text-sm text-muted-foreground">Abre una actividad para consultar preguntas, distribución y respuestas individuales.</p>
            <div className="mt-4 space-y-4">{report.surveys.map(survey => <SurveyCard key={survey.id} survey={survey} expanded={!!filters.activityId} />)}</div>
          </section>
        </>}
      <p className="text-xs leading-5 text-muted-foreground">Consulta y exportación exclusivas del consultor autorizado. El CSV incluye resúmenes, distribuciones y respuestas identificadas; úsalo como información confidencial.</p>
    </div>}
    <button type="button" className="rti-button-secondary mt-7" disabled={pending || exporting} onClick={refresh}><RefreshCw aria-hidden="true" className="size-4" />Actualizar resultados</button>
    <nav className="mt-8 flex flex-wrap gap-4 border-t border-border pt-6 text-sm" aria-label="Navegación de resultados">
      <Link href={`/organizations/${encodeURIComponent(organizationId)}/programs/${encodeURIComponent(programId)}`} className="rti-link">Volver al programa</Link>
      <Link href="/account" className="rti-link">Volver a Cuenta</Link>
    </nav>
  </section>;
}
const number = (value: number | null) => value === null ? "—" : value.toLocaleString("es-CO", { maximumFractionDigits: 2 });
function Summary({ summary, compact = false }: { summary: SurveySummary; compact?: boolean }) {
  return <div className={`grid gap-3 ${compact ? "grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
    {[["Encuestas respondidas", `${summary.responseCount} / ${summary.assignedCount}`, summary.responseRate === null ? "Sin encuestas asignadas" : `${number(summary.responseRate)}% de las asignadas`],
      ["Pendientes", String(summary.pendingCount), "Incluye entregas aún no enviadas"],
      ["Acuerdo · media / 5", number(summary.agreementAverage), `n = ${summary.agreementAnswers} respuestas de escala`],
      ["Probabilidad · media / 5", number(summary.likelihoodAverage), `n = ${summary.likelihoodAnswers} respuestas de escala`]].map(([label, value, help]) =>
      <div key={label} className="min-w-0 rounded-xl border border-border/70 bg-background/70 p-3"><p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{help}</p></div>)}
  </div>;
}
function SurveyCard({ survey, expanded }: { survey: SurveyResult; expanded: boolean }) {
  return <details open={expanded || undefined} className="rounded-2xl border border-border bg-background/65">
    <summary className="cursor-pointer rounded-2xl p-5 focus-visible:outline-2 focus-visible:outline-ring">
      <span className="text-xs text-muted-foreground">{survey.activity.dimensionName} · {survey.activity.sessionName}</span>
      <span className="mt-2 block break-words text-lg font-semibold">{survey.activity.title}</span>
      <span className="mt-1 block text-sm text-muted-foreground">{survey.title} · {survey.summary.responseCount} de {survey.summary.assignedCount} encuestas respondidas</span>
    </summary>
    <div className="space-y-5 border-t border-border p-4 sm:p-5">
      {survey.questions.map(question => <Question key={question.id} question={question} respondents={survey.responses} />)}
      <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-semibold">Respuestas por participante ({survey.responses.length})</summary>
        <Respondents key={survey.id} people={survey.responses} render={person => <div className="space-y-3">{survey.questions.map(q => {
          const values = person.answers.find(a => a.questionId === q.id)?.values ?? [];
          const options = q.type === "AGREEMENT_SCALE" ? AGREEMENT_OPTIONS : q.type === "LIKELIHOOD_SCALE" ? LIKELIHOOD_OPTIONS : undefined;
          return <div key={q.id}><p className="text-sm font-medium">{q.position}. {q.prompt}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{values.map(v => options ? `${v} · ${options[Number(v) - 1]}` : v).join(" · ")}</p></div>;
        })}</div>} />
      </details>
    </div>
  </details>;
}
function Question({ question, respondents }: { question: SurveyQuestionResult; respondents: SurveyRespondent[] }) {
  const open = question.type === "OPEN_TEXT";
  const emotion = question.type === "EMOTION_MULTI_SELECT";
  return <article className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label={`Pregunta ${question.position}: ${question.prompt}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><h4 className="break-words font-semibold">{question.position}. {question.prompt}</h4>
      <BarChart3 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></div>
    <p className="mt-2 text-xs text-muted-foreground">{question.responseCount} respuestas{question.average !== null ? ` · Media ${number(question.average)} / 5` : ""}</p>
    {emotion && <p className="mt-2 text-xs text-muted-foreground">Hasta dos emociones por persona. Cada porcentaje usa como base las personas que respondieron esta pregunta; la suma puede superar el 100%.</p>}
    {emotion && question.responseCount > 0 && <p className="mt-3 text-sm font-medium">Más seleccionadas: {question.distribution.filter(option => option.count === question.distribution[0]?.count).map(option => option.label).join(", ")}</p>}
    {open ? <Respondents key={question.id} people={respondents.filter(p => p.answers.some(a => a.questionId === question.id))}
      render={person => <p className="whitespace-pre-wrap break-words text-sm">{person.answers.find(a => a.questionId === question.id)?.values[0]}</p>} />
      : <ol className="mt-4 space-y-3">{question.distribution.map(option => <li key={option.value}>
        <div className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words">{!emotion && `${option.value}. `}{option.label}</span>
          <span className="shrink-0 tabular-nums">{option.count} · {number(option.percentage)}%</span></div>
        <progress className="mt-1 h-2 w-full accent-primary" max={100} value={option.percentage} aria-label={`${option.label}: ${option.count} respuestas`} />
      </li>)}</ol>}
  </article>;
}
function Respondents({ people, render }: { people: SurveyRespondent[]; render: (person: SurveyRespondent) => ReactNode }) {
  const [page, setPage] = useState(0);
  const size = 5;
  const pages = Math.ceil(people.length / size);
  return <div className="mt-4">
    {people.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay respuestas.</p> : <>
      <ul className="space-y-4">{people.slice(page * size, (page + 1) * size).map(person => <li key={person.responseId} className="rounded-xl border border-border/70 bg-background/60 p-3">
        <p className="break-words text-sm font-semibold">{person.name}</p><p className="mt-1 break-all text-xs text-muted-foreground">{person.email}</p>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">{new Date(person.completedAt).toLocaleString("es-CO")}</p>{render(person)}
      </li>)}</ul>
      {pages > 1 && <nav aria-label="Páginas de respuestas" className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="rti-button-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button>
        <span>{page + 1} / {pages}</span><button type="button" className="rti-button-secondary" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Siguiente</button>
      </nav>}
    </>}
  </div>;
}
