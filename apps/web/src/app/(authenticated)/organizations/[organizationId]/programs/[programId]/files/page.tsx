import { ProgramFilesArea } from "@/components/programs/program-files-area";
export default async function Page({params}:{params:Promise<{organizationId:string;programId:string}>}){
  const {organizationId,programId}=await params;
  return <ProgramFilesArea organizationId={organizationId} programId={programId}/>;
}
