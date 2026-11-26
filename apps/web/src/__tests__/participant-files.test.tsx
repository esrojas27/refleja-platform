import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {ParticipantFilesPanel,ParticipantFilesAction,MyParticipantFiles} from "@/components/participation/participant-files";
import {ProgramFilesArea} from "@/components/programs/program-files-area";
import {listParticipantFiles,uploadParticipantFile,deleteParticipantFile,fetchParticipantFile,listFileParticipants,
  ParticipantFileError,type ParticipantFile} from "@/lib/participation/participant-files-api";
vi.mock("@/lib/participation/participant-files-api",async original=>({
  ...await original<typeof import("@/lib/participation/participant-files-api")>(),
  listParticipantFiles:vi.fn(),uploadParticipantFile:vi.fn(),deleteParticipantFile:vi.fn(),fetchParticipantFile:vi.fn(),listFileParticipants:vi.fn(),
}));
const file:ParticipantFile={id:"f",title:"Mi DISC",contentType:"application/pdf",sizeBytes:1234,createdAt:"2026-11-25T12:00:00Z"};
const scope={organizationId:"o",programId:"p",enrollmentId:"e"};
beforeEach(()=>{
  vi.mocked(listParticipantFiles).mockResolvedValue({items:[file],canManage:true,maxFiles:10,maxFileBytes:10*1024*1024});
  vi.mocked(uploadParticipantFile).mockResolvedValue(file);
  vi.mocked(deleteParticipantFile).mockResolvedValue(undefined);
  vi.mocked(fetchParticipantFile).mockResolvedValue(new Blob(["pdf"],{type:"application/pdf"}));
  vi.mocked(listFileParticipants).mockResolvedValue({items:[{enrollmentId:"e",email:"person@example.test",firstName:"Paula",lastName:"Rojas",enrollmentStatus:"ACTIVE"}],page:0,size:20,totalElements:1,totalPages:1,canManage:false});
  const NativeURL=URL;vi.stubGlobal("URL",class extends NativeURL{static createObjectURL=vi.fn(()=>"blob:private-file");static revokeObjectURL=vi.fn();});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();vi.resetAllMocks();});
