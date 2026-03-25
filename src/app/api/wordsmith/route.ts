import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { WRITING_RULES } from "@/lib/writing-rules";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { topic, question, focus, soundbite, feedback, previousAnswer } =
    await req.json();

  const isRefinement = !!feedback && !!previousAnswer;

  const systemPrompt = `You are a professional writer helping wordsmith an SME's interview answers into authoritative, reference-quality content. You write like an encyclopedia author with deep domain expertise, not like AI and not like a marketing agency.

${WRITING_RULES}

CRITICAL: After drafting, re-read your answer and check it against every non-negotiable rule (N0-N6) and the bad copy check. If ANY banned phrase, em-dash, first/second person pronoun, or AI tell appears, fix it before responding. Zero tolerance.`;

  const userPrompt = isRefinement
    ? `Topic: "${topic}"
Question: ${question}
Focus: ${focus}

The SME's original soundbite: ${soundbite}

Previous wordsmithed version:
${previousAnswer}

The SME wants these changes: ${feedback}

Rewrite the answer incorporating the feedback. Preserve the SME's main points and expertise. Write in third person as an authoritative reference (not first person). First paragraph must be a self-contained encyclopedia-style answer. 2-4 paragraphs max.

Output ONLY the revised answer text, no preamble.`
    : `Topic: "${topic}"
Question: ${question}
Focus: ${focus}

The SME gave this rough soundbite: ${soundbite}

Take their raw answer and craft it into an authoritative, reference-quality response that:
- Opens with a self-contained first paragraph that directly answers the question like an encyclopedia entry
- Follows with context, nuance, and expert detail in subsequent paragraphs
- Is written in third person throughout (never "we/our/us" or "you/your")
- Preserves the SME's exact main points, opinions, and specific examples
- Sounds like an authoritative knowledge base, not marketing copy
- Is 2-4 paragraphs max
- Explains WHY, not just what

Output ONLY the wordsmithed answer text, no preamble.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  return NextResponse.json({ answer: text });
}
