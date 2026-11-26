"use client";
import { useId } from "react";
export const DISC_FIELDS = [
  {key:"dominant",code:"D",label:"Dominante",color:"#b43b60"},
  {key:"influential",code:"I",label:"Influyente",color:"#a66b08"},
  {key:"serene",code:"S",label:"Sereno",color:"#287954"},
  {key:"conscientious",code:"C",label:"Concienzudo",color:"#3664ac"},
] as const;
export type DiscValues = Record<(typeof DISC_FIELDS)[number]["key"],number|null>;
export function DiscRadar({values}:{values:DiscValues}){
  const titleId=useId(),descriptionId=useId();
  const center=230,radius=135;
  const coordinates=(value:number,index:number)=>{
    const r=radius*value/100;
    return [[center,center-r],[center+r,center],[center,center+r],[center-r,center]][index];
  };
  const isValid=(value:number|null):value is number=>value!==null && Number.isInteger(value) && value>=0 && value<=100;
  const complete=DISC_FIELDS.every(f=>isValid(values[f.key]));
  const points=complete?DISC_FIELDS.map((field,i)=>coordinates(values[field.key]!,i).join(",")).join(" "):"";
  const anchors=[{x:230,y:25},{x:422,y:213},{x:230,y:407},{x:38,y:213}];
  const description=DISC_FIELDS.map(f=>`${f.code}: ${values[f.key]===null?"sin dato":values[f.key]+"%"}`).join(", ");
  return <figure className="min-w-0 rounded-2xl border border-border bg-muted/20 p-2 sm:p-3">
    <svg viewBox="0 0 460 460" className="mx-auto block h-auto w-full max-w-lg" role="img" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <title id={titleId}>Perfil DISC · Gráfico de radar</title><desc id={descriptionId}>{description}. Escala independiente de 0 a 100.</desc>
      {[20,40,60,80,100].map(level=><g key={level}>
        <circle cx={center} cy={center} r={radius*level/100} fill="none" stroke="currentColor" strokeOpacity={level===100?0.28:0.13}/>
        <text x={center+5} y={center-radius*level/100-4} fontSize="10" fill="currentColor" opacity="0.6">{level}</text>
      </g>)}
      <path d="M 230 95 V 365 M 95 230 H 365" stroke="currentColor" strokeOpacity="0.3" fill="none"/>
      {complete&&<polygon data-testid="disc-radar-profile" points={points} fill="#b43b60" fillOpacity="0.18" stroke="#9b3153" strokeWidth="3" strokeLinejoin="round"/>}
      {DISC_FIELDS.map((field,index)=>{
        const value=values[field.key],anchor=anchors[index];
        const point=isValid(value)?coordinates(value,index):null;
        return <g key={field.key}>
          {point&&<circle cx={point[0]} cy={point[1]} r="5" fill={field.color} stroke="white" strokeWidth="2"><title>{field.label}: {value}%</title></circle>}
          <text x={anchor.x} y={anchor.y} textAnchor="middle" fill={field.color} fontWeight="700" fontSize="19">{field.code}</text>
          <text x={anchor.x} y={anchor.y+18} textAnchor="middle" fill="currentColor" fontSize="11">{field.label}</text>
          <text x={anchor.x} y={anchor.y+37} textAnchor="middle" fill="currentColor" fontWeight="600" fontSize="14">{value===null?"—":value+"%"}</text>
        </g>;
      })}
      <text x="218" y="247" textAnchor="end" fill="currentColor" fontSize="10">0</text>
    </svg>
    <dl className="mb-3 grid grid-cols-2 gap-2 px-2 text-center sm:grid-cols-4">
      {DISC_FIELDS.map(f=><div key={f.key} className="rounded-lg bg-background px-2 py-2"><dt className="text-xs font-medium"><span style={{color:f.color}}>{f.code}</span> · {f.label}</dt><dd className="mt-1 text-sm font-semibold">{values[f.key]===null?"Sin dato":values[f.key]+"%"}</dd></div>)}
    </dl>
    <figcaption className="px-2 pb-2 text-center text-xs leading-5 text-muted-foreground">
      {complete?"Cada eje va de 0 a 100 %. Los cuatro valores son independientes.":"Completa los cuatro porcentajes para ver el perfil. Cada eje va de 0 a 100 %."}
    </figcaption>
  </figure>;
}
