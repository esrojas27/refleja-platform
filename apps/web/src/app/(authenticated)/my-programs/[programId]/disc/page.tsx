import {MyDiscArea} from "@/components/participation/my-disc-area";
export default async function Page({params}:{params:Promise<{programId:string}>}){
  const {programId}=await params;
  return <MyDiscArea programId={programId}/>;
}
