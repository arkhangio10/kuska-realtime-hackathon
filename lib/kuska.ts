import { z } from "zod";
import { evidenceBundleSchema } from "./evidence";

export const MISSION_ID = "kuska-live-mission";
export const CHANNEL_ID = "kuska:mission:live";
export const roles = ["Vecina de la zona", "Comerciante local", "Brigadista comunitario", "Especialista técnico", "Personal de salud", "Coordinador municipal"] as const;

export const actorSchema=z.object({id:z.string().min(1).max(80),alias:z.string().min(1).max(50),role:z.string().min(1).max(80),kind:z.enum(["human","agent","demo-agent"])});
export type Actor=z.infer<typeof actorSchema>;
export type Vote = "agree" | "concern" | "pass";
export type Proposal = { id: string; text: string; author: Actor; createdAt: string; bridge?: boolean; basedOn?: string[]; generation?: "openai" | "fallback" };
export type VoteRecord = { proposalId: string; actorId: string; value: Vote };

export const eventSchema = z.object({schema:z.literal(1),eventId:z.string().min(1),kind:z.enum(["proposal.created","vote.cast","bridge.created","action-plan.created","reaction.pulse","chat.created"]),missionId:z.string().min(1).max(100),createdAt:z.string()});
export const proposalInput = z.string().trim().min(12,"Escribe al menos 12 caracteres.").max(280,"Máximo 280 caracteres.");

export const bridgeSchema=z.object({
  bridge:z.string().min(12).max(300),
  rationale:z.string().min(12).max(500),
  sharedInterests:z.array(z.string().min(2).max(100)).min(2).max(4),
  unresolvedRisks:z.array(z.string().min(2).max(160)).max(4),
  basedOnProposalIds:z.array(z.string().min(1).max(80)).min(2).max(6),
  evidenceUsed:z.array(z.object({evidenceId:z.string().min(1).max(80),fact:z.string().min(2).max(220),source:z.string().min(2).max(100),sourceUrl:z.string().min(8).max(500),observedAt:z.string().max(50),reliability:z.enum(["high","medium","low"])})).min(1).max(6),
  assumptions:z.array(z.string().min(2).max(160)).max(4),
  unknowns:z.array(z.string().min(2).max(180)).max(5),
  tradeoffs:z.array(z.object({benefit:z.string().min(2).max(180),costOrRisk:z.string().min(2).max(180),affectedGroup:z.string().min(2).max(100)})).min(1).max(4),
  rejectionConditions:z.array(z.string().min(2).max(180)).max(4),
  nextSteps:z.array(z.object({action:z.string().min(2).max(180),possibleOwner:z.string().min(2).max(100),horizon:z.string().min(2).max(60),successSignal:z.string().min(2).max(160)})).min(1).max(4),
  solutionOptions:z.array(z.object({
    id:z.string().min(3).max(40),
    title:z.string().min(5).max(90),
    summary:z.string().min(20).max(300),
    communityBasis:z.string().min(12).max(260),
    basedOnProposalIds:z.array(z.string().min(1).max(80)).min(1).max(6),
    evidenceIds:z.array(z.string().min(1).max(80)).min(1).max(5),
    actionSteps:z.array(z.object({action:z.string().min(5).max(180),possibleOwner:z.string().min(2).max(100),horizon:z.string().min(2).max(60)})).min(2).max(4),
    benefits:z.array(z.string().min(5).max(160)).min(1).max(3),
    risks:z.array(z.string().min(5).max(160)).min(1).max(3),
    requirements:z.array(z.string().min(5).max(160)).min(1).max(4),
    feasibility:z.enum(["low","medium","high"]),
    confidence:z.enum(["low","medium","high"]),
  })).min(3).max(4),
  recommendedSolutionId:z.string().min(3).max(40),
  confidence:z.enum(["low","medium","high"]),
});
export type BridgeResult=z.infer<typeof bridgeSchema>;

