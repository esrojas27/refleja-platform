import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { listProgramDiscProfiles, saveProgramDiscProfile, uploadDiscPdf, getMyDiscProfile } from "@/lib/participation/disc-api";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));

describe("DISC API", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8082/");
    vi.mocked(fetchAuthSession).mockResolvedValue({ tokens: { accessToken: { toString: () => "disc-token" } } } as never);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it("uses tenant and program scoped paths without user-selected ownership", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ enrollmentId: "enrollment-a" }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const input = { dominant: 80, influential: 65, serene: 30,
      conscientious: 45, version: null };

    await listProgramDiscProfiles("org a", "program/a");
    await saveProgramDiscProfile("org a", "program/a", "enrollment/a", input);

    const base = "http://localhost:8082/api/v1/organizations/org%20a/programs/program%2Fa/disc-profiles";
    expect(fetcher.mock.calls[0][0]).toBe(base);
    expect(fetcher.mock.calls[1]).toEqual([`${base}/enrollment%2Fa`, expect.objectContaining({
      method: "PUT", body: JSON.stringify(input),
      headers: { Authorization: "Bearer disc-token", "Content-Type": "application/json" },
    })]);
  });

  it("does not call the backend without a Cognito access token", async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue({} as never);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(listProgramDiscProfiles("org", "program")).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uploads a PDF using the DISC endpoint without letting the client choose name or version", async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:"pdf",title:"DISC",documentType:"DISC",documentVersion:2}),{status:201}));
    vi.stubGlobal("fetch",fetcher);
    const file=new File(["%PDF-1.4"],"original-name.pdf",{type:"application/pdf"});
    const saved=await uploadDiscPdf("org a","program/a","person/a",file);
    expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8082/api/v1/organizations/org%20a/programs/program%2Fa/disc-profiles/person%2Fa/pdf");
    expect(fetcher.mock.calls[0][1].headers).toEqual({Authorization:"Bearer disc-token"});
    expect(fetcher.mock.calls[0][1].body.get("file")).toBe(file);
    expect(fetcher.mock.calls[0][1].body.has("version")).toBe(false);
    expect(fetcher.mock.calls[0][1].body.has("name")).toBe(false);
    expect(saved.documentVersion).toBe(2);
  });

  it("loads the personal DISC from the authenticated subject without a selected enrollment",async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({profile:null}),{status:200}));vi.stubGlobal("fetch",fetcher);
    await getMyDiscProfile("program/a");
    expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8082/api/v1/me/programs/program%2Fa/disc-profile");
    expect(fetcher.mock.calls[0][1]).toMatchObject({method:"GET",cache:"no-store",headers:{Authorization:"Bearer disc-token"}});
    expect(fetcher.mock.calls[0][1].body).toBeUndefined();
  });

});
