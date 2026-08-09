import { NextResponse } from "next/server";
import type { AlertSeverity, KuskaAlert } from "@/lib/alerts";
import { classifyForecast, severityRank } from "@/lib/alerts";

type WeatherResponse = {
  hourly?: { time?: string[]; precipitation_probability?: number[]; precipitation?: number[]; rain?: number[]; weather_code?: number[]; wind_gusts_10m?: number[] };
  daily?: { time?: string[]; precipitation_sum?: number[]; rain_sum?: number[]; precipitation_probability_max?: number[]; wind_gusts_10m_max?: number[] };
};

async function weatherAlerts(now: string): Promise<KuskaAlert[]> {
  const url="https://api.open-meteo.com/v1/forecast?latitude=-5.1945&longitude=-80.6328&hourly=precipitation_probability,precipitation,rain,weather_code,wind_gusts_10m&daily=precipitation_sum,rain_sum,precipitation_probability_max,wind_gusts_10m_max&forecast_days=7&timezone=America%2FLima";
  const response=await fetch(url,{next:{revalidate:900},signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw new Error(`Open-Meteo ${response.status}`);
  const data=await response.json() as WeatherResponse;
  const days=data.daily?.time??[];
  return days.slice(0,3).map((day,index)=>{
    const rain=Number(data.daily?.precipitation_sum?.[index]??0);
    const probability=Number(data.daily?.precipitation_probability_max?.[index]??0);
    const gust=Number(data.daily?.wind_gusts_10m_max?.[index]??0);
    const hourlyIndexes=(data.hourly?.time??[]).map((time,i)=>time.startsWith(day)?i:-1).filter(i=>i>=0);
    const hourlyMax=Math.max(0,...hourlyIndexes.map(i=>Number(data.hourly?.precipitation?.[i]??0)));
    const weatherCode=Math.max(0,...hourlyIndexes.map(i=>Number(data.hourly?.weather_code?.[i]??0)));
    const severity=classifyForecast(rain,probability,hourlyMax,weatherCode);
    const label=index===0?"hoy":index===1?"mañana":new Date(`${day}T12:00:00-05:00`).toLocaleDateString("es-PE",{weekday:"long"});
    return {id:`forecast-${day}`,source:"Open-Meteo" as const,title:severity==="info"?`Sin señal de lluvia intensa para ${label}`:`Vigilancia de lluvia para ${label}`,description:`Advertencia calculada por KUSKA a partir del pronóstico, no es un aviso oficial.`,severity,scope:"Piura, Perú",type:"forecast" as const,startsAt:`${day}T00:00:00-05:00`,endsAt:`${day}T23:59:59-05:00`,updatedAt:now,url:"https://open-meteo.com/",official:false,metrics:[{label:"Precipitación",value:`${rain.toFixed(1)} mm`},{label:"Probabilidad máx.",value:`${Math.round(probability)}%`},{label:"Pico horario",value:`${hourlyMax.toFixed(1)} mm`},{label:"Ráfagas",value:`${Math.round(gust)} km/h`}],simulation:{precipitationMm:rain,probabilityPct:probability,hourlyPeakMm:hourlyMax,windGustKmh:gust}};
  });
}

async function gdacsAlerts(now: string): Promise<KuskaAlert[]> {
  const response=await fetch("https://www.gdacs.org/contentdata/xml/gdacsFL.geojson",{next:{revalidate:1800},signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw new Error(`GDACS ${response.status}`);
  const body=await response.json() as {features?:Array<{properties?:Record<string,unknown>}>};
  return (body.features??[]).filter(feature=>{const values=Object.values(feature.properties??{}).join(" ").toLowerCase();return values.includes("peru")||values.includes("perú")||values.includes(" per ")}).slice(0,5).map((feature,index)=>{
    const p=feature.properties??{};const level=String(p.alertlevel??p.alertLevel??p.alertscore??"green").toLowerCase();const severity:AlertSeverity=level.includes("red")?"danger":level.includes("orange")?"warning":"watch";const eventId=String(p.eventid??p.eventId??index);const startsAt=String(p.fromdate??p.fromDate??p.datetime??now);const endsAt=String(p.todate??p.toDate??"");
    return {id:`gdacs-${eventId}`,source:"GDACS" as const,title:String(p.name??p.eventname??p.title??"Evento de inundación registrado en Perú"),description:String(p.description??p.htmldescription??"Evento publicado en el sistema global GDACS." ).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,280),severity,scope:"Perú (ver fuente para el área exacta)",type:"flood-event" as const,startsAt,endsAt:endsAt||undefined,updatedAt:now,url:String(p.url??p.reporturl??`https://www.gdacs.org/report.aspx?eventtype=FL&eventid=${eventId}`),official:true};
  });
}

export async function GET(){const updatedAt=new Date().toISOString();const unavailableSources:string[]=[];const results=await Promise.allSettled([weatherAlerts(updatedAt),gdacsAlerts(updatedAt)]);const alerts:KuskaAlert[]=[];if(results[0].status==="fulfilled")alerts.push(...results[0].value);else{console.error("Open-Meteo alert feed unavailable",results[0].reason);unavailableSources.push("Open-Meteo")}if(results[1].status==="fulfilled")alerts.push(...results[1].value);else{console.error("GDACS alert feed unavailable",results[1].reason);unavailableSources.push("GDACS")}alerts.sort((a,b)=>severityRank[b.severity]-severityRank[a.severity]||Date.parse(b.startsAt)-Date.parse(a.startsAt));return NextResponse.json({alerts,updatedAt,unavailableSources},{headers:{"Cache-Control":"public, s-maxage=900, stale-while-revalidate=1800"}})}
