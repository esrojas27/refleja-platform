import type {
  ActivityAssignmentStatus,
  AssignedActivity,
  ProgramActivity,
} from "@/lib/participation/activity-api";

export type ProgressCounts = {
  total: number;
  pending: number;
  inReview: number;
  changesRequested: number;
  completed: number;
  overdue: number;
};

export type ProgressSummary = ProgressCounts & { percentage: number };

export type SessionProgress = ProgressSummary & {
  id: string;
  name: string;
};

export type DimensionProgress = ProgressSummary & {
  id: string;
  name: string;
  sessions: SessionProgress[];
};

export type ProgramProgress = ProgressSummary & {
  dimensions: DimensionProgress[];
};

export type ParticipantProgress = ProgressSummary & {
  enrollmentId: string;
  name: string;
  email: string;
};

export type ConsultantProgress = {
  program: ProgramProgress;
  participants: ParticipantProgress[];
};

type ProgressItem = {
  dimensionId: string;
  dimensionName: string;
  sessionId: string;
  sessionName: string;
  dueDate: string;
  status: ActivityAssignmentStatus;
};

type ParticipantItem = ProgressItem & {
  enrollmentId: string;
  name: string;
  email: string;
};

export function todayIso(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isActivityOverdue(
  dueDate: string,
  status: ActivityAssignmentStatus,
  today = todayIso(),
) {
  return status !== "COMPLETED" && dueDate < today;
}

export function collaboratorProgress(
  activities: AssignedActivity[],
  today = todayIso(),
): ProgramProgress {
  return programProgress(activities.map(activity => ({
    dimensionId: activity.moduleId,
    dimensionName: activity.dimensionName,
    sessionId: activity.sessionId,
    sessionName: activity.sessionName,
    dueDate: activity.dueDate,
    status: activity.assignmentStatus,
  })), today);
}

export function consultantProgress(
  activities: ProgramActivity[],
  today = todayIso(),
): ConsultantProgress {
  const items: ParticipantItem[] = activities.flatMap(activity => activity.assignees.map(assignee => ({
    dimensionId: activity.moduleId,
    dimensionName: activity.dimensionName,
    sessionId: activity.sessionId,
    sessionName: activity.sessionName,
    dueDate: activity.dueDate,
    status: assignee.status,
    enrollmentId: assignee.enrollmentId,
    name: [assignee.firstName, assignee.lastName].filter(Boolean).join(" ") || assignee.email,
    email: assignee.email,
  })));

  const participantItems = groupBy(items, item => item.enrollmentId);
  const participants = Array.from(participantItems, ([enrollmentId, owned]) => ({
    enrollmentId,
    name: owned[0].name,
    email: owned[0].email,
    ...summary(owned, today),
  })).sort((left, right) => left.percentage - right.percentage
    || right.overdue - left.overdue
    || left.name.localeCompare(right.name, "es"));

  return { program: programProgress(items, today), participants };
}

function programProgress(items: ProgressItem[], today: string): ProgramProgress {
  const dimensions = Array.from(groupBy(items, item => item.dimensionId), ([id, grouped]) => ({
    id,
    name: grouped[0].dimensionName,
    ...summary(grouped, today),
    sessions: Array.from(groupBy(grouped, item => item.sessionId), ([sessionId, sessionItems]) => ({
      id: sessionId,
      name: sessionItems[0].sessionName,
      ...summary(sessionItems, today),
    })).sort((left, right) => left.name.localeCompare(right.name, "es")),
  })).sort((left, right) => left.name.localeCompare(right.name, "es"));

  return { ...summary(items, today), dimensions };
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    groups.set(value, [...(groups.get(value) ?? []), item]);
  }
  return groups;
}

function summary(items: ProgressItem[], today: string): ProgressSummary {
  const counts: ProgressCounts = {
    total: items.length,
    pending: 0,
    inReview: 0,
    changesRequested: 0,
    completed: 0,
    overdue: 0,
  };
  for (const item of items) {
    if (item.status === "ASSIGNED") counts.pending += 1;
    if (item.status === "SUBMITTED") counts.inReview += 1;
    if (item.status === "CHANGES_REQUESTED") counts.changesRequested += 1;
    if (item.status === "COMPLETED") counts.completed += 1;
    if (isActivityOverdue(item.dueDate, item.status, today)) counts.overdue += 1;
  }
  return { ...counts, percentage: counts.total ? Math.round((counts.completed / counts.total) * 100) : 0 };
}

export function activityStatusLabel(status: ActivityAssignmentStatus) {
  return {
    ASSIGNED: "Pendiente",
    SUBMITTED: "En revisión",
    CHANGES_REQUESTED: "Requiere cambios",
    COMPLETED: "Completada",
  }[status];
}
