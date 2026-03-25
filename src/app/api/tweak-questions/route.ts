import Anthropic from "@anthropic-ai/sdk";
import { QUESTIONS } from "@/lib/questions";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { topic } = await req.json();

  const questionList = QUESTIONS.map(
    (q) => `${q.number}. ${q.template}\nFocus: ${q.focus}`
  ).join("\n\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `You are helping prepare an SME interview about "${topic}".

Below are 20 universal interview questions. Rewrite each question so it specifically relates to "${topic}" while preserving the original intent and focus of each question.

Keep the same numbering. For each question, output ONLY:
- The rewritten question text
- A short "Focus:" line (rewritten for the topic)

Do NOT add any preamble or explanation. Output valid JSON as an array of objects with keys: "number", "question", "focus".

Here are the original questions:

${questionList}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const tweaked = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return NextResponse.json({ tweaked });
  } catch {
    return NextResponse.json({ error: "Failed to parse tweaked questions", raw: text }, { status: 500 });
  }
}