export const caseContextSchema=z.object({id:z.string().min(1).max(100),country:z.string().min(1).max(80),location:z.string().min(1).max(100),lat:z.number().min(-90).max(90),lon:z.number().min(-180).max(180),hazardKind:z.string().min(1).max(40),hazardLabel:z.string().min(1).max(80),eventTitle:z.string().min(1).max(240),details:z.string().max(2400),eventUrl:z.string().url(),source:z.string().min(1).max(50),eventDate:z.string().max(60),lastActivityAt:z.string().max(60),dataState:z.enum(["live","recent","preventive"]),severity:z.enum(["info","watch","warning","danger"]),metrics:z.array(z.object({label:z.string().max(80),value:z.string().max(80),level:z.number().min(0).max(100)})).max(12)});
const proposalContextSchema=z.object({id:z.string().min(1).max(80),text:proposalInput,author:actorSchema});
const voteSchema=z.object({proposalId:z.string().min(1).max(80),actorId:z.string().min(1).max(80),value:z.enum(["agree","concern","pass"])});
const chatContextSchema=z.object({alias:z.string().min(1).max(50),text:z.string().min(1).max(180),kind:z.enum(["human","demo-agent"]).optional()});
export const bridgeRequestSchema=z.object({caseStudy:caseContextSchema,proposals:z.array(proposalContextSchema).min(2).max(20),votes:z.array(voteSchema).max(240),participants:z.array(actorSchema).min(1).max(50),evidenceBundle:evidenceBundleSchema,chat:z.array(chatContextSchema).max(20).default([]),requesterId:z.string().max(80).optional()});
export type BridgeRequest=z.infer<typeof bridgeRequestSchema>;

export function dedupeVotes(votes:VoteRecord[]){const unique=new Map<string,VoteRecord>();for(const vote of votes)unique.set(`${vote.proposalId}:${vote.actorId}`,vote);return [...unique.values()]}
export function score(votes:VoteRecord[],participants:number){const unique=dedupeVotes(votes);const relevant=unique.filter(v=>v.value!=="pass");const agree=relevant.filter(v=>v.value==="agree").length;const support=relevant.length?agree/relevant.length:0;const factor=Math.min(1,new Set(unique.map(v=>v.actorId)).size/Math.max(participants,1));return Math.round((support*.7+factor*.3)*100)}
export function proposalTallies(proposals:Pick<Proposal,"id">[],votes:VoteRecord[]){const unique=dedupeVotes(votes);return proposals.map(proposal=>{const proposalVotes=unique.filter(vote=>vote.proposalId===proposal.id);return{proposalId:proposal.id,agree:proposalVotes.filter(v=>v.value==="agree").length,concern:proposalVotes.filter(v=>v.value==="concern").length,pass:proposalVotes.filter(v=>v.value==="pass").length}})}
export const wordCount=(text:string)=>text.trim()?text.trim().split(/\s+/u).length:0;
export function hasCompleteSentence(text:string){
  const value=text.trim();
  return value.length>0&&/[.!?…]["'”’)}\]]?$/u.test(value);
}

export const demoActors:Actor[]=[
  {id:"demo-ana",alias:"Ana M.",role:"Vecina de la zona",kind:"demo-agent"},
  {id:"demo-diego",alias:"Diego R.",role:"Comerciante local",kind:"demo-agent"},
  {id:"demo-luz",alias:"Luz V.",role:"Brigadista comunitario",kind:"demo-agent"},
  {id:"demo-ines",alias:"Inés T.",role:"Especialista técnico",kind:"demo-agent"},
  {id:"demo-mateo",alias:"Mateo C.",role:"Coordinador municipal",kind:"demo-agent"},
];
export const seedProposals:Proposal[]=[
  {id:"p-rutas",text:"Acordemos rutas seguras señalizadas y una red vecinal para avisar antes de que aumente el riesgo.",author:demoActors[0],createdAt:"2026-08-08T12:00:00Z"},
  {id:"p-comercio",text:"Protejamos el mercado con un protocolo de cierre temprano y un punto de almacenamiento temporal.",author:demoActors[1],createdAt:"2026-08-08T12:01:00Z"},
  {id:"p-salud",text:"Preparemos un listado anónimo de hogares con prioridad sanitaria y brigadas por sector para la evacuación.",author:demoActors[2],createdAt:"2026-08-08T12:02:00Z"},
];
export const seedVotes:VoteRecord[]=[{proposalId:"p-rutas",actorId:"demo-ana",value:"agree"},{proposalId:"p-comercio",actorId:"demo-diego",value:"agree"},{proposalId:"p-salud",actorId:"demo-luz",value:"agree"},{proposalId:"p-rutas",actorId:"demo-diego",value:"concern"}];
