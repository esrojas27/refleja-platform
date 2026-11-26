"use client";
import {useEffect,useState} from "react";
import {getMyDiscProfile,discErrorMessage,type DiscProfile} from "@/lib/participation/disc-api";
import {DiscRadar} from "@/components/programs/disc-radar";
import {DiscPdfVersions} from "@/components/programs/disc-pdf-versions";
export function MyDiscArea({programId}:{programId:string}){
  return <MyDiscContent key={programId} programId={programId}/>;
}
function MyDiscContent({programId}:{programId:string}){
  const [profile,setProfile]=useState<DiscProfile|null>(),[message,setMessage]=useState("Cargando tu ficha DISC…");
  const [loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    getMyDiscProfile(programId,controller.signal).then(data=>{
      if(!controller.signal.aborted){
        const complete=data.profile&&!data.profile.needsUpdate&&[data.profile.dominant,data.profile.influential,data.profile.serene,data.profile.conscientious].every(v=>v!==null);
        setProfile(complete?data.profile:null);setMessage(complete?"":"Tu ficha DISC estará disponible cuando el consultor registre los cuatro porcentajes.");
      }
    }).catch(error=>{if(!controller.signal.aborted){setProfile(null);setMessage(discErrorMessage(error));}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[programId,attempt]);
  useEffect(()=>{
    const reload=()=>{setProfile(undefined);setLoading(true);setMessage("Cargando tu ficha DISC…");setAttempt(v=>v+1);};
    const visible=()=>{if(document.visibilityState==="visible")reload();};
    window.addEventListener("focus",reload);document.addEventListener("visibilitychange",visible);
    return()=>{window.removeEventListener("focus",reload);document.removeEventListener("visibilitychange",visible);};
  },[]);
  function refresh(){setProfile(undefined);setLoading(true);setMessage("Cargando tu ficha DISC…");setAttempt(v=>v+1);}
  return <section className="rti-surface min-w-0 p-6 sm:p-9">
    <p className="rti-kicker">Tu participación</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Mi DISC</h1>
    <p className="mt-3 max-w-3xl text-muted-foreground">Consulta los porcentajes de tu ficha DISC y las versiones de tu informe compartidas por el consultor para este programa.</p>
    {message&&<p role="status" className="mt-5 rounded-xl bg-muted p-3 text-sm">{message}</p>}
    {profile&&<>
      <div className="mx-auto mt-6 max-w-xl"><DiscRadar values={{dominant:profile.dominant,influential:profile.influential,serene:profile.serene,conscientious:profile.conscientious}}/></div>
      <DiscPdfVersions programId={programId} canEdit={false} personal/>
    </>}
    <button type="button" className="rti-button-secondary mt-5" disabled={loading} onClick={refresh}>Actualizar mi DISC</button>
  </section>;
}
