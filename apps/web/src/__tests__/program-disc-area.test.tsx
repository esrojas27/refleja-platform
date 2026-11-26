import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {ProgramDiscArea} from "@/components/programs/program-disc-area";
import {DiscRadar} from "@/components/programs/disc-radar";
import {fetchCurrentIdentity,IdentityRequestError} from "@/lib/auth/authenticated-api";
import {listProgramDiscProfiles,saveProgramDiscProfile,uploadDiscPdf,type ProgramDiscParticipant} from "@/lib/participation/disc-api";
import {listParticipantFiles,type ParticipantFile} from "@/lib/participation/participant-files-api";
vi.mock("@/lib/auth/authenticated-api",async original=>({...await original<typeof import("@/lib/auth/authenticated-api")>(),fetchCurrentIdentity:vi.fn()}));
vi.mock("@/lib/participation/disc-api",async original=>({...await original<typeof import("@/lib/participation/disc-api")>(),listProgramDiscProfiles:vi.fn(),saveProgramDiscProfile:vi.fn(),uploadDiscPdf:vi.fn()}));
vi.mock("@/lib/participation/participant-files-api",async original=>({...await original<typeof import("@/lib/participation/participant-files-api")>(),listParticipantFiles:vi.fn()}));
const person:ProgramDiscParticipant={enrollmentId:"e",enrollmentStatus:"ACTIVE",email:"ana@example.test",firstName:"Ana",lastName:"Prueba",profile:null,canEdit:true};
const profile={id:"profile",dominant:80,influential:65,serene:30,conscientious:45,updatedAt:"2026-11-25T12:00:00Z",version:0,needsUpdate:false};
const identity={cognitoSubject:"s",user:{id:"user",email:"consultant@example.test",firstName:null,lastName:null},organizations:[],activeOrganizationId:"org",roles:["CONSULTANT"]};
const pdf:ParticipantFile={id:"pdf1",title:"DISC",documentType:"DISC",documentVersion:1,contentType:"application/pdf",sizeBytes:200,createdAt:"2026-11-25T12:00:00Z"};
beforeEach(()=>{
 vi.mocked(fetchCurrentIdentity).mockResolvedValue(identity);
 vi.mocked(listProgramDiscProfiles).mockResolvedValue({items:[person]});
 vi.mocked(saveProgramDiscProfile).mockResolvedValue({...person,profile});
 vi.mocked(listParticipantFiles).mockResolvedValue({items:[],canManage:true,maxFileBytes:10485760,maxFiles:10});
 vi.mocked(uploadDiscPdf).mockResolvedValue({...pdf,id:"pdf2",documentVersion:2});
});
afterEach(()=>{cleanup();vi.resetAllMocks();});
async function open(){render(<ProgramDiscArea organizationId="org" programId="program"/>);fireEvent.click(await screen.findByRole("button",{name:"Completar pendientes (1)"}));return screen.getByRole("form",{name:"Ficha DISC de Ana Prueba"});}
function fill(form:HTMLElement,values=["80","65","30","45"]){["Dominante","Influyente","Sereno","Concienzudo"].forEach((label,i)=>fireEvent.change(within(form).getByLabelText(new RegExp(label)),{target:{value:values[i]}}));}

