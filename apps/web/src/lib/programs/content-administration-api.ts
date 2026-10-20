import { fetchAuthSession } from "aws-amplify/auth";
import { programsPath } from "./program-api";
import { ProgramContentRequestError } from "./program-content-api";
import type { EvaluationInput, ActivityEvaluation } from "@/lib/participation/evaluation-api";

export type ContentKind = "dimensions" | "sessions" | "activities";
export function contentPath(org: string, program: string) {
  return `${programsPath(org)}/${encodeURIComponent(program)}/content`;
}
async function request<T = void>(org: string, program: string, suffix: string, method: "PUT" | "POST",
  input: unknown, signal?: AbortSignal, expected = 204): Promise<T> {
  signal?.throwIfAborted();
  const session = await fetchAuthSession();
  signal?.throwIfAborted();
  if (!session.tokens?.accessToken) throw new ProgramContentRequestError(401);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new ProgramContentRequestError(0);
  const result = await fetch(`${base.replace(/\/$/, "")}/api/v1${contentPath(org, program)}/${suffix}`, {
    method, signal, cache: "no-store", headers: { Authorization: `Bearer ${session.tokens.accessToken.toString()}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (result.status !== expected) {
    const body = await result.json().catch(() => null);
    const allowed = ["name", "description", "objective", "scheduledDate", "title", "instructions", "youtubeUrl", "dueDate", "questions", "enrollmentIds"];
    const fields = body?.code === "VALIDATION_ERROR" && Array.isArray(body.errors)
      ? body.errors.map((e: { field?: unknown }) => e?.field).filter((f: unknown): f is string => typeof f === "string" && allowed.includes(f)) : [];
    const rid = typeof body?.requestId === "string" && /^[a-f0-9-]{36}$/i.test(body.requestId) ? body.requestId : undefined;
    throw new ProgramContentRequestError(result.status, fields, rid, typeof body?.code === "string" ? body.code : undefined);
  }
  return (expected === 204 ? undefined : await result.json()) as T;
}
export const editDimension = (org: string, program: string, id: string,
  input: { name: string; description: string; version: number }, signal?: AbortSignal) =>
  request(org, program, `dimensions/${encodeURIComponent(id)}`, "PUT", { name: input.name, description: input.description, version: input.version }, signal);
export const editSession = (org: string, program: string, id: string,
  input: { name: string; objective: string; scheduledDate: string; version: number }, signal?: AbortSignal) =>
  request(org, program, `sessions/${encodeURIComponent(id)}`, "PUT", { name: input.name, objective: input.objective, scheduledDate: input.scheduledDate, version: input.version }, signal);
export const editActivity = (org: string, program: string, id: string,
  input: { title: string; instructions: string; youtubeUrl: string | null; dueDate: string; version: number }, signal?: AbortSignal) =>
  request(org, program, `activities/${encodeURIComponent(id)}`, "PUT", { title: input.title, instructions: input.instructions, youtubeUrl: input.youtubeUrl, dueDate: input.dueDate, version: input.version }, signal);
export const editSurvey = (org: string, program: string, activity: string, input: EvaluationInput & { version: number }, signal?: AbortSignal) =>
  request<ActivityEvaluation>(org, program, `activities/${encodeURIComponent(activity)}/survey`, "PUT",
    { title: input.title, instructions: input.instructions, questions: input.questions.map(q => ({ prompt: q.prompt, type: q.type, position: q.position })), version: input.version }, signal, 200);
export const archiveContent = (org: string, program: string, kind: ContentKind, id: string, version: number, archived: boolean) =>
  request(org, program, `${kind}/${encodeURIComponent(id)}/archive`, "POST", { version, archived });
export const moveContent = (org: string, program: string, kind: ContentKind, id: string, version: number, direction: "UP" | "DOWN") =>
  request(org, program, `${kind}/${encodeURIComponent(id)}/move`, "POST", { version, direction });
export const deleteContent = (org: string, program: string, kind: ContentKind, id: string, version: number) =>
  request(org, program, `${kind}/${encodeURIComponent(id)}/delete`, "POST", { version });
export const duplicateActivity = (org: string, program: string, id: string, version: number, assignToAll: boolean, enrollmentIds: string[]) =>
  request<{ id: string }>(org, program, `activities/${encodeURIComponent(id)}/duplicate`, "POST", { version, assignToAll, enrollmentIds }, undefined, 201);
