import { appendFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
const pause = ms => new Promise(r => setTimeout(r, ms));
export function summarize(samples) {
  const times = samples.map(s=>s.ms).sort((a,b)=>a-b);
  const pct = p => times.length ? Math.round(times[Math.max(0,Math.ceil(times.length*p)-1)]) : null;
  return {requests:samples.length,errors:samples.filter(s=>!s.ok).length,p50:pct(.5),p95:pct(.95),p99:pct(.99),max:times.length?Math.round(times.at(-1)):null};
}
export async function runLoad({state,dir,base,ssm,smoke}) {
  const controller=new AbortController(), results=[], resources=[];
  let active=true, abortReason=null, samples=[], phaseName='preflight';
  const stop=reason=>{if(!abortReason){abortReason=reason;console.log(`STOP: ${reason}`);controller.abort();}};
  process.once('SIGINT',()=>stop('Operator interruption'));
  async function request(user,name,path,body,validate) {
    if(controller.signal.aborted)return null;
    const start=performance.now();let status=0,ok=false,value=null;
    try {
      const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${user.token}`,...(name==='web-shell'?{Cookie:user.cookieHeader}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
      status=response.status;const text=await response.text();
      value=response.headers.get('content-type')?.includes('application/json')?JSON.parse(text):text;
      ok=response.ok&&(!validate||validate(value));
    }catch{/* Never log credentials or response bodies. */}
    samples.push({name,status,ok,ms:performance.now()-start});
    if(!ok)console.log(`Request failed: ${phaseName} ${name} HTTP ${status}`);
    if(samples.length>=50&&samples.slice(-50).filter(s=>!s.ok).length>=5)stop('At least 10% errors in last 50 requests');
    return ok?value:null;
  }
  async function monitor() {
    const output=await ssm(['set -euo pipefail',
      "awk '/MemAvailable/ {print \"MEM_KIB \" $2}' /proc/meminfo",
      "df -PB1 /srv/refleja | awk 'NR==2 {print \"DISK_FREE \" $4}'",
      "docker stats --no-stream --format '{{json .}}'",
      "docker ps -q --filter label=com.docker.compose.project=refleja-tu-interior-dev | xargs docker inspect --format 'HEALTH {{.Name}} {{.State.Health.Status}} {{.State.OOMKilled}} {{.RestartCount}}'"]);
    const lines=output.trim().split('\n');
    const memory=Number(lines.find(l=>l.startsWith('MEM_KIB '))?.split(' ')[1]);
    const point={at:new Date().toISOString(),phase:phaseName,memoryKiB:memory,lines};resources.push(point);
    await appendFile(join(dir,'resources.jsonl'),JSON.stringify(point)+'\n');
    if(!memory||memory<160*1024)stop('Less than 160 MiB available host memory or missing metric');
    if(lines.filter(l=>l.startsWith('HEALTH ')).some(l=>!l.includes(' healthy false ')))stop('Container unhealthy or OOM');
    console.log(`Resource sample: ${phaseName}; host available ${Math.round(memory/1024)} MiB.`);
  }
  await monitor();
  const monitorLoop=(async()=>{
    while(active&&!controller.signal.aborted){
      for(let n=0;n<30&&active&&!controller.signal.aborted;n++)await pause(1000);
      if(!active||controller.signal.aborted)break;
      try{
        try{await access(join(dir,'STOP'));stop('Operator STOP file');break;}catch{}
        await monitor();
      }catch{stop('Infrastructure monitoring unavailable');}
    }
  })();
  const activityPath=`/api/v1/me/programs/${state.programId}/activities`;
  const consultantPath=`/api/v1/organizations/${state.organizationId}/programs/${state.programId}`;
  const stages=smoke?[{users:1,seconds:15,block:0,write:false}]:[
    {users:5,seconds:180,block:0,write:true},{users:15,seconds:300,block:4,write:true},{users:30,seconds:600,block:8,write:true}];
  try{
    for(const user of state.users){
      const response=await request(user,'preflight-activities',activityPath,null,x=>x.items?.length===12&&x.items.every(a=>a.programId===state.programId&&a.organizationId===state.organizationId));
      if(!response)throw new Error('Authenticated fixture preflight failed');
    }
    for(const stage of stages){
      if(controller.signal.aborted)break;
      phaseName=`${stage.users}-users`;samples=[];
      const begun=Date.now(),end=begun+stage.seconds*1000;
      console.log(`Starting ${phaseName} for ${stage.seconds}s.`);
      await Promise.all(state.users.slice(0,stage.users).map(async(user,index)=>{
        await pause(index*50);let cycle=0,writes=0;
        while(Date.now()<end&&!controller.signal.aborted){
          const reads=[['account','/api/v1/me'],['program-list','/api/v1/me/programs'],['program-detail',`/api/v1/me/programs/${state.programId}`],['activities',activityPath]];
          for(const[name,path]of reads){
            if(controller.signal.aborted||Date.now()>=end)break;
            await request(user,name,path);await pause(1500+Math.random()*1000);
          }
          if(stage.write&&writes<4&&Date.now()-begun>=10000+writes*60000&&!controller.signal.aborted){
            const activity=state.activities[stage.block+writes];
            const submitted=await request(user,'submit-activity',`${activityPath}/${activity.id}/submission`,{responseText:`Respuesta sintetica ${state.runId}, usuario ${index}, actividad ${writes}.`},x=>x.assignmentStatus==='SUBMITTED');
            if(submitted){
              const answers=activity.questions.map(question=>({questionId:question.id,values:question.type==='OPEN_TEXT'?['Reflexion sintetica para medir capacidad.']:question.type==='EMOTION_MULTI_SELECT'?['Inspirado(a)','Motivado(a)']:['4']}));
              if(!await request(user,'submit-survey',`${activityPath}/${activity.id}/survey-response`,{answers}))stop('Survey submission failed');
            }else stop('Activity submission failed');
            writes++;
          }
          if(index===0&&cycle%3===0&&!controller.signal.aborted){
            await request(user,'consultant-results',`${consultantPath}/survey-results`);
            await request(user,'consultant-activities',`${consultantPath}/activities`);
          }
          if(cycle%5===0&&!controller.signal.aborted)await request(user,'web-shell',`/my-programs/${state.programId}/activities`);
          cycle++;
        }
      }));
      const endpoints=Object.fromEntries([...new Set(samples.map(s=>s.name))].map(name=>[name,summarize(samples.filter(s=>s.name===name))]));
      const summary={...stage,startedAt:new Date(begun).toISOString(),elapsedSeconds:Math.round((Date.now()-begun)/1000),...summarize(samples),endpoints,aborted:abortReason};results.push(summary);
      await writeFile(join(dir,smoke?'smoke.json':'results.json'),JSON.stringify({runId:state.runId,results,abortReason},null,2));
      console.log(JSON.stringify(summary));
      if(summary.errors||summary.p95>2000){stop('Stage acceptance failed: errors or aggregate p95 > 2 seconds');break;}
      if(!smoke&&stage.users<30)await pause(15000);
    }
  }finally{
    active=false;await monitorLoop;
    await writeFile(join(dir,smoke?'smoke-resources.json':'resources.json'),JSON.stringify(resources,null,2));
  }
  if(abortReason)throw new Error(abortReason);
}
