"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { formatActivityDate, HAZARD_ICONS, type CaseStudy } from "@/lib/cases";
import type { NewsFeed } from "@/lib/news";
import { interpolateVisual, type DecisionScenario } from "@/lib/decision-simulation";
import type { SceneElement } from "@/lib/scene-plan";
import type { RemoteWorldPlayer, WorldPosition } from "@/lib/realtime-events";

type WorldExplorerProps = {
  playerId: string;
  alias: string;
  role: string;
  onBack: () => void;
  onOpenMission: () => void;
  onClearScenario: () => void;
  caseStudy: CaseStudy;
  scenario: DecisionScenario | null;
  remotePlayers: RemoteWorldPlayer[];
  onPositionChange: (position: WorldPosition) => void;
};

const motionLabels:Record<CaseStudy["hazardKind"],string>={flood:"CORRIENTE Y NIVEL VARIABLES",earthquake:"PULSOS SÍSMICOS Y RÉPLICAS",cyclone:"RÁFAGAS Y ESCOMBROS EN ROTACIÓN",volcano:"LAVA, EYECCIONES Y CENIZA",wildfire:"BRASAS, HUMO Y PROPAGACIÓN",drought:"POLVO Y ESTRÉS HÍDRICO",tsunami:"OLEAJE Y AVANCE DEL AGUA",storm_surge:"MAREA, LLUVIA Y RÁFAGAS",landslide:"ROCAS Y SUELO EN MOVIMIENTO",heatwave:"CALOR Y ONDAS TÉRMICAS",cold_wave:"NIEVE, HIELO Y VIENTO",chemical:"FUGA Y NUBE CONTAMINANTE",biological:"PERÍMETRO SANITARIO ACTIVO",radiological:"PULSO DE ZONA RADIOLÓGICA",transport:"FUEGO, CHISPAS Y HUMO",other:"RIESGO AMBIENTAL ACTIVO"};
const hazardVisualHelp:Record<CaseStudy["hazardKind"],string>={flood:"El nivel reportado controla el cauce, la corriente y los cruces.",earthquake:"La magnitud controla vibración, grietas y escombros.",cyclone:"El viento y la alerta controlan lluvia, árboles y objetos desplazados.",volcano:"La alerta controla lava, ceniza, humo y el perímetro de la ladera.",wildfire:"El área detectada controla árboles quemados, focos, humo y perímetros.",drought:"La exposición controla sequedad del suelo, polvo y nivel del cauce.",tsunami:"La severidad controla el avance del agua, las crestas y las zonas bajas.",storm_surge:"La severidad combina subida del agua, lluvia y viento costero.",landslide:"La severidad controla suelo desplazado, rocas y accesos bloqueados.",heatwave:"La severidad controla suelo seco, color ambiental y distorsión térmica.",cold_wave:"La severidad controla nieve, viento y superficies heladas.",chemical:"El tipo y severidad controlan instalaciones, fuga y perímetro contaminado.",biological:"El tipo y severidad controlan el perímetro y los puntos sanitarios.",radiological:"El tipo y severidad controlan instalaciones y zona radiológica.",transport:"El tipo y severidad controlan vehículo, fuego, humo y accesos.",other:"El tipo y la severidad controlan la zona de riesgo y su señalización."};
const sceneElementIcons:Record<string,string>={safe_route:"↗",alert_network:"⌁",response_hub:"+",barrier:"◌",clearance:"▤",supply_point:"▣",observation_post:"◎"};
const sceneElementDescriptions:Record<SceneElement["type"],string>={
  safe_route:"Línea turquesa que marca el recorrido acordado.",
  alert_network:"Postes amarillos conectados que representan los avisos.",
  response_hub:"Edificio claro que representa el punto de respuesta.",
  barrier:"Perímetro amarillo alrededor de la zona intervenida.",
  clearance:"Marcas turquesa sobre el corredor que debe despejarse.",
  supply_point:"Plataforma y cajas que representan suministros.",
  observation_post:"Torre amarilla desde donde se verifica el territorio.",
};

function sceneElementAnchor(element:SceneElement){
  const points=element.type==="safe_route"?element.path:element.type==="alert_network"?element.nodes:element.type==="barrier"?[element.center]:[element.position];
  return points.reduce((sum,point)=>({x:sum.x+point.x/points.length,z:sum.z+point.z/points.length}),{x:0,z:0});
}

function makeSceneMarker(index:number,label:string,color:string){
  const canvas=document.createElement("canvas");canvas.width=768;canvas.height=128;
  const context=canvas.getContext("2d");if(!context)return null;
  context.fillStyle="rgba(12,48,40,.92)";context.beginPath();context.roundRect(4,4,760,120,22);context.fill();
  context.fillStyle=color;context.beginPath();context.arc(64,64,38,0,Math.PI*2);context.fill();
  context.fillStyle="#123b32";context.font="900 42px Arial";context.textAlign="center";context.textBaseline="middle";context.fillText(String(index+1),64,66);
  context.fillStyle="#f6f8ec";context.font="700 31px Arial";context.textAlign="left";context.fillText(label.slice(0,38),122,66);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.SpriteMaterial({map:texture,transparent:true,opacity:0,depthTest:false});
  const sprite=new THREE.Sprite(material);sprite.scale.set(6.6,1.1,1);sprite.userData.texture=texture;sprite.userData.elementIndex=index;
  return sprite;
}

function block(material: THREE.Material, size: [number, number, number], position: [number, number, number]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeAvatar(colors: [number, number], demo = false) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc88961 });
  const shirt = new THREE.MeshLambertMaterial({ color: colors[0] });
  const trousers = new THREE.MeshLambertMaterial({ color: colors[1] });
  group.add(block(skin, [.48, .48, .48], [0, 1.66, 0]));
  group.add(block(shirt, [.62, .72, .38], [0, 1.06, 0]));
  const leftArm = block(skin, [.18, .68, .2], [-.43, 1.08, 0]);
  const rightArm = block(skin, [.18, .68, .2], [.43, 1.08, 0]);
  const leftLeg = block(trousers, [.24, .66, .28], [-.17, .36, 0]);
  const rightLeg = block(trousers, [.24, .66, .28], [.17, .36, 0]);
  leftArm.name = "leftArm"; rightArm.name = "rightArm"; leftLeg.name = "leftLeg"; rightLeg.name = "rightLeg";
  group.add(leftArm, rightArm, leftLeg, rightLeg);
  if (demo) {
    const marker = block(new THREE.MeshBasicMaterial({ color: 0xd86f4d }), [.22, .22, .22], [0, 2.12, 0]);
    marker.rotation.y = Math.PI / 4;
    group.add(marker);
  }
  return group;
}

function makePlayerLabel(alias: string) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 96;
  const context = canvas.getContext("2d"); if (!context) return null;
  context.fillStyle = "rgba(12,48,40,.94)"; context.beginPath(); context.roundRect(4, 4, 504, 88, 18); context.fill();
  context.fillStyle = "#b6df37"; context.beginPath(); context.arc(38, 48, 10, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#f6f8ec"; context.font = "700 29px Arial"; context.textBaseline = "middle"; context.fillText(alias.slice(0, 24), 62, 49);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material); sprite.scale.set(3.8, .72, 1); sprite.position.set(0, 2.55, 0); sprite.userData.texture = texture;
  return sprite;
}