it("plots the four independent values on the expected radar axes",()=>{
 render(<DiscRadar values={{dominant:80,influential:65,serene:30,conscientious:45}}/>);
 expect(screen.getByRole("img",{name:"Perfil DISC · Gráfico de radar"})).toBeTruthy();
 expect(screen.getByTestId("disc-radar-profile").getAttribute("points")).toBe("230,122 317.75,230 230,270.5 169.25,230");
});
it("keeps zero at the center, 100 at the outer ring and does not draw a polygon for missing values",()=>{
 const view=render(<DiscRadar values={{dominant:0,influential:100,serene:100,conscientious:100}}/>);
 expect(screen.getByTestId("disc-radar-profile").getAttribute("points")).toBe("230,230 365,230 230,365 95,230");
 view.rerender(<DiscRadar values={{dominant:null,influential:100,serene:100,conscientious:100}}/>);
 expect(screen.queryByTestId("disc-radar-profile")).toBeNull();
});
it("updates the preview live and saves four independent numeric percentages",async()=>{
 const form=await open();fill(form);
 expect(screen.getByTestId("disc-radar-profile").getAttribute("points")).toBe("230,122 317.75,230 230,270.5 169.25,230");
 fireEvent.submit(form);
 await waitFor(()=>expect(saveProgramDiscProfile).toHaveBeenCalledWith("org","program","e",{dominant:80,influential:65,serene:30,conscientious:45,version:null},expect.any(AbortSignal)));
 expect(await screen.findByText("Ficha DISC de Ana Prueba guardada.")).toBeTruthy();
});
it("accepts zero and blocks decimals, missing and out of range fields",async()=>{
 const form=await open();fill(form,["0","100","100","100"]);fireEvent.submit(form);
 await waitFor(()=>expect(saveProgramDiscProfile).toHaveBeenCalledWith("org","program","e",expect.objectContaining({dominant:0,influential:100,serene:100,conscientious:100}),expect.any(AbortSignal)));
 cleanup();vi.mocked(saveProgramDiscProfile).mockClear();
 const invalid=await open();fill(invalid,["80.5","101","-1",""]);fireEvent.submit(invalid);
 expect(saveProgramDiscProfile).not.toHaveBeenCalled();
 expect(screen.getByText("Ingresa los cuatro porcentajes como números enteros entre 0 y 100.")).toBeTruthy();
});
it.each(["LEADER","COMPANY_ADMIN"])("allows %s to consult a radar and PDF versions without edit controls",async role=>{
 vi.mocked(fetchCurrentIdentity).mockResolvedValue({...identity,roles:[role]});
 vi.mocked(listProgramDiscProfiles).mockResolvedValue({items:[{...person,profile,canEdit:false}]});
 vi.mocked(listParticipantFiles).mockResolvedValue({items:[pdf],canManage:false,maxFileBytes:10485760,maxFiles:10});
 render(<ProgramDiscArea organizationId="org" programId="program"/>);
 fireEvent.click(await screen.findByRole("button",{name:"Consultar ficha de Ana Prueba"}));
 expect(screen.getByRole("img",{name:"Perfil DISC · Gráfico de radar"})).toBeTruthy();
 expect(await screen.findByText("Versión 1")).toBeTruthy();
 expect(screen.queryByRole("form")).toBeNull();
 expect(screen.queryByRole("button",{name:/^Eliminar/})).toBeNull();
});
it("does not request private DISC for a collaborator",async()=>{
 vi.mocked(fetchCurrentIdentity).mockResolvedValue({...identity,roles:["COLLABORATOR"]});
 render(<ProgramDiscArea organizationId="org" programId="program"/>);
 expect(await screen.findByText(/Solo consultores, líderes y RRHH autorizados/)).toBeTruthy();
 expect(listProgramDiscProfiles).not.toHaveBeenCalled();
});
it("reports an expired session before fetching DISC data",async()=>{
 vi.mocked(fetchCurrentIdentity).mockRejectedValue(new IdentityRequestError(401));
 render(<ProgramDiscArea organizationId="org" programId="program"/>);
 expect(await screen.findByText(/Tu sesión no está disponible/)).toBeTruthy();
 expect(listProgramDiscProfiles).not.toHaveBeenCalled();
 expect(screen.getByRole("link",{name:"Volver a Cuenta"}).getAttribute("href")).toBe("/account");
 expect(screen.getByRole("link",{name:"Volver al programa"}).getAttribute("href")).toBe("/organizations/org/programs/program");
});
it("does not invent numbers for a qualitative legacy profile",async()=>{
 vi.mocked(listProgramDiscProfiles).mockResolvedValue({items:[{...person,profile:{...profile,dominant:null,influential:null,serene:null,conscientious:null,needsUpdate:true,version:3}}]});
 await open();
 expect(screen.getByText(/Esta ficha fue registrada como texto/)).toBeTruthy();
 expect(screen.queryByTestId("disc-radar-profile")).toBeNull();
 expect(screen.getByLabelText<HTMLInputElement>(/Dominante/).value).toBe("");
});
it("uploads a PDF as another DISC version without submitting percentages or losing the previous PDF",async()=>{
 vi.mocked(listParticipantFiles).mockResolvedValueOnce({items:[pdf],canManage:true,maxFileBytes:10485760,maxFiles:10})
  .mockResolvedValue({items:[pdf,{...pdf,id:"pdf2",documentVersion:2}],canManage:true,maxFileBytes:10485760,maxFiles:10});
 await open();
 expect(await screen.findByText("Versión 1")).toBeTruthy();
 const file=new File(["%PDF-1.4\n%%EOF"],"disc.pdf",{type:"application/pdf"});
 fireEvent.change(screen.getByLabelText("Nuevo PDF DISC"),{target:{files:[file]}});
 fireEvent.submit(screen.getByRole("form",{name:"Cargar PDF DISC"}));
 await waitFor(()=>expect(uploadDiscPdf).toHaveBeenCalledWith("org","program","e",file,expect.any(AbortSignal)));
 expect(await screen.findByText("Versión 2")).toBeTruthy();expect(screen.getByText("Versión 1")).toBeTruthy();
 expect(saveProgramDiscProfile).not.toHaveBeenCalled();
});
it("lets the consultant save percentages and upload DISC while the invitation remains pending",async()=>{
 vi.mocked(listProgramDiscProfiles).mockResolvedValue({items:[{...person,enrollmentStatus:"INVITED"}]});
 vi.mocked(saveProgramDiscProfile).mockResolvedValue({...person,enrollmentStatus:"INVITED",profile});
 vi.mocked(listParticipantFiles).mockResolvedValueOnce({items:[],canManage:true,maxFileBytes:10485760,maxFiles:10})
  .mockResolvedValue({items:[pdf],canManage:true,maxFileBytes:10485760,maxFiles:10});
 const form=await open();
 expect(screen.getByText(/La ficha y los PDF quedan guardados/)).toBeTruthy();
 fill(form);fireEvent.submit(form);
 expect(await screen.findByText("Ficha DISC de Ana Prueba guardada.")).toBeTruthy();
 expect(screen.getByText("Invitación pendiente de aceptación")).toBeTruthy();
 const file=new File(["%PDF-1.4\n%%EOF"],"disc.pdf",{type:"application/pdf"});
 fireEvent.change(await screen.findByLabelText("Nuevo PDF DISC"),{target:{files:[file]}});
 fireEvent.submit(screen.getByRole("form",{name:"Cargar PDF DISC"}));
 await waitFor(()=>expect(uploadDiscPdf).toHaveBeenCalledWith("org","program","e",file,expect.any(AbortSignal)));
 expect(await screen.findByText("Versión 1")).toBeTruthy();
 expect(screen.queryByText("Inscripción activa")).toBeNull();
});
it("rejects other upload types and respects the shared ten-file quota",async()=>{
 await open();await screen.findByLabelText("Nuevo PDF DISC");
 fireEvent.change(screen.getByLabelText("Nuevo PDF DISC"),{target:{files:[new File(["png"],"image.png",{type:"image/png"})]}});
 fireEvent.submit(screen.getByRole("form",{name:"Cargar PDF DISC"}));expect(uploadDiscPdf).not.toHaveBeenCalled();
 cleanup();vi.mocked(listParticipantFiles).mockResolvedValue({items:Array.from({length:10},(_,i)=>({...pdf,id:String(i),documentVersion:i+1})),canManage:true,maxFileBytes:10485760,maxFiles:10});
 await open();
 expect((await screen.findByRole<HTMLButtonElement>("button",{name:"Cargar nueva versión"})).disabled).toBe(true);
});
