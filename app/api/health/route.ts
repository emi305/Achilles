import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
  const model = process.env.OPENAI_MODEL ?? null;

  return NextResponse.json({
    ok: true,
    hasOpenAIKey,
    model,
    runtime: "nodejs",
  });
}
