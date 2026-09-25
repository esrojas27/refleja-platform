import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { createProgramFromTemplate, createProgramTemplate, getProgramTemplateReadiness,
  listProgramTemplates } from "@/lib/programs/program-template-api";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));
const session = { tokens: { accessToken: { toString: () => "access-token" } } };

describe("program template API", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8082/");
    vi.mocked(fetchAuthSession).mockResolvedValue(session as never);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it("uses the selected organization as access context for the global catalog and readiness", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({ items: [] }), { status: 200 })));
    vi.stubGlobal("fetch", fetcher);
    await listProgramTemplates("org a");
    await getProgramTemplateReadiness("org a", "program/a");
    expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8082/api/v1/organizations/org%20a/program-templates?page=0&size=100");
    expect(fetcher.mock.calls[1][0]).toBe("http://localhost:8082/api/v1/organizations/org%20a/programs/program%2Fa/template-readiness");
  });

  it("sends only the approved template and materialization fields", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "template-a" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "program-a" }), { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    await createProgramTemplate("org-a", { sourceProgramId: "source-a", name: "Plantilla", description: "Base" });
    await createProgramFromTemplate("org-a", "template-a", {
      name: "Nueva cohorte", description: "Copia", startDate: "2027-01-01", endDate: "2027-02-01",
    });
    expect(fetcher.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: "POST", body: JSON.stringify({ sourceProgramId: "source-a", name: "Plantilla", description: "Base" }),
    }));
    expect(fetcher.mock.calls[1][0]).toBe("http://localhost:8082/api/v1/organizations/org-a/program-templates/template-a/programs");
    expect(fetcher.mock.calls[1][1]).toEqual(expect.objectContaining({ method: "POST", body: JSON.stringify({
      name: "Nueva cohorte", description: "Copia", startDate: "2027-01-01", endDate: "2027-02-01",
    }) }));
  });

  it("keeps only allowlisted fields, issue codes and request identifiers from failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "PROGRAM_TEMPLATE_INCOMPLETE", message: "internal detail", errors: [{ field: "secret" }],
      issues: ["ACTIVITY_WITHOUT_SURVEY", 12], requestId: "01900000-0000-7000-8000-000000001234",
    }), { status: 409 })));
    await expect(createProgramTemplate("org-a", { sourceProgramId: "source", name: "X", description: "" }))
      .rejects.toMatchObject({ status: 409, fields: [], issues: ["ACTIVITY_WITHOUT_SURVEY"],
        requestId: "01900000-0000-7000-8000-000000001234" });
  });

  it("never calls the backend without a Cognito access token", async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue({} as never);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(listProgramTemplates("org-a")).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
