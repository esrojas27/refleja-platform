import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { archiveContent, deleteContent, duplicateActivity, editActivity, editDimension, editSession, editSurvey, moveContent } from "@/lib/programs/content-administration-api";
import { programContentErrorMessage, ProgramContentRequestError } from "@/lib/programs/program-content-api";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8081/");
  vi.mocked(fetchAuthSession).mockResolvedValue({ tokens: { accessToken: { toString: () => "access" } } } as never);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });

it("sends versioned edits with explicit fields, scoped paths and no cache", async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal("fetch", fetcher);
  await editDimension("org a", "program/a", "dim/a", { name: "Interior", description: "", version: 3 });
  await editSession("org a", "program/a", "session", { name: "Sesión", closingComment: "Objetivo", version: 2 });
  const input = { title: "Actividad", instructions: "Instrucciones", youtubeUrl: null, dueDate: "2026-10-21", version: 4, assignees: ["never-send"] };
  await editActivity("org a", "program/a", "activity", input);
  expect(fetcher.mock.calls[0]).toEqual(["http://localhost:8081/api/v1/organizations/org%20a/programs/program%2Fa/content/dimensions/dim%2Fa",
    expect.objectContaining({ method: "PUT", cache: "no-store", headers: { Authorization: "Bearer access", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Interior", description: "", version: 3 }) })]);
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).not.toHaveProperty("assignees");
  expect(JSON.parse(fetcher.mock.calls[1][1].body).version).toBe(2);
});

it("sends reorder, archive, restore and delete intents without automatic retries", async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal("fetch", fetcher);
  await moveContent("o", "p", "sessions", "s", 2, "DOWN");
  await archiveContent("o", "p", "activities", "a", 3, true);
  await archiveContent("o", "p", "activities", "a", 4, false);
  await deleteContent("o", "p", "dimensions", "d", 1);
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(fetcher.mock.calls.map(call => JSON.parse(call[1].body))).toEqual([
    { version: 2, direction: "DOWN" }, { version: 3, archived: true }, { version: 4, archived: false }, { version: 1 },
  ]);
});

it("duplicates definitions without manual assignment targets and replaces survey definition only", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: "copy" }), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: "survey" }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  expect(await duplicateActivity("o", "p", "a", 3)).toEqual({ id: "copy" });
  await editSurvey("o", "p", "a", { title: "Encuesta", instructions: null, version: 5,
    questions: [{ prompt: "¿Qué aprendiste?", type: "OPEN_TEXT", position: 1 }] });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ version: 3 });
  expect(fetcher.mock.calls[1][0]).toMatch(/activities\/a\/survey$/);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).version).toBe(5);
});

it("includes ordered custom options when editing surveys", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "survey" }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const options = ["Conectar", "Inspirar", "Escuchar", "Liderar", "Aprender", "Crear"];
  await editSurvey("o", "p", "a", { title: "Encuesta", instructions: null, version: 0,
    questions: [{ prompt: "Elige", type: "SINGLE_CHOICE_WORDS", position: 1, options }] });
  expect(JSON.parse(fetcher.mock.calls[0][1].body).questions[0].options).toEqual(options);
});

it("preserves conflict codes without exposing arbitrary validation fields", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "CONTENT_HAS_SUBMISSIONS", message: "private detail" }), { status: 409 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(archiveContent("o", "p", "activities", "a", 0, true)).rejects.toMatchObject({ status: 409, code: "CONTENT_HAS_SUBMISSIONS" });
  expect(programContentErrorMessage(new ProgramContentRequestError(409, [], undefined, "CONTENT_HAS_SUBMISSIONS"))).toMatch(/Ya existen entregas/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("does not contact the API without a session", async () => {
  vi.mocked(fetchAuthSession).mockResolvedValue({} as never);
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(deleteContent("o", "p", "activities", "a", 0)).rejects.toMatchObject({ status: 401 });
  expect(fetcher).not.toHaveBeenCalled();
});