it("lets the consultant upload a named file and refreshes the list",async()=>{
  render(<ParticipantFilesPanel {...scope}/>);
  fireEvent.change(await screen.findByLabelText("Nombre del archivo"),{target:{value:"Resultado personal"}});
  const document=new File(["%PDF-1.7"],"report.pdf",{type:"application/pdf"});
  fireEvent.change(screen.getByLabelText("Archivo"),{target:{files:[document]}});
  fireEvent.submit(screen.getByRole("form",{name:"Cargar archivo"}));
  await waitFor(()=>expect(uploadParticipantFile).toHaveBeenCalledWith(scope,"Resultado personal",document,expect.any(AbortSignal)));
  expect(await screen.findByText(/Archivo cargado y disponible/)).toBeTruthy();
});
it("blocks missing, invalid and oversized uploads before sending",async()=>{
  render(<ParticipantFilesPanel {...scope}/>);
  const form=await screen.findByRole("form",{name:"Cargar archivo"});
  fireEvent.submit(form);expect(uploadParticipantFile).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Nombre del archivo"),{target:{value:"Nombre"}});
  fireEvent.change(screen.getByLabelText("Archivo"),{target:{files:[new File(["svg"],"x.svg",{type:"image/svg+xml"})]}});
  fireEvent.submit(form);expect(uploadParticipantFile).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Archivo"),{target:{files:[new File([new Uint8Array(10*1024*1024+1)],"x.pdf",{type:"application/pdf"})]}});
  fireEvent.submit(form);expect(uploadParticipantFile).not.toHaveBeenCalled();
});
it("requires confirmation before deleting and frees the visible slot after refresh",async()=>{
  vi.mocked(listParticipantFiles).mockResolvedValueOnce({items:[file],canManage:true,maxFiles:10,maxFileBytes:10*1024*1024})
    .mockResolvedValue({items:[],canManage:true,maxFiles:10,maxFileBytes:10*1024*1024});
  render(<ParticipantFilesPanel {...scope}/>);
  fireEvent.click(await screen.findByRole("button",{name:"Eliminar Mi DISC"}));expect(deleteParticipantFile).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Confirmar eliminación"}));
  await waitFor(()=>expect(deleteParticipantFile).toHaveBeenCalledWith(scope,"f",expect.any(AbortSignal)));
  expect(await screen.findByText(/0\/10 archivos/)).toBeTruthy();
});
it("shows only viewing and downloading for a collaborator, leader or HR",async()=>{
  vi.mocked(listParticipantFiles).mockResolvedValue({items:[file],canManage:false,maxFiles:10,maxFileBytes:10*1024*1024});
  render(<MyParticipantFiles programId="p"/>);
  expect(await screen.findByRole("button",{name:"Ver Mi DISC"})).toBeTruthy();
  expect(screen.getByRole("button",{name:"Descargar Mi DISC"})).toBeTruthy();
  expect(screen.queryByRole("form")).toBeNull();expect(screen.queryByRole("button",{name:"Eliminar Mi DISC"})).toBeNull();
});
it("enforces the ten-file limit in the upload controls",async()=>{
  vi.mocked(listParticipantFiles).mockResolvedValue({items:Array.from({length:10},(_,i)=>({...file,id:String(i),title:"Archivo "+i})),canManage:true,maxFiles:10,maxFileBytes:10*1024*1024});
  render(<ParticipantFilesPanel {...scope}/>);
  expect(await screen.findByText(/Se alcanzó el límite de 10 archivos/)).toBeTruthy();
  expect(screen.queryByLabelText("Archivo")).toBeNull();
});
it("opens the personal file manager from the person's action",async()=>{
  render(<ParticipantFilesAction {...scope} name="Paula"/>);
  fireEvent.click(screen.getByRole("button",{name:"Archivos"}));
  expect(screen.getByRole("dialog",{name:"Archivos de Paula"})).toBeTruthy();
  await waitFor(()=>expect(listParticipantFiles).toHaveBeenCalledWith(scope,expect.any(AbortSignal)));
});
it("loads an authenticated PDF preview with a separate new-tab link and revokes its URL on close",async()=>{
  render(<ParticipantFilesPanel {...scope}/>);
  fireEvent.click(await screen.findByRole("button",{name:"Ver Mi DISC"}));
  const link=await screen.findByRole("link",{name:"Abrir PDF en otra pestaña"});
  expect(link.getAttribute("target")).toBe("_blank");expect(link.getAttribute("rel")).toContain("noopener");
  expect(link.getAttribute("href")).toBe("blob:private-file");
  fireEvent.click(screen.getByRole("button",{name:"Cerrar vista previa"}));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-file");
});
it("does not show stale file names when switching program or participant",async()=>{
  const view=render(<ParticipantFilesPanel {...scope}/>);
  expect(await screen.findByText("Mi DISC")).toBeTruthy();
  vi.mocked(listParticipantFiles).mockReturnValue(new Promise(()=>{}));
  view.rerender(<ParticipantFilesPanel {...scope} enrollmentId="another-person"/>);
  expect(screen.queryByText("Mi DISC")).toBeNull();
  expect(screen.getByText("Cargando archivos…")).toBeTruthy();
});
it("blocks retrying an uncertain upload until the list is refreshed",async()=>{
  vi.mocked(uploadParticipantFile).mockRejectedValue(new ParticipantFileError(500));
  render(<ParticipantFilesPanel {...scope}/>);
  fireEvent.change(await screen.findByLabelText("Nombre del archivo"),{target:{value:"Informe"}});
  fireEvent.change(screen.getByLabelText("Archivo"),{target:{files:[new File(["pdf"],"x.pdf",{type:"application/pdf"})]}});
  fireEvent.submit(screen.getByRole("form",{name:"Cargar archivo"}));
  expect(await screen.findByText(/No se pudo confirmar el resultado/)).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>("button",{name:"Cargar archivo"}).disabled).toBe(true);
});
it("provides an authorized, paginated participant list for management viewers",async()=>{
  render(<ProgramFilesArea organizationId="o" programId="p"/>);
  fireEvent.click(await screen.findByRole("button",{name:"Archivos de Paula Rojas"}));
  expect(screen.getByRole("dialog",{name:"Archivos de Paula Rojas"})).toBeTruthy();
  expect(listFileParticipants).toHaveBeenCalledWith("o","p",0,expect.any(AbortSignal));
});
