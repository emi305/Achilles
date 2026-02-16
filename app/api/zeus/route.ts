import { NextResponse } from "next/server";
import type { ZeusContext } from "../../lib/types";

export const runtime = "nodejs";

const API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";

type ZeusRequest = {
  message?: string;
  context?: ZeusContext;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function safeErrorResponse(status: number, message: string, error?: string) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ZeusRequest;
    const message = body?.message?.trim();
    const context = body?.context;

    if (!message || !context) {
      return safeErrorResponse(400, "Missing message or context.");
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return safeErrorResponse(
        500,
        "AI extraction is not configured. Add OPENAI_API_KEY to .env.local and restart npm run dev.",
        "EXTRACTION_NOT_CONFIGURED",
      );
    }

    const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are Zeus, an expert COMLEX Level 2 study coach. Use ONLY the provided context data. If a requested detail is missing from context, say it is unavailable and suggest uploading additional data. Give concise, actionable guidance in plain language using short bullet points. Prioritize high-weight categories, low Avg % Correct, high ROI, and high PROI when available.",
          },
          {
            role: "user",
            content: `User question:\n${message}\n\nContext JSON:\n${JSON.stringify(context)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return safeErrorResponse(500, "Zeus couldn’t respond. Try again.", "ZEUS_REQUEST_FAILED");
    }

    const json = (await response.json()) as OpenAIChatResponse;
    const reply = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!reply) {
      return safeErrorResponse(500, "Zeus couldn’t respond. Try again.", "ZEUS_EMPTY_REPLY");
    }

    return NextResponse.json({ reply }, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[zeus] failed:", error);
    }
    return safeErrorResponse(500, "Zeus couldn’t respond. Try again.", "ZEUS_FAILED");
  }
}
