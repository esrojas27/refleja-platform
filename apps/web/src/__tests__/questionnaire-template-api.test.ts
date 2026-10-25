import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { createQuestionnaireTemplate,getQuestionnaireTemplate,listQuestionnaireTemplates,QuestionnaireTemplateError,questionnaireTemplateError } from "@/lib/forms/questionnaire-template-api";
vi.mock("aws-amplify/auth",()=>({fetchAuthSession:vi.fn()}));
beforeEach(()=>{vi.stubEnv("NEXT_PUBLIC_API_BASE_URL","http://localhost:8082/");vi.mocked(fetchAuthSession).mockResolvedValue({tokens:{accessToken:{toString:()=>"access-token"}}} as never);});
afterEach(()=>{vi.resetAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
it("uses organization-authorized global catalog paths and bounded pagination",async()=>{
 const fetcher=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({items:[]}),{status:200}));vi.stubGlobal("fetch",fetcher);
 await listQuestionnaireTemplates("org/a",2);await getQuestionnaireTemplate("org/a","template a");
 expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8082/api/v1/organizations/org%2Fa/questionnaire-templates?page=2&size=20");
 expect(fetcher.mock.calls[1][0]).toBe("http://localhost:8082/api/v1/organizations/org%2Fa/questionnaire-templates/template%20a");
 expect(fetcher.mock.calls[0][1]).toMatchObject({method:"GET",cache:"no-store",headers:{Authorization:"Bearer access-token"}});
});
it("sends only the persisted source reference and template metadata, never client snapshots or answers",async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response("{}",{status:201}));vi.stubGlobal("fetch",fetcher);
 await createQuestionnaireTemplate("org",{sourceProgramId:"program",sourceEvaluationId:"source",name:" Plantilla ",description:" ",
   snapshot:{secret:"unexpected"},answers:["private"]} as Parameters<typeof createQuestionnaireTemplate>[1]);
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({sourceProgramId:"program",sourceEvaluationId:"source",name:"Plantilla",description:null});
});
it("does not call the backend without an access token",async()=>{
 vi.mocked(fetchAuthSession).mockResolvedValue({} as never);const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
 await expect(listQuestionnaireTemplates("org")).rejects.toMatchObject({status:401});expect(fetcher).not.toHaveBeenCalled();
});
it("keeps only safe error fields, codes and request IDs",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({code:"VALIDATION_ERROR",message:"sensitive SQL",errors:[{field:"name"},{field:"secret"}],requestId:"01900000-0000-7000-8000-000000000001"}),{status:400})));
 await expect(listQuestionnaireTemplates("org")).rejects.toMatchObject({status:400,fields:["name"],requestId:"01900000-0000-7000-8000-000000000001"});
 expect(questionnaireTemplateError(new QuestionnaireTemplateError(409,[],"QUESTIONNAIRE_TEMPLATE_NAME_EXISTS"))).toContain("Usa otro nombre");
 expect(questionnaireTemplateError(new QuestionnaireTemplateError(500))).not.toContain("sensitive SQL");
});
