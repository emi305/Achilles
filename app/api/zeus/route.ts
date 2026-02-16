import { NextResponse } from "next/server";
import type { ZeusContext } from "../../lib/types";

export const runtime = "nodejs";

const API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";
const GREETING_REGEX = /^(hi|hello|hey|yo|sup|what's up|what’s up)\b/i;

type ZeusRequest = {
  message?: string;
  firstUserMessage?: boolean;
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
    const firstUserMessage = Boolean(body?.firstUserMessage);
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

    const shouldAddGreeting = firstUserMessage && GREETING_REGEX.test(message);
    const greetingInstruction = shouldAddGreeting
      ? "The user's first message is a short greeting. Start with 1-2 warm, grand Zeus-style sentences, then continue directly into the required structured plan."
      : "Do not add ceremonial introductions. Go straight into the required structured plan.";

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
            content: [
              "You are Zeus, an expert COMLEX Level 2 study coach.",
              "Use ONLY the provided context JSON (rows, rankings, topFive). Do not invent data.",
              "If a requested metric is missing, explicitly say it is unavailable and tell the user what to upload.",
              "You must be operational, not generic. Focus on execution today.",
              greetingInstruction,
              "",
              "Always output these sections in this order:",
              "1) Today (exact plan)",
              "2) This Week",
              "3) Focus Areas (from context top priorities)",
              "4) Tracking Targets",
              "",
              "Hard requirements for every answer:",
              "- Include exact question counts (for example, total daily Q target and per-block Q counts).",
              "- Include exact time blocks in minutes.",
              "- Include explicit review rules: review incorrect + guessed + flagged.",
              "- Include concrete deliverables: flashcard target and recurring-miss log target.",
              "- Include patch + retest loop: patch gap then short targeted re-test set.",
              "- Use ROI/PROI/Avg % Correct only to decide which categories get more question volume.",
              "",
              "Default coaching framework (adapt numbers to user context):",
              "- Qbank block: 2 timed sets of 20-25 questions each in top priority categories.",
              "- Review block: deep review of every incorrect/guessed/flagged question.",
              "- Patch block: 60-90 min targeted content only for recurring misses.",
              "- Retest block: 10-15 targeted questions on patched topics the same day.",
              "",
              "Weekly split guidance:",
              "- 70-80% of time/questions = Qbank + review.",
              "- 20-30% = targeted patching.",
              "",
              "Tone: direct, specific, coach-like. Prefer bullets. Keep concise.",
            ].join("\\n"),
          },
          {
            role: "user",
            content: `User question:\n${message}\n\nContext JSON:\n${JSON.stringify(context)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return safeErrorResponse(500, "Zeus couldn't respond. Try again.", "ZEUS_REQUEST_FAILED");
    }

    const json = (await response.json()) as OpenAIChatResponse;
    const reply = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!reply) {
      return safeErrorResponse(500, "Zeus couldn't respond. Try again.", "ZEUS_EMPTY_REPLY");
    }

    return NextResponse.json({ reply }, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[zeus] failed:", error);
    }
    return safeErrorResponse(500, "Zeus couldn't respond. Try again.", "ZEUS_FAILED");
  }
}