export function WorldExplorer({ playerId, alias, role, onBack, onOpenMission, onClearScenario, caseStudy, scenario, remotePlayers, onPositionChange }: WorldExplorerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef(new Set<string>());
  const [nearPerson, setNearPerson] = useState<string | null>(null);
  const [hazardMessage, setHazardMessage] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [newsOpen,setNewsOpen]=useState(false);
  const [newsFeed,setNewsFeed]=useState<NewsFeed|null>(null);
  const [chatText, setChatText] = useState("");
  const [scenarioPhase, setScenarioPhase] = useState<"before" | "action" | "after">("before");
  const [scenarioProgress, setScenarioProgress] = useState(0);
  const [messages, setMessages] = useState([
    { alias: "Ana M.", text: `Estoy observando los efectos de ${caseStudy.hazardLabel.toLowerCase()}.` },
    { alias: "Luz V.", text: "Estoy marcando una ruta segura para la comunidad." },
  ]);
  const visual=useMemo(()=>caseStudy.visual,[caseStudy]);
  const visualRef=useRef({visual,severity:caseStudy.severity});
  const scenarioProgressRef=useRef(0);
  const remotePlayersRef=useRef(remotePlayers);
  const spawnIndex=useMemo(()=>[...playerId].reduce((total,character)=>((total*31)+character.charCodeAt(0))>>>0,7)%42,[playerId]);
  const playerSpawn=useMemo<[number,number]>(()=>[-11+(spawnIndex%7),6+Math.floor(spawnIndex/7)],[spawnIndex]);
  useEffect(()=>{remotePlayersRef.current=remotePlayers},[remotePlayers]);
  useEffect(()=>{visualRef.current={visual,severity:caseStudy.severity}},[visual,caseStudy.severity]);
  useEffect(()=>{
    visualRef.current={visual:caseStudy.visual,severity:caseStudy.severity};
    scenarioProgressRef.current=0;
    if(!scenario)return;
    const started=performance.now();
    const duration=scenario.scenePlan?.phaseDurationSeconds??7.2;
    const timer=window.setInterval(()=>{const elapsed=(performance.now()-started)/1000;const progress=Math.max(0,Math.min(1,(elapsed-1.2)/Math.max(3,duration-1.2)));scenarioProgressRef.current=progress;visualRef.current={visual:interpolateVisual(caseStudy.visual,scenario.targetVisual,progress),severity:caseStudy.severity};setScenarioProgress(Math.round(progress*100));setScenarioPhase(elapsed<1.2?"before":progress<1?"action":"after");if(progress>=1)window.clearInterval(timer)},80);
    return()=>window.clearInterval(timer);
  },[caseStudy.severity,caseStudy.visual,scenario]);
  useEffect(()=>{const controller=new AbortController();const query=new URLSearchParams({country:caseStudy.country,hazard:caseStudy.hazardKind,title:caseStudy.eventTitle});fetch(`/api/news?${query}`,{signal:controller.signal}).then(response=>response.json()).then((feed:NewsFeed)=>setNewsFeed(feed)).catch(error=>{if(error instanceof Error&&error.name!=="AbortError")setNewsFeed({articles:[],updatedAt:new Date().toISOString(),source:"GDELT DOC 2.0",searchUrl:"https://api.gdeltproject.org/api/v2/doc/doc",unavailable:true,note:"No se pudo consultar la cobertura periodística."})});return()=>controller.abort()},[caseStudy.country,caseStudy.eventTitle,caseStudy.hazardKind]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa9c8bd);
    scene.fog = new THREE.Fog(0xa9c8bd, 19, 42);
    const camera = new THREE.PerspectiveCamera(55, 1, .1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xeaf2dd, 0x315243, 2.25));
    const sun = new THREE.DirectionalLight(0xfff2c2, 3.2);
    sun.position.set(-8, 18, 7); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); scene.add(sun);

    const kind=caseStudy.hazardKind;
    const hazardCenter={x:2,z:-2};
    const riverEnabled=kind==="flood"||kind==="cyclone"||kind==="drought"||kind==="tsunami"||kind==="storm_surge";
    const dry = caseStudy.visual.drought;
    const grassA = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x6f9568).lerp(new THREE.Color(0xa98a4d), dry) });
    const grassB = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x86aa72).lerp(new THREE.Color(0xc3a65f), dry) });
    const dirt = new THREE.MeshLambertMaterial({ color: 0x876b48 });
    const road = new THREE.MeshLambertMaterial({ color: 0xb79e72 });
    const scorched = new THREE.MeshLambertMaterial({color:kind==="volcano"?0x493f3a:kind==="landslide"?0x79634a:0x4b432f});
    const ashSoil = new THREE.MeshLambertMaterial({color:0x675f56});
    const hazardConcrete = new THREE.MeshLambertMaterial({color:0x777b73});
    const crownMaterial=new THREE.MeshLambertMaterial({color:0x315f3d});
    const worldTrees:THREE.Group[]=[];
    const waterMaterial = new THREE.MeshPhongMaterial({ color: 0x398d94, transparent: true, opacity: .82, shininess: 80 });

    const riverAt = (x: number, _z: number) => riverEnabled&&Math.abs(x) < 2.15*(1+visualRef.current.visual.water*.24);
    const bridgeAt = (x: number, z: number) => riverEnabled&&visualRef.current.visual.water<.88&&Math.abs(z - 4) < .78 && Math.abs(x) < 2.65;
    const houses: Array<[number, number]> = [[-6,-4],[-8,0],[5,-5],[7,2],[5,7]];
    const avatarSpots: Array<[number, number]> = [[-4,4],[4,3],[6,-4]];
    const collidesWithHouse = (x: number, z: number) => houses.some(([hx,hz]) => Math.abs(x-hx)<1.55 && Math.abs(z-hz)<1.4);
    const collidesWithDemoAvatar = (x: number, z: number) => avatarSpots.some(([ax,az]) => Math.hypot(x-ax,z-az)<.82);
    const remoteDistanceAt = (x: number, z: number) => remotePlayersRef.current.reduce((distance,remote)=>remote.position.visible?Math.min(distance,Math.hypot(x-remote.position.x,z-remote.position.z)):distance,Number.POSITIVE_INFINITY);
    const collidesWithRemoteAvatar = (x: number, z: number) => remoteDistanceAt(x,z)<.82;
    const collidesWithAvatar = (x: number, z: number) => collidesWithDemoAvatar(x,z) || collidesWithRemoteAvatar(x,z);
    const fireZoneAt = (x: number, z: number) => visualRef.current.visual.fire>.2 && Math.hypot(x-hazardCenter.x,z-hazardCenter.z)<(kind==="volcano"?4.55:kind==="wildfire"?3.8:3.1);
    const contaminationAt = (x: number, z: number) => visualRef.current.visual.contamination>.2 && Math.hypot(x-hazardCenter.x,z-hazardCenter.z)<3.25;
    const rubbleAt = (x: number, z: number) => visualRef.current.visual.shake>.25 && Math.hypot(x-hazardCenter.x,z-hazardCenter.z)<2.2;
    const blockedEnvironmentAt = (x: number, z: number) => (riverAt(x,z) && !bridgeAt(x,z)) || collidesWithHouse(x,z) || collidesWithDemoAvatar(x,z) || fireZoneAt(x,z) || contaminationAt(x,z) || rubbleAt(x,z);

    for (let x = -13; x <= 13; x++) {
      for (let z = -13; z <= 13; z++) {
        const river = riverAt(x,z);
        if (river) continue;
        const edge = Math.abs(x) > 11 || Math.abs(z) > 11;
        const height = edge ? 1.4 : 1 + Math.max(0, Math.sin(x * 1.7 + z) * .14);
        const hazardDistance=Math.hypot(x-hazardCenter.x,z-hazardCenter.z);
        const hazardousGround=hazardDistance<(kind==="volcano"?5.4:kind==="wildfire"?4.8:kind==="landslide"?5.2:3.7);
        const mat = hazardousGround&&(kind==="volcano"||kind==="wildfire"||kind==="landslide")?(kind==="volcano"&&hazardDistance>3.8?ashSoil:scorched):hazardousGround&&(kind==="chemical"||kind==="radiological"||kind==="transport"||kind==="biological")?hazardConcrete:Math.abs(z - 4) < 1 && x < -1 ? road : ((x + z) % 3 ? grassA : grassB);
        const tile = block(mat, [.96, height, .96], [x, height / 2 - .62, z]);
        scene.add(tile);
        if ((x * 7 + z * 11) % 29 === 0 && !edge && !(hazardousGround&&(kind==="volcano"||kind==="wildfire"||kind==="landslide"))) {
          const tree=new THREE.Group();tree.position.set(x,0,z);tree.userData.phase=worldTrees.length*.73;tree.add(block(dirt,[.22,1.1,.22],[0,.55,0]),block(crownMaterial,[.85,.95,.85],[0,1.45,0]));worldTrees.push(tree);scene.add(tree);
        }
      }
    }

    const water = block(waterMaterial, [4.3, .32, 28], [0, -.05, 0]);
    water.receiveShadow = true;water.visible=riverEnabled;scene.add(water);
    const floatingDebris:THREE.Mesh[]=[];const floatingMaterial=new THREE.MeshLambertMaterial({color:0x765a3c});
    if(riverEnabled&&kind!=="drought")for(let i=0;i<8;i++){const piece=block(floatingMaterial,[.28+i%3*.13,.1,.52],[((i%3)-1)*.72,.12,-11+i*3]);piece.rotation.y=i*.67;piece.userData.speed=.7+(i%4)*.17;floatingDebris.push(piece);scene.add(piece)}
    const bridgeMaterial = new THREE.MeshLambertMaterial({ color: 0x7f5b38 });
    if(riverEnabled)for (let x = -2; x <= 2; x++) scene.add(block(bridgeMaterial, [.92, .3, 1.45], [x, .3, 4]));
    const warningMaterial = new THREE.MeshBasicMaterial({ color: 0xb6df37 });const warningPosts:THREE.Mesh[]=[];const addWarning=(x:number,z:number)=>{const post=block(warningMaterial,[.14,1.35,.14],[x,.52,z]);post.userData.phase=warningPosts.length*.8;warningPosts.push(post);scene.add(post)};
    if(riverEnabled){for (let z = -10; z < 11; z += 4)addWarning(-2.35,z)}
    else{[[hazardCenter.x-3.5,hazardCenter.z],[hazardCenter.x+3.5,hazardCenter.z],[hazardCenter.x,hazardCenter.z-3.5],[hazardCenter.x,hazardCenter.z+3.5]].forEach(([x,z])=>addWarning(x,z))}

    const interventionGroup=new THREE.Group();const interventionMeshes:THREE.Mesh[]=[];const alertBeacons:THREE.Mesh[]=[];const sceneMarkers:THREE.Sprite[]=[];scene.add(interventionGroup);
    const planPoints=scenario?.scenePlan?.elements.flatMap(element=>element.type==="safe_route"?element.path:element.type==="alert_network"?element.nodes:element.type==="barrier"?[element.center]:[element.position])??[];
    const interventionFocus=planPoints.length?planPoints.reduce<THREE.Vector3>((point,item)=>point.add(new THREE.Vector3(item.x,1,item.z)),new THREE.Vector3()).multiplyScalar(1/planPoints.length):new THREE.Vector3(0,1,2);
    const interventionMaterial=new THREE.MeshLambertMaterial({color:0xb6df37,transparent:true,opacity:0});
    const responseMaterial=new THREE.MeshLambertMaterial({color:0xeef4dd,transparent:true,opacity:0});
    const routeMaterial=new THREE.MeshLambertMaterial({color:0x73cfc0,emissive:0x143f38,emissiveIntensity:.35,transparent:true,opacity:0});
    const safetyMaterial=new THREE.MeshLambertMaterial({color:0xf2c94c,emissive:0x4d3c08,emissiveIntensity:.3,transparent:true,opacity:0});
    const darkResponseMaterial=new THREE.MeshLambertMaterial({color:0x17483c,transparent:true,opacity:0});
    const interventionMaterials=[interventionMaterial,responseMaterial,routeMaterial,safetyMaterial,darkResponseMaterial];
    const addInterventionBlock=(size:[number,number,number],position:[number,number,number],material=interventionMaterial)=>{const item=block(material,size,position);interventionMeshes.push(item);interventionGroup.add(item);return item};
    if(scenario){
      const plan=scenario.scenePlan;
      if(plan){
        plan.elements.forEach((element,elementIndex)=>{
          const firstMeshIndex=interventionMeshes.length;
          if(element.type==="safe_route"){
            element.path.slice(0,-1).forEach((start,index)=>{const end=element.path[index+1];const dx=end.x-start.x,dz=end.z-start.z,distance=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(distance/.9));for(let step=0;step<=steps;step++){const amount=step/steps,x=start.x+dx*amount,z=start.z+dz*amount;const tile=addInterventionBlock([.58,.09,.58],[x,.17,z],routeMaterial);tile.rotation.y=Math.atan2(dx,dz)+Math.PI/4;}});
            element.path.forEach((point,index)=>{addInterventionBlock([.12,.9,.12],[point.x,.58,point.z],darkResponseMaterial);const signal=addInterventionBlock([.48,.24,.48],[point.x,1.08,point.z],routeMaterial);signal.rotation.y=Math.PI/4;signal.userData.phase=index*.75;alertBeacons.push(signal);});
          }else if(element.type==="response_hub"){
            const {x,z}=element.position;addInterventionBlock([2.2,1.25,1.8],[x,.62,z],responseMaterial);addInterventionBlock([2.5,.22,2.05],[x,1.35,z],darkResponseMaterial);addInterventionBlock([.18,.62,.08],[x,1.02,z-0.92],safetyMaterial);addInterventionBlock([.62,.18,.08],[x,1.02,z-0.92],safetyMaterial);
          }else if(element.type==="barrier"){
            for(let index=0;index<18;index++){const angle=index/18*Math.PI*2;addInterventionBlock([.16,1.18,.16],[element.center.x+Math.cos(angle)*element.radius,.55,element.center.z+Math.sin(angle)*element.radius],safetyMaterial);}
          }else if(element.type==="clearance"){
            const {x,z}=element.position;for(let index=-2;index<=2;index++){const marker=addInterventionBlock([.62,.1,.62],[x+index*.72,.16,z+index*.18],routeMaterial);marker.rotation.y=Math.PI/4;}
          }else if(element.type==="supply_point"){
            const {x,z}=element.position;addInterventionBlock([1.8,.16,1.8],[x,.16,z],routeMaterial);[[-.45,0],[.45,0],[0,.52]].forEach(([ox,oz],index)=>addInterventionBlock([.72,.58,.68],[x+ox,.38+(index===2 ? .55 : 0),z+oz],index===2?safetyMaterial:responseMaterial));
          }else if(element.type==="observation_post"){
            const {x,z}=element.position;addInterventionBlock([.24,2.15,.24],[x,1.05,z],darkResponseMaterial);addInterventionBlock([.72,.22,.72],[x,2.18,z],safetyMaterial);addInterventionBlock([1.25,.1,1.25],[x,.12,z],routeMaterial);
          }else{
            element.nodes.forEach((node,index)=>{const next=element.nodes[(index+1)%element.nodes.length];const dx=next.x-node.x,dz=next.z-node.z,distance=Math.hypot(dx,dz);const link=addInterventionBlock([.08,.07,distance],[node.x+dx/2,1.52,node.z+dz/2],routeMaterial);link.rotation.y=Math.atan2(dx,dz);addInterventionBlock([.16,1.55,.16],[node.x,.72,node.z],darkResponseMaterial);const beacon=addInterventionBlock([.58,.32,.58],[node.x,1.62,node.z],safetyMaterial);beacon.rotation.y=Math.PI/4;beacon.userData.phase=index*1.15;alertBeacons.push(beacon);});
          }
          interventionMeshes.slice(firstMeshIndex).forEach(item=>{item.userData.elementIndex=elementIndex});
          const anchor=sceneElementAnchor(element),marker=makeSceneMarker(elementIndex,element.label,element.type==="alert_network"||element.type==="barrier"?"#f2c94c":"#73cfc0");
          if(marker){marker.position.set(anchor.x,3.2,anchor.z);sceneMarkers.push(marker);interventionGroup.add(marker)}
        });
      }else if(scenario.kind==="evacuation"||scenario.kind==="health"||scenario.kind==="logistics"){
        [[-9,7],[-7,6],[-5,5],[-3,4],[-1,4],[1,4],[3,4]].forEach(([x,z],index)=>{const marker=addInterventionBlock([.52,.08,.52],[x,.18,z]);marker.rotation.y=Math.PI/4;marker.userData.phase=index*.12});
        addInterventionBlock([2.4,1.15,2],[-9,.56,5.2],responseMaterial);addInterventionBlock([2.7,.2,2.25],[-9,1.2,5.2],interventionMaterial);
      }else if(scenario.kind==="containment"){
        for(let index=0;index<16;index++){const angle=index/16*Math.PI*2;const radius=4.2;addInterventionBlock([.16,1.25,.16],[hazardCenter.x+Math.cos(angle)*radius,.55,hazardCenter.z+Math.sin(angle)*radius]);}
      }else if(scenario.kind==="clearance"){
        [[-1.6,1.8],[-.5,2.35],[.7,2.8],[1.8,3.25]].forEach(([x,z])=>addInterventionBlock([.6,.1,.6],[hazardCenter.x+x,.16,hazardCenter.z+z]));
      }else{
        [[-3.5,0],[3.5,0],[0,-3.5],[0,3.5]].forEach(([x,z])=>addInterventionBlock([.18,1.45,.18],[hazardCenter.x+x,.62,hazardCenter.z+z]));
      }
    }

    const houseWall = new THREE.MeshLambertMaterial({ color: 0xd09668 });
    const roof = new THREE.MeshLambertMaterial({ color: 0x994f3c });
    const houseMeshes: THREE.Mesh[]=[];
    houses.forEach(([x,z], index) => {
      scene.add(block(houseWall, [2.1, 1.6, 1.8], [x, .78, z]));
      const top = block(roof, [2.35, .38, 2.05], [x, 1.75, z]); top.rotation.z = index % 2 ? .08 : -.08; top.userData.baseRotation=top.rotation.z; houseMeshes.push(top); scene.add(top);
    });

    const player = makeAvatar([0x173f34, 0x314d67]); player.position.set(playerSpawn[0], .4, playerSpawn[1]); scene.add(player);
    const npcs = [
      { name: "Ana M. · Vecina", object: makeAvatar([0xc86d4d, 0x544939], true), position: new THREE.Vector3(-4, .4, 4) },
      { name: "Luz V. · Brigadista", object: makeAvatar([0xb6df37, 0x304b3f], true), position: new THREE.Vector3(4, .4, 3) },
      { name: "Diego R. · Comerciante", object: makeAvatar([0xd0b274, 0x384a5b], true), position: new THREE.Vector3(6, .4, -4) },
    ];
    npcs.forEach(npc => { npc.object.position.copy(npc.position); scene.add(npc.object); });
    const remoteAvatars = new Map<string, { object: THREE.Group; label: THREE.Sprite | null }>();

    const rainCount = 1200;
    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) { rainPositions[i*3]=(Math.random()-.5)*35; rainPositions[i*3+1]=Math.random()*18; rainPositions[i*3+2]=(Math.random()-.5)*35; }
    const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
    const rainMaterial=new THREE.PointsMaterial({ color: 0xd7edeb, size: kind==="cold_wave"?.11:.065, transparent: true, opacity: .75 });
    const rain = new THREE.Points(rainGeometry, rainMaterial); scene.add(rain);
    const landmarkGroup=new THREE.Group();scene.add(landmarkGroup);
    const fireGroup=new THREE.Group();const flameGroups:THREE.Group[]=[];scene.add(fireGroup);
    const flameOuter=new THREE.MeshBasicMaterial({color:0xe74722});const flameMiddle=new THREE.MeshBasicMaterial({color:0xff8a28});const flameCore=new THREE.MeshBasicMaterial({color:0xffe35b});
    const addFlame=(x:number,z:number,scale=1,y=.12)=>{const flame=new THREE.Group();flame.position.set(x,y,z);flame.scale.setScalar(scale);flame.add(block(flameOuter,[.68,.62,.68],[0,.32,0]),block(flameMiddle,[.48,.72,.48],[.05,.75,0]),block(flameCore,[.25,.52,.25],[-.04,1.12,.02]));flame.userData.baseScale=scale;flameGroups.push(flame);fireGroup.add(flame);return flame};
    const rubbleGroup=new THREE.Group();const rubbleMaterial=new THREE.MeshLambertMaterial({color:0x6d604d});scene.add(rubbleGroup);
    const darkWood=new THREE.MeshLambertMaterial({color:0x2e2923});const deadLeaf=new THREE.MeshLambertMaterial({color:0x494735});

    if(kind==="volcano"){
      const basaltA=new THREE.MeshLambertMaterial({color:0x443d3a});const basaltB=new THREE.MeshLambertMaterial({color:0x5a4b42});
      for(let level=0;level<6;level++){const radius=3.6-level*.52;const bound=Math.ceil(radius);for(let dx=-bound;dx<=bound;dx++){for(let dz=-bound;dz<=bound;dz++){if(Math.hypot(dx,dz)>radius||Math.hypot(dx,dz)<Math.max(0,radius-1.15))continue;const rock=block((dx+dz+level)%2?basaltA:basaltB,[.86,.62,.86],[hazardCenter.x+dx*.76,.25+level*.54,hazardCenter.z+dz*.76]);rock.rotation.y=((dx*13+dz*7)%4)*.08;landmarkGroup.add(rock)}}}
      const lavaMaterial=new THREE.MeshPhongMaterial({color:0xff5a19,emissive:0xff2600,emissiveIntensity:2.6,shininess:85});
      const crater=block(lavaMaterial,[1.35,.22,1.35],[hazardCenter.x,3.35,hazardCenter.z]);crater.userData.crater=true;landmarkGroup.add(crater);
      [[0,.45,3.05],[-.22,1.15,2.45],[-.42,1.9,1.78],[-.68,2.7,1.15],[-.95,3.55,.62]].forEach(([dx,dz,y],index)=>{const lava=block(lavaMaterial,[.62+index*.06,.16,.9],[hazardCenter.x+dx,y,hazardCenter.z+dz]);lava.rotation.y=-.2;lava.userData.lava=true;landmarkGroup.add(lava)});
      addFlame(hazardCenter.x,hazardCenter.z,.55,3.33);
    }
    if(kind==="wildfire"){
      [[-1.1,-1.1],[.4,-2.8],[1.8,-.7],[3.2,-2.6],[4.3,-.9],[2.2,-4.1]].forEach(([dx,dz],index)=>{const x=hazardCenter.x+dx,z=hazardCenter.z+dz;const trunk=block(darkWood,[.32,1.65,.32],[x,.8,z]);trunk.rotation.z=(index%2?1:-1)*.1;landmarkGroup.add(trunk,block(deadLeaf,[.9,.58,.9],[x,1.66,z]));addFlame(x,z,.65+index%3*.12,.08)});
      [[-1.8,.4],[-.4,.8],[1,.55]].forEach(([dx,dz],index)=>addFlame(hazardCenter.x+dx,hazardCenter.z+dz,.55+index*.09));
    }
    if(kind==="earthquake"){
      const cracked=new THREE.MeshBasicMaterial({color:0x302c29});[[-1.8,-.3,2.8,.13],[-.4,.3,2.1,.12],[.8,-.5,2.5,.13]].forEach(([dx,dz,length,width],index)=>{const crack=block(cracked,[width,.045,length],[hazardCenter.x+dx,.05,hazardCenter.z+dz]);crack.rotation.y=.3+index*.7;crack.userData.crack=true;landmarkGroup.add(crack)});
      [[-1.1,-.6],[0,0],[.9,.45],[1.5,-.5],[-.4,1.1]].forEach(([dx,dz],index)=>{const rubble=block(rubbleMaterial,[.72,.3+index*.09,.6],[hazardCenter.x+dx,.15,hazardCenter.z+dz]);rubble.rotation.set(index*.09,index*.65,index*.12);rubbleGroup.add(rubble)});
      const brokenWall=block(houseWall,[2.5,1.1,.34],[hazardCenter.x,.66,hazardCenter.z-1.2]);brokenWall.rotation.z=.25;landmarkGroup.add(brokenWall);
    }
    if(kind==="drought"||kind==="heatwave"){
      [[-1.8,-1],[.2,-2.2],[2,-.3]].forEach(([dx,dz],index)=>{const trunk=block(darkWood,[.3,1.7,.3],[hazardCenter.x+dx,.82,hazardCenter.z+dz]);trunk.rotation.z=(index-1)*.14;const branch=block(darkWood,[1.05,.18,.18],[hazardCenter.x+dx,.98,hazardCenter.z+dz]);branch.rotation.z=.55-index*.4;landmarkGroup.add(trunk,branch)});
    }
    if(kind==="landslide"){
      const soilA=new THREE.MeshLambertMaterial({color:0x876a48}),soilB=new THREE.MeshLambertMaterial({color:0x6e5942});
      for(let level=0;level<5;level++){for(let index=-2;index<=2;index++){const ledge=block((level+index)%2?soilA:soilB,[1.15,.48,1.05],[hazardCenter.x+index*.85,.24+level*.42,hazardCenter.z-2.2+level*.72]);ledge.rotation.z=(index%2)*.04;landmarkGroup.add(ledge)}}
      [[-1.5,-.5],[.1,.1],[1.4,-.2],[-.6,1.3],[1.8,1.5]].forEach(([dx,dz],index)=>{const rock=block(rubbleMaterial,[.55+index%2*.25,.48,.62],[hazardCenter.x+dx,.35+index*.16,hazardCenter.z+dz]);rock.rotation.set(index*.18,index*.52,index*.11);rock.userData.slide=true;rock.userData.baseX=rock.position.x;rock.userData.baseY=rock.position.y;rock.userData.baseZ=rock.position.z;landmarkGroup.add(rock)});
    }
    if(kind==="cold_wave"){
      const ice=new THREE.MeshPhongMaterial({color:0xd9f1f2,transparent:true,opacity:.82,shininess:95});
      [[-2,-1],[-.8,-2.1],[.7,-.5],[1.8,-2.6],[2.5,.4],[-2.6,1.3]].forEach(([dx,dz],index)=>{const patch=block(ice,[1.35,.07,1.05],[hazardCenter.x+dx,.11,hazardCenter.z+dz]);patch.rotation.y=index*.58;landmarkGroup.add(patch)});
    }
    if(kind==="transport"){
      const vehicleRed=new THREE.MeshLambertMaterial({color:0xa94732});const metal=new THREE.MeshLambertMaterial({color:0x42484a});const tyre=new THREE.MeshLambertMaterial({color:0x171918});const wreck=new THREE.Group();wreck.position.set(hazardCenter.x,.38,hazardCenter.z);wreck.rotation.y=-.55;wreck.rotation.z=.09;wreck.add(block(vehicleRed,[2.5,.72,1.15],[0,.46,0]),block(vehicleRed,[.85,.95,1.12],[-1.25,.58,0]),block(metal,[1.25,.14,1.05],[.55,.9,0]),block(tyre,[.42,.42,.22],[-.78,.12,.62]),block(tyre,[.42,.42,.22],[.82,.12,.62]));landmarkGroup.add(wreck);addFlame(hazardCenter.x+.8,hazardCenter.z-.15,.85);
    }
    if(kind==="chemical"||kind==="radiological"){
      const tankMaterial=new THREE.MeshLambertMaterial({color:0x9ca39b});const dangerMaterial=new THREE.MeshBasicMaterial({color:kind==="radiological"?0xc9e52b:0xe1b43a});
      [-1.35,1.35].forEach(dx=>{const beacon=block(dangerMaterial,[.72,.22,.08],[hazardCenter.x+dx,.95,hazardCenter.z+.64]);beacon.userData.beacon=true;landmarkGroup.add(block(tankMaterial,[1.25,1.8,1.25],[hazardCenter.x+dx,.9,hazardCenter.z]),beacon)});
      landmarkGroup.add(block(tankMaterial,[3.8,.2,.28],[hazardCenter.x,1.65,hazardCenter.z-.2]));
    }
    if(kind==="biological"){
      const tent=new THREE.MeshLambertMaterial({color:0xe9eee4});const medical=new THREE.MeshBasicMaterial({color:0xc84e47});[-1.5,1.5].forEach(dx=>{const vertical=block(medical,[.15,.65,.08],[hazardCenter.x+dx,.72,hazardCenter.z+.92]),horizontal=block(medical,[.62,.15,.08],[hazardCenter.x+dx,.72,hazardCenter.z+.92]);vertical.userData.beacon=true;horizontal.userData.beacon=true;landmarkGroup.add(block(tent,[2.1,1.25,1.8],[hazardCenter.x+dx,.62,hazardCenter.z]),vertical,horizontal)});
    }
    if(kind==="cyclone"){
      const debris=new THREE.MeshLambertMaterial({color:0x82664b});[[-1.5,-.6],[.2,.2],[1.7,-1.1],[.8,1.4]].forEach(([dx,dz],index)=>{const piece=block(debris,[1.2,.16,.34],[hazardCenter.x+dx,.6+index*.35,hazardCenter.z+dz]);piece.rotation.set(index*.2,index*.8,.35);piece.userData.debris=true;piece.userData.baseX=piece.position.x;piece.userData.baseY=piece.position.y;landmarkGroup.add(piece)});
    }
    if(kind==="tsunami"||kind==="storm_surge"){
      const foam=new THREE.MeshPhongMaterial({color:0xe5f6f3,transparent:true,opacity:.78,emissive:0x315d59,emissiveIntensity:.18});
      for(let index=0;index<6;index++){const crest=block(foam,[3.8,.18,.32],[0,.34,-10+index*3.6]);crest.userData.surge=true;crest.userData.baseY=crest.position.y;crest.userData.baseZ=crest.position.z;crest.userData.phase=index*.9;landmarkGroup.add(crest)}
    }
    const hazardCount=600;const hazardPositions=new Float32Array(hazardCount*3);
    for(let i=0;i<hazardCount;i++){const spread=kind==="volcano"?4:kind==="wildfire"?8:5;hazardPositions[i*3]=(Math.random()-.5)*spread+hazardCenter.x;hazardPositions[i*3+1]=(kind==="volcano"?3.2:0)+Math.random()*9;hazardPositions[i*3+2]=(Math.random()-.5)*spread+hazardCenter.z}
    const hazardGeometry=new THREE.BufferGeometry();hazardGeometry.setAttribute("position",new THREE.BufferAttribute(hazardPositions,3));
    const hazardMaterial=new THREE.PointsMaterial({color:caseStudy.hazardKind==="volcano"?0x5a5650:0x6c6a5e,size:.14,transparent:true,opacity:.55});
    const hazardParticles=new THREE.Points(hazardGeometry,hazardMaterial);scene.add(hazardParticles);
    const accentCount=360,accentPositions=new Float32Array(accentCount*3);for(let i=0;i<accentCount;i++){accentPositions[i*3]=hazardCenter.x+(Math.random()-.5)*6;accentPositions[i*3+1]=Math.random()*4;accentPositions[i*3+2]=hazardCenter.z+(Math.random()-.5)*6}
    const accentGeometry=new THREE.BufferGeometry();accentGeometry.setAttribute("position",new THREE.BufferAttribute(accentPositions,3));
    const accentColor=kind==="volcano"||kind==="wildfire"||kind==="transport"||kind==="heatwave"?0xff8a28:kind==="drought"||kind==="earthquake"||kind==="landslide"?0xd6b06c:kind==="chemical"||kind==="radiological"?0xb6df37:kind==="biological"?0xe86d61:kind==="cold_wave"?0xf0fbff:0xd9eeee;
    const accentMaterial=new THREE.PointsMaterial({color:accentColor,size:kind==="cyclone"?.08:.11,transparent:true,opacity:.75});const accentParticles=new THREE.Points(accentGeometry,accentMaterial);scene.add(accentParticles);
    const contaminationMaterial=new THREE.MeshBasicMaterial({color:caseStudy.hazardKind==="radiological"?0xc9e52b:0x8ab33f,transparent:true,opacity:.34,side:THREE.DoubleSide});
    const contamination=new THREE.Mesh(new THREE.CircleGeometry(3,40),contaminationMaterial);contamination.rotation.x=-Math.PI/2;contamination.position.set(hazardCenter.x,.08,hazardCenter.z);scene.add(contamination);
    const clearSky=new THREE.Color(0xa9c8bd), stormSky=new THREE.Color(0x536e6c), smokeSky=new THREE.Color(0x665f54),heatSky=new THREE.Color(0xd8b56d),coldSky=new THREE.Color(0xb9d3d6),targetSky=new THREE.Color();

    const onKeyDown = (event: KeyboardEvent) => { keysRef.current.add(event.key.toLowerCase()); if (event.key.toLowerCase() === "e") setChatOpen(true); };
    const onKeyUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp);
    let frame = 0; let lastNear = ""; let wasBlocked = false; let lastPositionSent = -10; const clock = new THREE.Clock();
    const resize = () => { const width=mount.clientWidth, height=mount.clientHeight; renderer.setSize(width,height,false); camera.aspect=width/height; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    const animate = () => {
      frame = requestAnimationFrame(animate); const dt = Math.min(clock.getDelta(), .04),time=clock.elapsedTime; const keys = keysRef.current;
      const dx = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      const dz = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
      const moving = dx !== 0 || dz !== 0;
      const activeRemoteIds = new Set(remotePlayersRef.current.map(remote => remote.actor.id));
      for (const [id, remote] of remoteAvatars) {
        if (activeRemoteIds.has(id)) continue;
        scene.remove(remote.object);
        if (remote.label) { (remote.label.material as THREE.SpriteMaterial).map?.dispose(); remote.label.material.dispose(); }
        remoteAvatars.delete(id);
      }
      remotePlayersRef.current.forEach(remote => {
        let rendered = remoteAvatars.get(remote.actor.id);
        if (!rendered) {
          const object = makeAvatar([0x2b8875, 0x273f5c]);
          const label = makePlayerLabel(remote.actor.alias);
          if (label) object.add(label);
          object.position.set(remote.position.x, .4, remote.position.z); object.rotation.y = remote.position.rotation;
          scene.add(object); rendered = { object, label }; remoteAvatars.set(remote.actor.id, rendered);
        }
        rendered.object.position.x = THREE.MathUtils.lerp(rendered.object.position.x, remote.position.x, .2);
        rendered.object.position.z = THREE.MathUtils.lerp(rendered.object.position.z, remote.position.z, .2);
        const rotationDelta = Math.atan2(Math.sin(remote.position.rotation-rendered.object.rotation.y), Math.cos(remote.position.rotation-rendered.object.rotation.y));
        rendered.object.rotation.y += rotationDelta * .2;
        rendered.object.position.y = .4 + (remote.position.moving ? Math.abs(Math.sin(time*11))*.035 : 0);
        const swing = remote.position.moving ? Math.sin(time*11)*.55 : 0;
        rendered.object.getObjectByName("leftArm")!.rotation.x=swing; rendered.object.getObjectByName("rightArm")!.rotation.x=-swing;
        rendered.object.getObjectByName("leftLeg")!.rotation.x=-swing; rendered.object.getObjectByName("rightLeg")!.rotation.x=swing;
      });
      if (moving) {
        const length = Math.hypot(dx,dz);
        const nextX = THREE.MathUtils.clamp(player.position.x + dx/length*4.2*dt,-11.5,11.5);
        const nextZ = THREE.MathUtils.clamp(player.position.z + dz/length*4.2*dt,-11.5,11.5);
        const currentRemoteDistance=remoteDistanceAt(player.position.x,player.position.z),nextRemoteDistance=remoteDistanceAt(nextX,nextZ);
        const escapingOverlap=currentRemoteDistance<.82&&nextRemoteDistance>currentRemoteDistance;
        const blocked = blockedEnvironmentAt(nextX,nextZ) || (collidesWithRemoteAvatar(nextX,nextZ) && !escapingOverlap);
        if (!blocked) { player.position.x=nextX; player.position.z=nextZ; }
        if (blocked && !wasBlocked) setHazardMessage(riverAt(nextX,nextZ) && !bridgeAt(nextX,nextZ) ? "El cauce no es transitable. Busca el puente señalizado." : fireZoneAt(nextX,nextZ) ? "Zona de fuego y calor extremo. No puedes avanzar." : contaminationAt(nextX,nextZ) ? "Zona contaminada. Mantén el perímetro de seguridad." : rubbleAt(nextX,nextZ) ? "Los escombros bloquean el paso. Busca otra ruta." : collidesWithAvatar(nextX,nextZ) ? "Hay otra persona aquí. Mantén distancia para conversar." : "No puedes atravesar una construcción.");
        if (!blocked && wasBlocked) setHazardMessage(null);
        wasBlocked=blocked;
        player.rotation.y = Math.atan2(dx,dz);
        const swing = Math.sin(clock.elapsedTime*11)*.55;
        player.getObjectByName("leftArm")!.rotation.x=swing; player.getObjectByName("rightArm")!.rotation.x=-swing;
        player.getObjectByName("leftLeg")!.rotation.x=-swing; player.getObjectByName("rightLeg")!.rotation.x=swing;
      }
      player.position.y = (bridgeAt(player.position.x,player.position.z) ? .48 : .4) + (moving ? Math.abs(Math.sin(clock.elapsedTime*11))*.035 : 0);
      if (time-lastPositionSent >= (moving ? .2 : 1.5)) {
        onPositionChange({ x: player.position.x, z: player.position.z, rotation: player.rotation.y, moving, visible: true });
        lastPositionSent=time;
      }
      const nearest = npcs.find(npc => npc.position.distanceTo(player.position) < 2.2)?.name || "";
      if (nearest !== lastNear) { lastNear=nearest; setNearPerson(nearest || null); }
      const state=visualRef.current;const hazard=state.visual;const interventionProgress=scenarioProgressRef.current;const elementCount=Math.max(1,scenario?.scenePlan?.elements.length??1);const activeMarkerIndex=Math.min(elementCount-1,Math.floor(interventionProgress*elementCount));interventionGroup.visible=Boolean(scenario);interventionMaterials.forEach(material=>{material.opacity=interventionProgress*.92});interventionMeshes.forEach(item=>{const elementIndex=Number(item.userData.elementIndex??0),elementStart=elementIndex/elementCount*.72,reveal=Math.max(0,Math.min(1,(interventionProgress-elementStart)*4));item.scale.y=THREE.MathUtils.lerp(item.scale.y,.18+.82*reveal,.12)});sceneMarkers.forEach((marker,index)=>{const elementStart=index/elementCount*.72,reveal=Math.max(0,Math.min(1,(interventionProgress-elementStart)*4)),material=marker.material as THREE.SpriteMaterial,targetOpacity=index===activeMarkerIndex?reveal*.96:0;material.opacity=THREE.MathUtils.lerp(material.opacity,targetOpacity,.18);marker.position.y=3.35+Math.sin(time*2+index)*.08});alertBeacons.forEach((beacon,index)=>{const pulse=.88+Math.max(0,Math.sin(time*3.4-Number(beacon.userData.phase)-index*.12))*.48*interventionProgress;beacon.scale.set(pulse,pulse,pulse);beacon.rotation.y+=dt*.9*interventionProgress});const quakeCycle=time%5.2,quakeEnvelope=quakeCycle<1.15?(1-quakeCycle/1.15)*Math.abs(Math.sin(quakeCycle*25)):0,quakePulse=kind==="earthquake"?hazard.shake*quakeEnvelope:0;const eruptionPulse=kind==="volcano"?.65+.35*Math.max(0,Math.sin(time*.82)):1;
      const targetWater=-.22+hazard.water*.78;water.position.y=THREE.MathUtils.lerp(water.position.y,targetWater+Math.sin(time*.8)*(.015+hazard.wind*.09),.035);water.scale.x=THREE.MathUtils.lerp(water.scale.x,1+hazard.water*.24+Math.sin(time*1.4)*hazard.water*.025,.03);
      floatingDebris.forEach((piece,index)=>{piece.position.z-=dt*Number(piece.userData.speed)*(1+hazard.water*2+hazard.wind);if(piece.position.z< -13)piece.position.z=13;piece.position.y=water.position.y+.2+Math.sin(time*2+index)*.035;piece.rotation.y+=dt*(.25+hazard.water)});
      rain.geometry.setDrawRange(0,Math.round(hazard.rain*rainCount));rain.visible=hazard.rain>.02;rain.rotation.z=hazard.wind*.34+Math.sin(time*.7)*hazard.wind*.06;rainMaterial.opacity=.2+hazard.rain*.7;
      worldTrees.forEach((tree,index)=>{const sway=kind==="cyclone"?hazard.wind*(.12+Math.sin(time*3+Number(tree.userData.phase))*.09):hazard.wind*.025*Math.sin(time*1.5+index);tree.rotation.z=THREE.MathUtils.lerp(tree.rotation.z,sway,.08);tree.rotation.x=Math.sin(time*2.2+index)*hazard.wind*.025});
      fireGroup.visible=hazard.fire>.1;flameGroups.forEach((flame,index)=>{const base=Number(flame.userData.baseScale??1),pulse=1+Math.sin(time*9+index)*.13;flame.scale.set(base*pulse,base*(.82+hazard.fire*.45*eruptionPulse+Math.sin(time*11+index)*.12),base*pulse);flame.rotation.z=Math.sin(time*5+index)*.08+hazard.wind*.16});
      landmarkGroup.children.forEach((item,index)=>{if(item.userData.lava)item.scale.y=.84+eruptionPulse*.24+Math.sin(time*3+index)*.09;if(item.userData.crater&&item instanceof THREE.Mesh){item.scale.setScalar(.93+eruptionPulse*.13);const material=item.material;if(material instanceof THREE.MeshPhongMaterial)material.emissiveIntensity=2.1+eruptionPulse*2.2}if(item.userData.crack)item.scale.x=1+quakePulse*(.8+index*.08);if(item.userData.beacon){const beaconPulse=.82+Math.max(0,Math.sin(time*4+index))*.55;item.scale.setScalar(beaconPulse)}if(item.userData.debris){item.rotation.y+=dt*(.8+hazard.wind*4);item.rotation.x+=dt*hazard.wind*1.6;item.position.x=Number(item.userData.baseX)+Math.sin(time*2+index)*hazard.wind*.75;item.position.y=Number(item.userData.baseY)+Math.sin(time*3.2+index)*hazard.wind*.28}if(item.userData.slide){const slide=(time*.42+index*.19)%1;item.position.x=Number(item.userData.baseX)+Math.sin(time*2+index)*hazard.shake*.18;item.position.y=Number(item.userData.baseY)-slide*hazard.shake*.22;item.position.z=Number(item.userData.baseZ)+slide*hazard.shake*1.35;item.rotation.x+=dt*hazard.shake*1.8}if(item.userData.surge){const travel=(time*(.45+hazard.water*.75)+Number(item.userData.phase))%3.6;item.position.z=Number(item.userData.baseZ)+travel;item.position.y=Number(item.userData.baseY)+Math.sin(time*2.4+index)*(.08+hazard.water*.16);item.scale.y=.8+hazard.water*.9}});
      rubbleGroup.visible=hazard.shake>.2;rubbleGroup.scale.setScalar(scenario?.kind==="clearance"?Math.max(.08,1-interventionProgress*.92):1);rubbleGroup.position.x=Math.sin(time*31)*quakePulse*.12;rubbleGroup.position.z=Math.cos(time*27)*quakePulse*.08;contamination.visible=hazard.contamination>.15;contaminationMaterial.opacity=.18+hazard.contamination*.28+Math.sin(time*2)*.04;contamination.scale.setScalar(.96+Math.sin(time*1.8)*hazard.contamination*.06);
      const particleFactor=Math.max(hazard.smoke,hazard.ash)*(kind==="volcano"?eruptionPulse:1);hazardParticles.visible=particleFactor>.05;hazardGeometry.setDrawRange(0,Math.round(particleFactor*hazardCount));hazardMaterial.opacity=.22+particleFactor*.5;hazardParticles.rotation.y+=kind==="cyclone"?dt*hazard.wind*.65:dt*hazard.wind*.05;
      const accentFactor=Math.max(hazard.fire,kind==="cyclone"||kind==="storm_surge"?hazard.wind*.8:0,kind==="tsunami"?hazard.water*.7:0,kind==="drought"||kind==="heatwave"?hazard.drought*.65:0,kind==="earthquake"?quakePulse:0,kind==="landslide"?hazard.shake*.6:0,kind==="chemical"||kind==="radiological"||kind==="biological"?hazard.contamination*.48:0);accentParticles.visible=accentFactor>.04;accentGeometry.setDrawRange(0,Math.round(accentFactor*accentCount));accentMaterial.opacity=.35+accentFactor*.58;
      targetSky.copy(clearSky).lerp(stormSky,Math.max(hazard.rain*.8,hazard.wind*.65)).lerp(smokeSky,Math.max(hazard.smoke,hazard.ash)*.72).lerp(heatSky,kind==="heatwave"?hazard.drought*.62:0).lerp(coldSky,kind==="cold_wave"?Math.max(hazard.rain,hazard.wind)*.55:0);(scene.background as THREE.Color).lerp(targetSky,.02);
      const severityColor={info:0xb6df37,watch:0xe0bd3d,warning:0xe38745,danger:0xd34f3f}[state.severity];warningMaterial.color.lerp(new THREE.Color(severityColor),.04);
      const positions = rain.geometry.attributes.position as THREE.BufferAttribute;
      for(let i=0;i<rainCount;i++){const fallSpeed=kind==="cold_wave"?1.8+hazard.wind*2:8+hazard.wind*4;let y=positions.getY(i)-dt*fallSpeed,x=positions.getX(i)+dt*hazard.wind*(kind==="cold_wave"?1.4:3);if(y<0)y=18;if(x>18)x=-18;positions.setXY(i,x,y)} positions.needsUpdate=true;
      const hazardAttribute=hazardGeometry.attributes.position as THREE.BufferAttribute;for(let i=0;i<hazardCount;i++){let y=hazardAttribute.getY(i)+dt*(.3+hazard.smoke*1.2),x=hazardAttribute.getX(i)+dt*hazard.wind*.45;if(y>(kind==="volcano"?12:9))y=kind==="volcano"?3.2:0;if(x>hazardCenter.x+7)x=hazardCenter.x-7;hazardAttribute.setXY(i,x,y)}hazardAttribute.needsUpdate=true;
      const accentAttribute=accentGeometry.attributes.position as THREE.BufferAttribute;for(let i=0;i<accentCount;i++){let x=accentAttribute.getX(i),y=accentAttribute.getY(i),z=accentAttribute.getZ(i);if(kind==="cyclone"||kind==="storm_surge"){const angle=dt*(1.2+hazard.wind*3),dx=x-hazardCenter.x,dz=z-hazardCenter.z;x=hazardCenter.x+dx*Math.cos(angle)-dz*Math.sin(angle);z=hazardCenter.z+dx*Math.sin(angle)+dz*Math.cos(angle);y+=dt*.18;if(y>6)y=.1}else if(kind==="tsunami"){z-=dt*(1.4+hazard.water*3);y=.18+Math.abs(Math.sin(time*3+i*.15))*hazard.water;if(z<hazardCenter.z-5)z=hazardCenter.z+5}else if(kind==="drought"||kind==="heatwave"){x+=dt*(kind==="heatwave"?.25:1.2+hazard.drought*2.5);y=kind==="heatwave"?.2+((time*.65+i*.017)%1)*3:.15+Math.abs(Math.sin(time*1.8+i))*.8;if(x>hazardCenter.x+4)x=hazardCenter.x-4}else if(kind==="landslide"){z+=dt*(.5+hazard.shake*1.8);y=.12+Math.abs(Math.sin(time*2+i))*.35;if(z>hazardCenter.z+4)z=hazardCenter.z-4}else if(kind==="earthquake"){x+=Math.sin(time*33+i)*quakePulse*.015;z+=Math.cos(time*29+i)*quakePulse*.015;y=.08+quakePulse*Math.abs(Math.sin(i))*1.2}else if(kind==="chemical"||kind==="radiological"||kind==="biological"){y=.12+Math.abs(Math.sin(time*.8+i*.2))*1.4;x+=Math.sin(time+i)*dt*.08}else{y+=dt*(.9+hazard.fire*2.2);x+=dt*hazard.wind*.7;if(y>6){y=.05;x=hazardCenter.x+(Math.random()-.5)*5;z=hazardCenter.z+(Math.random()-.5)*5}}accentAttribute.setXYZ(i,x,y,z)}accentAttribute.needsUpdate=true;
      houseMeshes.forEach((roofMesh,index)=>{roofMesh.rotation.z=Number(roofMesh.userData.baseRotation)+Math.sin(time*11+index)*quakePulse*.075+Math.sin(time*2+index)*hazard.wind*.018});
      if(scenario?.scenePlan?.actorMoves.length){const actorIndex={resident:0,brigade:1,merchant:2};scenario.scenePlan.actorMoves.forEach(move=>{const npc=npcs[actorIndex[move.actor]];if(npc){const target=new THREE.Vector3(move.destination.x,.4,move.destination.z);npc.object.position.lerpVectors(npc.position,target,interventionProgress);}})}else if(scenario&&(scenario.kind==="evacuation"||scenario.kind==="health")){const safeSpots=[new THREE.Vector3(-8.2,.4,6.7),new THREE.Vector3(-9,.4,5.5),new THREE.Vector3(-7.4,.4,5.4)];npcs.forEach((npc,index)=>{const origin=npc.position;const target=safeSpots[index];npc.object.position.lerpVectors(origin,target,interventionProgress);});}
      warningPosts.forEach((post,index)=>{post.scale.y=.88+Math.max(0,Math.sin(time*3.4+Number(post.userData.phase)))*.32;post.position.y=.52+(post.scale.y-1)*.18});
      const cameraFocus=scenario&&interventionProgress>.03?interventionFocus:new THREE.Vector3(player.position.x,1,player.position.z);const cameraTarget=new THREE.Vector3(cameraFocus.x+7.5,cameraFocus.y+7.2,cameraFocus.z+9.5);if(quakePulse>.01){cameraTarget.x+=Math.sin(time*37)*quakePulse*.25;cameraTarget.y+=Math.cos(time*31)*quakePulse*.16}camera.position.lerp(cameraTarget,.07); camera.lookAt(cameraFocus);
      renderer.render(scene,camera);
    }; animate();
    return () => { onPositionChange({ x: player.position.x, z: player.position.z, rotation: player.rotation.y, moving: false, visible: false }); cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("keydown",onKeyDown); window.removeEventListener("keyup",onKeyUp); remoteAvatars.forEach(remote=>{if(remote.label){(remote.label.material as THREE.SpriteMaterial).map?.dispose();remote.label.material.dispose()}});sceneMarkers.forEach(marker=>{(marker.material as THREE.SpriteMaterial).map?.dispose();marker.material.dispose()});renderer.dispose(); rainGeometry.dispose(); hazardGeometry.dispose();accentGeometry.dispose(); mount.removeChild(renderer.domElement); };
  }, [caseStudy.hazardKind, caseStudy.visual.drought, onPositionChange, playerSpawn, scenario]);

  const move = (key: string, pressed: boolean) => pressed ? keysRef.current.add(key) : keysRef.current.delete(key);
  const send = (event: FormEvent) => { event.preventDefault(); const text=chatText.trim(); if(!text)return; setMessages(items=>[...items,{alias,text}]); setChatText(""); };
  const sceneElements=scenario?.scenePlan?.elements??[];
  const activeSceneElement=sceneElements.length?Math.min(sceneElements.length-1,Math.floor(scenarioProgress/Math.max(1,100/sceneElements.length))):-1;
  const focusedSceneElement=activeSceneElement>=0?sceneElements[activeSceneElement]:null;
  return <main className="explorer">
    <div ref={mountRef} className="world-canvas" />
    <header className="explorer-top"><button onClick={onBack}>← Territorio</button><div><b>KUSKA</b><span>{caseStudy.country.toUpperCase()} · {scenario?"ESCENARIO DE DECISIÓN":"SIMULACIÓN EN VIVO"}</span></div><button onClick={onOpenMission}>{scenario?"Revisar decisión":"Mesa de acuerdos"} →</button></header>
    <section className="player-card"><span className="player-face">▦</span><div><small>ESTÁS AQUÍ COMO</small><b>{alias}</b><p>{role}</p></div></section>
    {scenario?<section className="scenario-result" aria-live="polite">
      <header><div><small>{scenario.directorSource==="openai"?"ESCENA DIRIGIDA POR IA":"ESCENA DE CONTINGENCIA"} · NO PREDICTIVA</small><h2>{scenario.title}</h2></div><span>{scenarioProgress}%</span></header>
      <details className="scenario-decision" open><summary>Decisión aplicada <em>Mostrar / ocultar</em></summary><p>{scenario.proposalText}</p></details>
      <ol><li className={scenarioPhase==="before"?"active":"done"}><i/>Antes</li><li className={scenarioPhase==="action"?"active":scenarioPhase==="after"?"done":""}><i/>Ejecución</li><li className={scenarioPhase==="after"?"active":""}><i/>Resultado</li></ol>
      <div className="scenario-track"><i style={{width:`${scenarioProgress}%`}}/></div>
      <p className="scenario-action">{scenarioPhase==="before"?"Registrando el estado inicial del territorio…":scenarioPhase==="action"?scenario.expectedBenefit:"Escenario completado. Revisa el beneficio y el riesgo que permanece."}</p>
      {focusedSceneElement&&<section className="scenario-scene-map"><div className="scenario-map-heading"><small>DECISIÓN → TERRITORIO</small><span>{activeSceneElement+1} de {sceneElements.length}</span></div><p>La etiqueta visible señala dónde aparece esta acción.</p><div className="scenario-plan-focus" data-scene-type={focusedSceneElement.type}><i>{activeSceneElement+1}</i><span><b>{sceneElementIcons[focusedSceneElement.type]??"·"} {focusedSceneElement.label}</b><small>{sceneElementDescriptions[focusedSceneElement.type]}</small></span></div>{sceneElements.length>1&&<details className="scenario-plan-details"><summary>Ver las {sceneElements.length} acciones vinculadas</summary><div className="scenario-plan-elements">{sceneElements.map((element,index)=><div className={index===activeSceneElement?"active":index<activeSceneElement?"done":""} data-scene-type={element.type} key={`${element.type}-${index}`}><i>{index+1}</i><span><b>{sceneElementIcons[element.type]??"·"} {element.label}</b></span></div>)}</div></details>}</section>}
      <div className="scenario-effects"><span><b>−{Math.round(scenario.exposureReductionPct*scenarioProgress/100)}%</b> exposición estimada</span><span><b>−{Math.round(scenario.physicalChangePct*scenarioProgress/100)}%</b> intensidad visual</span></div>
      <p className="scenario-risk"><b>Riesgo pendiente</b>{scenario.remainingRisk}</p><small className="scenario-assumption">Supuesto: {scenario.assumption}</small><div className="scenario-actions"><button onClick={onOpenMission}>Revisar decisión</button><button onClick={onClearScenario}>Volver al estado actual</button></div>
    </section>:<section className={`world-objective severity-${caseStudy.severity}`}><small>{caseStudy.dataState==="live"?"● EN VIVO":"ACTUALIZADO"} · {HAZARD_ICONS[caseStudy.hazardKind]} {caseStudy.hazardLabel.toUpperCase()} · {caseStudy.source}</small><b>{caseStudy.eventTitle}</b><span className={`objective-origin origin-${caseStudy.origin}`}>{caseStudy.originLabel} · última señal {formatActivityDate(caseStudy.lastActivityAt)}</span><p>{caseStudy.mission}. Camina para observar cómo responde el territorio.</p><a href={caseStudy.eventUrl} target="_blank" rel="noreferrer">Ver fuente ↗</a></section>}
    <div className="world-legend"><span><i className="human-dot"/> Tú</span><span><i className="remote-dot"/> {remotePlayers.length} en vivo</span><span><i className="demo-dot"/> Participante demo</span><span><i className="risk-dot"/> Zona de riesgo</span></div>
    <aside className="weather-visual-key"><small>{caseStudy.dataState==="live"?"● SEÑAL EN VIVO":"SEÑAL RECIENTE"} → MUNDO</small><h3>{caseStudy.location}, {caseStudy.country}</h3><span className="visual-updated">Actualizada {formatActivityDate(caseStudy.lastActivityAt)}</span><span className="motion-status"><i/>{motionLabels[caseStudy.hazardKind]}</span>{caseStudy.metrics.slice(0,3).map(metric=><div key={metric.label}><span>{metric.label} <b>{metric.value}</b></span><i><em style={{width:`${Math.min(100,metric.level)}%`}}/></i></div>)}<p>{hazardVisualHelp[caseStudy.hazardKind]}</p></aside>
    {nearPerson && <button className="talk-prompt" onClick={()=>setChatOpen(true)}>E · Hablar con {nearPerson}</button>}
    {hazardMessage && <div className="physics-warning">⚠ {hazardMessage}</div>}
    <button className="floating-news" onClick={()=>setNewsOpen(value=>!value)}>Contexto y noticias <b>{newsFeed?newsFeed.articles.length:"…"}</b></button>
    <button className="floating-chat" onClick={()=>setChatOpen(value=>!value)}>Conversación <b>{messages.length}</b></button>
    {newsOpen&&<aside className="news-drawer"><header><div><small>CONTEXTO DEL CASO</small><b>{caseStudy.hazardLabel} · {caseStudy.country}</b></div><button onClick={()=>setNewsOpen(false)}>×</button></header><section className="official-context"><small>FUENTE OFICIAL · {caseStudy.source}</small><p>{caseStudy.details}</p><a href={caseStudy.eventUrl} target="_blank" rel="noreferrer">Abrir reporte oficial ↗</a></section><div className="news-heading"><div><small>COBERTURA PERIODÍSTICA</small><b>Qué están reportando los medios</b></div>{newsFeed&&!newsFeed.unavailable&&<span>{newsFeed.articles.length} resultados</span>}</div><section className="news-list">{!newsFeed&&<p className="news-state">Buscando cobertura relacionada…</p>}{newsFeed?.articles.map(article=><a key={article.id} href={article.url} target="_blank" rel="noreferrer">{article.imageUrl&&<span className="news-thumb" style={{backgroundImage:`url("${article.imageUrl.replace(/"/g,"")}")`}}/>}<span><small>{article.domain}{article.publishedAt?` · ${new Intl.DateTimeFormat("es-PE",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(article.publishedAt))}`:""}</small><b>{article.title}</b><em>Abrir medio ↗</em></span></a>)}{newsFeed&&newsFeed.articles.length===0&&<p className="news-state">{newsFeed.note??"No se encontró cobertura suficientemente relacionada con este caso."}</p>}</section>{newsFeed&&<footer><span>Noticias indexadas por {newsFeed.source}. No cambian la severidad oficial.</span><a href={newsFeed.searchUrl} target="_blank" rel="noreferrer">Ver búsqueda completa ↗</a></footer>}</aside>}
    {chatOpen && <aside className="world-chat"><div><b>Conversación del lugar</b><button onClick={()=>setChatOpen(false)}>×</button></div><small>Los participantes demo están identificados.</small><section>{messages.map((message,index)=><p key={`${message.alias}-${index}`}><b>{message.alias}</b>{message.text}</p>)}</section><form onSubmit={send}><input value={chatText} onChange={e=>setChatText(e.target.value)} placeholder="Escribe a las personas cercanas…" maxLength={180}/><button>↑</button></form></aside>}
    <div className="move-help"><span>W</span><div><span>A</span><span>S</span><span>D</span></div><small>CAMINAR</small></div>
    <div className="mobile-pad"><button onPointerDown={()=>move("w",true)} onPointerUp={()=>move("w",false)}>↑</button><div><button onPointerDown={()=>move("a",true)} onPointerUp={()=>move("a",false)}>←</button><button onPointerDown={()=>move("s",true)} onPointerUp={()=>move("s",false)}>↓</button><button onPointerDown={()=>move("d",true)} onPointerUp={()=>move("d",false)}>→</button></div></div>
  </main>;
}
