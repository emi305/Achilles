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

function stripExplicitDurations(text: string): string {
  const withoutDurations = text
    .replace(/\b\d+\s*(?:-|to)\s*\d+\s*(?:minutes?|mins?|min|hours?|hrs?|hr)\b/gi, "timed block")
    .replace(/\b\d+(?:\.\d+)?\s*(?:minutes?|mins?|min|hours?|hrs?|hr)\b/gi, "timed")
    .replace(/\b(?:minutes?|mins?|min|hours?|hrs?|hr)\b/gi, "timed");

  return withoutDurations
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

    const shouldAddGreeting = firstUserMessage || GREETING_REGEX.test(message);
    const asksWeeklyPlan = /\b(week|weekly|7[- ]?day)\b/i.test(message);
    const examInstruction =
      context.exam === "usmle_step2"
        ? "User is preparing for USMLE Step 2 CK. Use Disciplines, Systems, and Physician Tasks language. Do not use COMLEX terms like competency domain. Use Medicine (not Internal Medicine)."
        : "User is preparing for COMLEX 2. Use Discipline, Competency Domain, and Clinical Presentation language. Mention OMM only when present in context.";
    const greetingInstruction = shouldAddGreeting
      ? "Start with 1-2 warm, grand Zeus-style lines, then continue directly into the required structured plan."
      : "Do not add ceremonial introductions. Go straight into the required structured plan.";
    const weeklyInstruction = asksWeeklyPlan
      ? "For 'This Week', provide a concrete 7-day schedule with daily question and review targets."
      : "For 'This Week', provide a concise weekly pattern with explicit daily question and review targets.";

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
              "You are Zeus, an expert medical board study coach.",
              "Use ONLY the provided context JSON (rows, rankings, topFive). Do not invent data.",
              examInstruction,
              "If a requested metric is missing, explicitly say it is unavailable and tell the user what to upload.",
              "You must be operational, not generic. Focus on execution today.",
              "Output MUST be valid Markdown.",
              "Use this exact structure and order:",
              "1) Opening line (1 sentence max, Zeus voice)",
              "2) blank line",
              "3) ## Today",
              "4) bullet lines only",
              "5) blank line",
              "6) ## This Week",
              "7) bullet lines only",
              "8) blank line",
              "9) ## Focus Areas",
              "10) bullet lines only",
              "11) blank line",
              "12) ## Tracking Targets",
              "13) bullet lines only",
              "Every bullet must start with '- ' and be on its own line.",
              "Do not output run-on paragraphs. No inline numbered chains like '1) ... 2) ...'.",
              "Keep each line under ~120 characters; split long points into extra bullet lines.",
              greetingInstruction,
              weeklyInstruction,
              "Do not include any explicit time durations. Never mention minutes/hours.",
              "Use 'timed' or 'timed block' phrasing instead of duration values.",
              "",
              "Hard requirements for every answer:",
              "- Include exact question counts (for example, total daily Q target and per-block Q counts).",
              "- Do not include minutes/hours anywhere in the response.",
              "- Include explicit review rules: review incorrect + guessed + flagged.",
              "- Include concrete deliverables: flashcard target and recurring-miss log target.",
              "- Include patch + retest loop: patch gap then short targeted re-test set.",
              "- Use ROI/PROI/Avg % Correct only to decide which categories get more question volume.",
              "- Use at most 1-2 rank callouts per category.",
              "",
              "Default coaching framework (adapt numbers to user context):",
              "- Qbank block: 2 timed sets of 25-40 questions each in top priority categories.",
              "- Review block: deep review of every incorrect/guessed/flagged question.",
              "- Patch block: targeted review for recurring misses.",
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
    const rawReply = (json.choices?.[0]?.message?.content ?? "").trim();
    const reply = stripExplicitDurations(rawReply);
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
