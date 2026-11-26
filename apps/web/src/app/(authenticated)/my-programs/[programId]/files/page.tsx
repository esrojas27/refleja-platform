import { MyParticipantFiles } from "@/components/participation/participant-files";
export default async function Page({params}:{params:Promise<{programId:string}>}){
  const {programId}=await params;
  return <MyParticipantFiles programId={programId}/>;
}
