import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {MyDiscArea} from "@/components/participation/my-disc-area";
import {getMyDiscProfile,DiscRequestError,saveProgramDiscProfile,uploadDiscPdf} from "@/lib/participation/disc-api";
import {listParticipantFiles,fetchParticipantFile} from "@/lib/participation/participant-files-api";
vi.mock("@/lib/participation/disc-api",async original=>({...await original<typeof import("@/lib/participation/disc-api")>(),getMyDiscProfile:vi.fn(),saveProgramDiscProfile:vi.fn(),uploadDiscPdf:vi.fn()}));
vi.mock("@/lib/participation/participant-files-api",async original=>({...await original<typeof import("@/lib/participation/participant-files-api")>(),listParticipantFiles:vi.fn(),fetchParticipantFile:vi.fn()}));
const profile={id:"mine",dominant:80,influential:65,serene:30,conscientious:45,version:0,updatedAt:"2026-11-26T12:00:00Z",needsUpdate:false};
const pdf={id:"pdf1",title:"DISC",documentType:"DISC" as const,documentVersion:1,contentType:"application/pdf",sizeBytes:1000,createdAt:"2026-11-26T12:00:00Z"};
beforeEach(()=>{
 vi.mocked(getMyDiscProfile).mockResolvedValue({profile});
 vi.mocked(listParticipantFiles).mockResolvedValue({items:[pdf,{...pdf,id:"pdf2",documentVersion:2},{...pdf,id:"other",title:"Otro documento",documentType:null,documentVersion:null}],canManage:true,maxFileBytes:10485760,maxFiles:10});
 vi.mocked(fetchParticipantFile).mockResolvedValue(new Blob(["pdf"],{type:"application/pdf"}));
 const NativeURL=URL;vi.stubGlobal("URL",class extends NativeURL{static createObjectURL=vi.fn(()=>"blob:my-disc");static revokeObjectURL=vi.fn();});
});
afterEach(()=>{cleanup();vi.resetAllMocks();vi.unstubAllGlobals();});
it("shows the collaborator's radar and only its DISC PDF versions without any editing controls",async()=>{
 render(<MyDiscArea programId="program"/>);
 expect(await screen.findByRole("img",{name:"Perfil DISC · Gráfico de radar"})).toBeTruthy();
 expect(await screen.findByText("Versión 2")).toBeTruthy();expect(screen.getByText("Versión 1")).toBeTruthy();
 expect(screen.queryByText("Otro documento")).toBeNull();
 expect(screen.queryByRole("form")).toBeNull();expect(screen.queryByRole("spinbutton")).toBeNull();
 expect(screen.queryByRole("button",{name:/^Eliminar/})).toBeNull();
 expect(listParticipantFiles).toHaveBeenCalledWith({programId:"program"},expect.any(AbortSignal));
 expect(saveProgramDiscProfile).not.toHaveBeenCalled();expect(uploadDiscPdf).not.toHaveBeenCalled();
});
it("loads the PDF through the personal file endpoint without a chosen participant or organization",async()=>{
 render(<MyDiscArea programId="program"/>);
 fireEvent.click(await screen.findByRole("button",{name:"Ver DISC versión 1"}));
 expect(await screen.findByRole("link",{name:"Abrir PDF en otra pestaña"})).toBeTruthy();
 expect(fetchParticipantFile).toHaveBeenCalledWith({programId:"program"},"pdf1",expect.any(AbortSignal),false);
});
it("treats four zero values as a complete, available radar",async()=>{
 vi.mocked(getMyDiscProfile).mockResolvedValue({profile:{...profile,dominant:0,influential:0,serene:0,conscientious:0}});
 render(<MyDiscArea programId="program"/>);
 expect(await screen.findByTestId("disc-radar-profile")).toBeTruthy();
 expect(screen.getByTestId("disc-radar-profile").getAttribute("points")).toBe("230,230 230,230 230,230 230,230");
});
it.each([null,{...profile,dominant:null},{...profile,needsUpdate:true}])("does not show a pending or legacy profile nor fetch its files",async value=>{
 vi.mocked(getMyDiscProfile).mockResolvedValue({profile:value});
 render(<MyDiscArea programId="program"/>);
 expect(await screen.findByText(/Tu ficha DISC estará disponible/)).toBeTruthy();
 expect(screen.queryByRole("img")).toBeNull();expect(listParticipantFiles).not.toHaveBeenCalled();
});
it("hides the personal radar and PDFs when access has been removed",async()=>{
 vi.mocked(getMyDiscProfile).mockRejectedValue(new DiscRequestError(404));
 render(<MyDiscArea programId="program"/>);
 expect(await screen.findByText(/El programa o el colaborador ya no está disponible/)).toBeTruthy();
 expect(screen.queryByRole("img")).toBeNull();expect(listParticipantFiles).not.toHaveBeenCalled();
});
it("refreshes availability on focus without keeping the previous radar after access changes",async()=>{
 render(<MyDiscArea programId="program"/>);
 await screen.findByRole("img",{name:"Perfil DISC · Gráfico de radar"});
 vi.mocked(getMyDiscProfile).mockResolvedValue({profile:null});
 fireEvent.focus(window);
 await screen.findByText(/Tu ficha DISC estará disponible/);
 expect(screen.queryByRole("img")).toBeNull();
});
it("does not retain another program's DISC while the new program is loading",async()=>{
 const view=render(<MyDiscArea programId="first"/>);
 await screen.findByRole("img",{name:"Perfil DISC · Gráfico de radar"});
 vi.mocked(getMyDiscProfile).mockReturnValue(new Promise(()=>{}));
 view.rerender(<MyDiscArea programId="second"/>);
 expect(screen.queryByRole("img")).toBeNull();
 await waitFor(()=>expect(getMyDiscProfile).toHaveBeenCalledWith("second",expect.any(AbortSignal)));
});
