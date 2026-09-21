import type { ActivityAssignmentStatus, AssignedActivity, ProgramActivity } from "@/lib/participation/activity-api";
import {
  activityStatusLabel,
  collaboratorProgress,
  consultantProgress,
  isActivityOverdue,
  type DimensionProgress,
  type ProgressSummary,
} from "@/lib/participation/progress";

export function CollaboratorProgressOverview({ activities }: { activities: AssignedActivity[] }) {
  const progress = collaboratorProgress(activities);
  return <section aria-labelledby="collaborator-progress-title" className="space-y-6">
    <div>
      <p className="rti-kicker">Tu avance</p>
      <h2 id="collaborator-progress-title" className="mt-2 text-2xl font-semibold">Progreso del programa</h2>
      <p className="mt-2 text-sm text-muted-foreground">Cada entrega aporta 50% y su encuesta completa el 50% restante.</p>
    </div>
    <ProgressSummaryCard progress={progress} subject="Tu progreso general"
      detail="El porcentaje refleja las entregas y encuestas completadas." />
    {progress.total > 0 && <ProgressBreakdown dimensions={progress.dimensions} />}
  </section>;
}

export function ConsultantProgressOverview({ activities }: { activities: ProgramActivity[] }) {
  const progress = consultantProgress(activities);
  return <div className="space-y-8">
    <ProgressSummaryCard progress={progress.program} subject="Progreso general del programa"
      detail={`${progress.program.completed} de ${progress.program.total} actividades aprobadas.`} />
    {progress.program.total > 0 && <>
      <section aria-labelledby="participant-progress-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="rti-kicker">Vista operativa</p>
            <h2 id="participant-progress-title" className="mt-2 text-xl font-semibold">Avance por colaborador</h2></div>
          <p className="text-sm text-muted-foreground">Ordenado por quienes requieren más atención.</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {progress.participants.map(participant => <article key={participant.enrollmentId}
            className="rounded-2xl border border-border/70 bg-background/70 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0"><h3 className="truncate font-semibold">{participant.name}</h3>
                <p className="truncate text-sm text-muted-foreground">{participant.email}</p></div>
              {(participant.overdue > 0 || participant.changesRequested > 0) &&
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">Requiere atención</span>}
            </div>
            <CompactProgress progress={participant} />
            <p className="mt-3 text-xs text-muted-foreground">{participant.completed} de {participant.total} completadas
              {participant.overdue > 0 ? ` · ${participant.overdue} vencida${participant.overdue === 1 ? "" : "s"}` : ""}</p>
          </article>)}
        </div>
      </section>
      <ProgressBreakdown dimensions={progress.program.dimensions} />
    </>}
  </div>;
}

export function ActivityStatusBadges({ status, dueDate, surveyStatus }: {
  status: ActivityAssignmentStatus;
  dueDate: string;
  surveyStatus?: "LOCKED" | "PENDING" | "COMPLETED";
}) {
  const styles = {
    ASSIGNED: "bg-amber-100 text-amber-900",
    SUBMITTED: "bg-sky-100 text-sky-900",
    CHANGES_REQUESTED: "bg-orange-100 text-orange-900",
    COMPLETED: "bg-emerald-100 text-emerald-900",
  }[status];
  return <div className="flex flex-wrap justify-end gap-2" aria-label="Estado de la actividad">
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>{activityStatusLabel(status)}</span>
    {surveyStatus === "PENDING" &&
      <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-900">Encuesta pendiente</span>}
    {surveyStatus === "COMPLETED" &&
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">Encuesta lista</span>}
    {isActivityOverdue(dueDate, status) &&
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-900">Vencida</span>}
  </div>;
}

function ProgressSummaryCard({ progress, subject, detail }: {
  progress: ProgressSummary; subject: string; detail: string;
}) {
  return <div className="overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-accent/35 p-5 sm:p-7">
    <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-center">
      <div className="mx-auto flex size-40 items-center justify-center rounded-full p-3"
        style={{ background: `conic-gradient(var(--primary) ${progress.percentage}%, var(--muted) 0)` }}>
        <div className="flex size-full flex-col items-center justify-center rounded-full bg-card text-center shadow-inner">
          <strong className="text-4xl font-semibold">{progress.percentage}%</strong>
          <span className="mt-1 text-xs text-muted-foreground">completado</span>
        </div>
      </div>
      <div>
        <h3 className="text-xl font-semibold">{subject}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        <ProgressMeter progress={progress} />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Metric label="Pendientes" value={progress.pending} tone="amber" />
          <Metric label="En revisión" value={progress.inReview} tone="sky" />
          <Metric label="Con cambios" value={progress.changesRequested} tone="orange" />
          <Metric label="Completadas" value={progress.completed} tone="emerald" />
          <Metric label="Vencidas" value={progress.overdue} tone="red" />
        </div>
      </div>
    </div>
  </div>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "amber" | "sky" | "orange" | "emerald" | "red" }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    sky: "border-sky-200 bg-sky-50 text-sky-950",
    orange: "border-orange-200 bg-orange-50 text-orange-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    red: "border-red-200 bg-red-50 text-red-950",
  };
  return <div className={`rounded-2xl border px-3 py-3 ${tones[tone]}`}>
    <strong className="block text-2xl font-semibold">{value}</strong>
    <span className="text-xs font-medium">{label}</span>
  </div>;
}

function ProgressBreakdown({ dimensions }: { dimensions: DimensionProgress[] }) {
  return <section aria-labelledby="progress-breakdown-title">
    <p className="rti-kicker">Recorrido</p>
    <h2 id="progress-breakdown-title" className="mt-2 text-xl font-semibold">Progreso por dimensión y sesión</h2>
    <div className="mt-4 space-y-4">{dimensions.map(dimension => <article key={dimension.id}
      className="rounded-2xl border border-border/70 bg-background/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{dimension.name}</h3>
        <span className="text-sm font-semibold text-primary">{dimension.percentage}%</span>
      </div>
      <CompactProgress progress={dimension} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{dimension.sessions.map(session => <div key={session.id}
        className="rounded-xl border border-border/60 bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">{session.name}</span>
          <span className="text-muted-foreground">{session.completed}/{session.total}</span></div>
        <CompactProgress progress={session} />
      </div>)}</div>
    </article>)}</div>
  </section>;
}

function CompactProgress({ progress }: { progress: ProgressSummary }) {
  return <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar"
    aria-label={`Progreso: ${progress.percentage}%`} aria-valuemin={0} aria-valuemax={100}
    aria-valuenow={progress.percentage}>
    <div className="h-full rounded-full bg-primary transition-[width] duration-500"
      style={{ width: `${progress.percentage}%` }} />
  </div>;
}

function ProgressMeter({ progress }: { progress: ProgressSummary }) {
  return <CompactProgress progress={progress} />;
}
