import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { changeEnrollment, getEnrollmentHistory, enrollmentAdministrationMessage, EnrollmentAdministrationError } from "@/lib/participation/enrollment-administration-api";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8081/");
  vi.mocked(fetchAuthSession).mockResolvedValue({ tokens: { accessToken: { toString: () => "access" } } } as never);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });

it("scopes and versions role changes and serializes only explicit fields", async () => {
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:"e"}),{status:200}));vi.stubGlobal("fetch",fetcher);
  await changeEnrollment("org a","program/a","e/a",{version:2,action:"CHANGE_ROLE",reason:"Responsable",confirmed:true,role:"LEADER",roleVersion:3});
  expect(fetcher).toHaveBeenCalledWith("http://localhost:8081/api/v1/organizations/org%20a/programs/program%2Fa/enrollments/e%2Fa/administration",
    expect.objectContaining({method:"POST",cache:"no-store",headers:{Authorization:"Bearer access","Content-Type":"application/json"},
      body:JSON.stringify({version:2,action:"CHANGE_ROLE",reason:"Responsable",confirmed:true,role:"LEADER",roleVersion:3})}));
});
it("never sends role data in a withdrawal and paginates history without caching", async () => {
  const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(new Response("{}",{status:200})));vi.stubGlobal("fetch",fetcher);
  await changeEnrollment("o","p","e",{version:1,action:"WITHDRAW",reason:"Retiro",confirmed:true,role:"LEADER",roleVersion:0});
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({version:1,action:"WITHDRAW",reason:"Retiro",confirmed:true});
  await getEnrollmentHistory("o","p","e",2);
  expect(fetcher.mock.calls[1][0]).toMatch(/enrollments\/e\/history\?page=2&size=20$/);
  expect(fetcher.mock.calls[1][1]).toMatchObject({method:"GET",cache:"no-store"});
});
it("does not contact the API without an access token or after cancellation",async()=>{
  const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);vi.mocked(fetchAuthSession).mockResolvedValue({} as never);
  await expect(getEnrollmentHistory("o","p","e")).rejects.toMatchObject({status:401});
  const controller=new AbortController();controller.abort();
  await expect(getEnrollmentHistory("o","p","e",0,controller.signal)).rejects.toMatchObject({name:"AbortError"});
  expect(fetcher).not.toHaveBeenCalled();
});
it("preserves conflict codes but never renders untrusted server messages",async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({code:"MEMBERSHIP_VERSION_CONFLICT",message:"private detail",requestId:"unsafe"}),{status:409}));vi.stubGlobal("fetch",fetcher);
  await expect(getEnrollmentHistory("o","p","e")).rejects.toMatchObject({code:"MEMBERSHIP_VERSION_CONFLICT",requestId:undefined});
  expect(enrollmentAdministrationMessage(new EnrollmentAdministrationError(409,"MEMBERSHIP_VERSION_CONFLICT"))).toMatch(/otra vista o programa/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
