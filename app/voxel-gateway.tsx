"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { formatActivityDate, HAZARD_ICONS, type CaseStudy } from "@/lib/cases";

function positionOnGlobe(lat: number, lon: number, radius: number) {
  const phi = (90-lat)*Math.PI/180;
  const theta = (lon+180)*Math.PI/180;
  return new THREE.Vector3(-radius*Math.sin(phi)*Math.cos(theta),radius*Math.cos(phi),radius*Math.sin(phi)*Math.sin(theta));
}

export function VoxelGateway({ onEnter, cases, loading = false }: { onEnter: (caseStudy:CaseStudy) => void; cases:CaseStudy[]; loading?: boolean }) {
  const mountRef=useRef<HTMLDivElement>(null);
  const [selected,setSelected]=useState(cases[0]);
  const [launching,setLaunching]=useState(false);
  const choose=(country:CaseStudy)=>setSelected(country);
  const enter=()=>{setLaunching(true);window.setTimeout(()=>onEnter(selected),750)};

  useEffect(()=>{
    const mount=mountRef.current;if(!mount)return;
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(43,1,.1,100);camera.position.set(0,.15,11.8);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;mount.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xf3f6dc,0x173f37,3));
    const key=new THREE.DirectionalLight(0xf5f1c8,4);key.position.set(-5,7,8);scene.add(key);
    const globe=new THREE.Group();globe.rotation.y=.55;globe.rotation.x=-.08;scene.add(globe);
    const loader=new THREE.TextureLoader();
    const earthMap=loader.load("/textures/earth_atmos_2048.jpg");earthMap.colorSpace=THREE.SRGBColorSpace;
    const normalMap=loader.load("/textures/earth_normal_2048.jpg");
    const specularMap=loader.load("/textures/earth_specular_2048.jpg");
    const cloudMap=loader.load("/textures/earth_clouds_1024.png");cloudMap.colorSpace=THREE.SRGBColorSpace;
    const earth=new THREE.Mesh(new THREE.SphereGeometry(3.42,96,96),new THREE.MeshPhongMaterial({map:earthMap,normalMap,specularMap,normalScale:new THREE.Vector2(.65,.65),specular:new THREE.Color(0x6f91a0),shininess:32}));globe.add(earth);
    const clouds=new THREE.Mesh(new THREE.SphereGeometry(3.46,96,96),new THREE.MeshLambertMaterial({map:cloudMap,transparent:true,opacity:.48,depthWrite:false,blending:THREE.AdditiveBlending}));globe.add(clouds);
    const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(3.63,64,64),new THREE.MeshBasicMaterial({color:0x66b6d2,transparent:true,opacity:.14,side:THREE.BackSide,blending:THREE.AdditiveBlending}));globe.add(atmosphere);
    const markers:THREE.Mesh[]=[];
    const colors={info:0xb6df37,watch:0xe0bd3d,warning:0xe38745,danger:0xd34f3f};
    const sizes={info:.14,watch:.17,warning:.2,danger:.23};
    if(!loading)cases.forEach(country=>{const markerColor=colors[country.severity],markerSize=sizes[country.severity];const geometry=new THREE.OctahedronGeometry(markerSize);const material=new THREE.MeshBasicMaterial({color:markerColor});const marker=new THREE.Mesh(geometry,material);const position=positionOnGlobe(country.lat,country.lon,3.68);marker.position.copy(position);marker.userData.country=country;globe.add(marker);markers.push(marker);const stem=new THREE.Line(new THREE.BufferGeometry().setFromPoints([positionOnGlobe(country.lat,country.lon,3.45),position]),new THREE.LineBasicMaterial({color:markerColor}));globe.add(stem)});
    const starsGeometry=new THREE.BufferGeometry();const starPositions=new Float32Array(360);for(let i=0;i<120;i++){starPositions[i*3]=(Math.random()-.5)*24;starPositions[i*3+1]=(Math.random()-.5)*15;starPositions[i*3+2]=-3-Math.random()*8}starsGeometry.setAttribute("position",new THREE.BufferAttribute(starPositions,3));scene.add(new THREE.Points(starsGeometry,new THREE.PointsMaterial({color:0xeaf1d8,size:.035,transparent:true,opacity:.65})));
    let dragging=false,lastX=0,lastY=0,moved=false,targetZoom=11.8;
    const down=(event:PointerEvent)=>{dragging=true;moved=false;lastX=event.clientX;lastY=event.clientY;renderer.domElement.setPointerCapture(event.pointerId)};
    const move=(event:PointerEvent)=>{if(!dragging)return;const dx=event.clientX-lastX,dy=event.clientY-lastY;if(Math.abs(dx)+Math.abs(dy)>2)moved=true;globe.rotation.y+=dx*.006;globe.rotation.x=THREE.MathUtils.clamp(globe.rotation.x+dy*.004,-.8,.8);lastX=event.clientX;lastY=event.clientY};
    const up=(event:PointerEvent)=>{dragging=false;if(moved)return;const rect=renderer.domElement.getBoundingClientRect();const pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(markers)[0];if(hit)setSelected(hit.object.userData.country as CaseStudy)};
    const wheel=(event:WheelEvent)=>{event.preventDefault();targetZoom=THREE.MathUtils.clamp(targetZoom+event.deltaY*.008,8.5,14)};
    const canvas=renderer.domElement;canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",up);canvas.addEventListener("wheel",wheel,{passive:false});
    const resize=()=>{renderer.setSize(mount.clientWidth,mount.clientHeight,false);camera.aspect=mount.clientWidth/mount.clientHeight;camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(mount);resize();
    let frame=0;const clock=new THREE.Clock();const animate=()=>{frame=requestAnimationFrame(animate);if(!dragging)globe.rotation.y+=.00055;clouds.rotation.y+=.00028;camera.position.z=THREE.MathUtils.lerp(camera.position.z,targetZoom,.08);markers.forEach((marker,index)=>{const pulse=1+Math.sin(clock.elapsedTime*2.5+index)*.18;marker.scale.setScalar(pulse)});renderer.render(scene,camera)};animate();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",up);canvas.removeEventListener("wheel",wheel);renderer.dispose();starsGeometry.dispose();earthMap.dispose();normalMap.dispose();specularMap.dispose();cloudMap.dispose();mount.removeChild(canvas)};
  },[cases,loading]);

  return <main className={`planet-gateway ${launching?"is-launching":""}`}>
    <header className="planet-nav"><div className="planet-brand">KUSKA <span>juntos</span></div><div><i/> {loading?"SINCRONIZANDO ALERTAS":"PLANETA DE MISIONES EN VIVO"}</div><button>Sobre KUSKA ↗</button></header>
    <section className="planet-copy"><p>INTELIGENCIA COLECTIVA · TIERRA</p><h1>Elige un lugar.<br/><em>Cambia su historia.</em></h1><span>Gira el planeta, descubre problemas reales y entra a colaborar con las personas que ya están allí.</span></section>
    <div ref={mountRef} className="planet-canvas" aria-label="Planeta 3D interactivo. Arrastra para girar y selecciona marcadores de países."/>
    <div className="planet-guide">↔ ARRASTRA PARA GIRAR <span>·</span> RUEDA PARA ACERCAR <span>·</span> PULSA UN MARCADOR</div>
    {loading?<aside className="country-panel country-loading" aria-live="polite"><small>CONECTANDO FUENTES OFICIALES</small><div><b>⌁</b><h2>Buscando misiones</h2></div><p>Estamos reuniendo las alertas actuales antes de mostrar ubicaciones.</p><span className="loading-beacon"><i/> GDACS · IFRC GO · NASA FIRMS</span></aside>:<aside className="country-panel"><small>{selected.dataState==="live"?"● EN VIVO":"ACTUALIZADO"} · {selected.source}</small><div><b>{HAZARD_ICONS[selected.hazardKind]}</b><h2>{selected.country}</h2></div><span className={`hazard-origin origin-${selected.origin}`}>{selected.hazardLabel} · {selected.originLabel}</span><p>{selected.eventTitle}</p><span className="case-freshness">Última señal verificada · {formatActivityDate(selected.lastActivityAt)}</span><span className={`country-alert-count severity-${selected.severity}`}><i/>{selected.dataState==="live"?"Actividad en curso":"Actividad reciente"} · {selected.metrics[0]?.value}</span><button onClick={enter}>Explorar simulación <strong>→</strong></button></aside>}
    <nav className={`country-list ${loading?"is-loading":""}`} aria-label={loading?"Cargando casos disponibles":"Casos disponibles"}>{loading?<span><i/> Sincronizando ubicaciones verificadas…</span>:cases.map(country=><button key={country.id} title={`${country.hazardLabel} · ${country.country}`} className={selected.id===country.id?"selected":""} onClick={()=>choose(country)}><i className={`severity-${country.severity}`}/><strong>{HAZARD_ICONS[country.hazardKind]}</strong>{country.country}</button>)}</nav>
    <div className="teleport-wipe"/>
  </main>;
}
