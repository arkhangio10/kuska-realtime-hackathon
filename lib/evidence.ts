import { z } from "zod";

export const evidenceItemSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["official", "humanitarian", "media", "community", "derived"]),
  title: z.string().min(2).max(180),
  fact: z.string().min(2).max(500),
  source: z.string().min(2).max(100),
  sourceUrl: z.string().url(),
  observedAt: z.string().max(60),
  reliability: z.enum(["high", "medium", "low"]),
  freshness: z.enum(["live", "recent", "historical", "unknown"]),
  geography: z.string().max(140),
});

export const evidenceBundleSchema = z.object({
  caseId: z.string().min(1).max(100),
  generatedAt: z.string(),
  items: z.array(evidenceItemSchema).min(1).max(30),
  unknowns: z.array(z.string().min(2).max(180)).max(10),
  unavailableSources: z.array(z.string().min(1).max(100)).max(10),
});

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type EvidenceBundle = z.infer<typeof evidenceBundleSchema>;

export function evidenceId(prefix: string, value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}
