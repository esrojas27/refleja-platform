import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {fetchAuthSession} from "aws-amplify/auth";
import {listParticipantFiles,uploadParticipantFile,deleteParticipantFile,fetchParticipantFile,listFileParticipants,
  participantFilesPath,participantFileError,ParticipantFileError} from "@/lib/participation/participant-files-api";
vi.mock("aws-amplify/auth",()=>({fetchAuthSession:vi.fn()}));
beforeEach(()=>{
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL","http://localhost:8082/");
  vi.mocked(fetchAuthSession).mockResolvedValue({tokens:{accessToken:{toString:()=>"file-token"}}} as never);
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.clearAllMocks();});
it("uses scoped authenticated URLs and multipart without setting a manual Content-Type",async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({items:[]}),{status:200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({id:"f"}),{status:201}))
    .mockResolvedValueOnce(new Response(null,{status:204}));
  vi.stubGlobal("fetch",fetcher);
  const scope={organizationId:"org a",programId:"program/a",enrollmentId:"person/a"};
  await listParticipantFiles(scope);await uploadParticipantFile(scope," Nombre ",new File(["pdf"],"document.pdf",{type:"application/pdf"}));
  await deleteParticipantFile(scope,"file/a");
  const path="http://localhost:8082/api/v1/organizations/org%20a/programs/program%2Fa/enrollments/person%2Fa/files";
  expect(fetcher.mock.calls[0][0]).toBe(path);
  expect(fetcher.mock.calls[1][1].headers).toEqual({Authorization:"Bearer file-token"});
  expect(fetcher.mock.calls[1][1].body.get("name")).toBe("Nombre");
  expect(fetcher.mock.calls[1][1].body.get("file").name).toBe("document.pdf");
  expect(fetcher.mock.calls[2][0]).toBe(path+"/file%2Fa");
  expect(fetcher.mock.calls[2][1].method).toBe("DELETE");
  expect(fetchAuthSession).toHaveBeenCalledTimes(3);
});
it("resolves own files without client chosen participant IDs and downloads through authentication",async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response("pdf bytes",{status:200,headers:{"Content-Type":"application/pdf"}}));
  vi.stubGlobal("fetch",fetcher);
  const blob=await fetchParticipantFile({programId:"program/a"},"file/a",undefined,true);
  expect(blob.type).toBe("application/pdf");
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8082/api/v1/me/programs/program%2Fa/files/file%2Fa/content?download=true");
  expect(fetcher.mock.calls[0][1].cache).toBe("no-store");
  expect(participantFilesPath({programId:"p"})).toBe("/me/programs/p/files");
});
it("refuses missing tokens and cancelled operations without contacting the backend",async()=>{
  vi.mocked(fetchAuthSession).mockResolvedValue({} as never);const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
  await expect(listParticipantFiles({programId:"p"})).rejects.toMatchObject({status:401});
  const controller=new AbortController();controller.abort();
  await expect(listParticipantFiles({programId:"p"},controller.signal)).rejects.toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
});
it("maps file limits, unavailable access and oversized uploads to actionable messages",async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({code:"FILE_LIMIT_REACHED"}),{status:409}));vi.stubGlobal("fetch",fetcher);
  await expect(uploadParticipantFile({programId:"p",organizationId:"o",enrollmentId:"e"},"N",new File(["x"],"x.pdf"))).rejects.toMatchObject({code:"FILE_LIMIT_REACHED"});
  expect(participantFileError(new ParticipantFileError(409,"FILE_LIMIT_REACHED"))).toContain("10 archivos");
  expect(participantFileError(new ParticipantFileError(413))).toContain("10 MB");
  expect(participantFileError(new ParticipantFileError(403))).toContain("permiso");
});
it("lists management participants using pagination and rejects unexpected binary response types",async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({items:[]}),{status:200}))
    .mockResolvedValueOnce(new Response("<html>",{status:200,headers:{"Content-Type":"text/html"}}));vi.stubGlobal("fetch",fetcher);
  await listFileParticipants("o","p",1);
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8082/api/v1/organizations/o/programs/p/files/participants?page=1&size=20");
  await expect(fetchParticipantFile({programId:"p"},"f")).rejects.toBeInstanceOf(ParticipantFileError);
});
