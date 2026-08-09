import { NextResponse } from "next/server";
import { z } from "zod";
import { caseContextSchema } from "@/lib/kuska";
import { buildEvidenceBundle } from "@/lib/evidence-server";

const articleSchema = z.object({ id: z.string().max(100), title: z.string().max(220), url: z.string().url(), domain: z.string().max(80), publishedAt: z.string().max(60), imageUrl: z.string().url().optional(), language: z.string().max(30).optional(), sourceCountry: z.string().max(50).optional() });
const requestSchema = z.object({ caseStudy: caseContextSchema, news: z.array(articleSchema).max(12).default([]) });

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "El caso o las noticias no son válidos.", issues: parsed.error.issues.slice(0, 8) }, { status: 400 });
  const bundle = await buildEvidenceBundle(parsed.data.caseStudy, parsed.data.news);
  return NextResponse.json(bundle, { headers: { "Cache-Control": "private, max-age=60" } });
}
