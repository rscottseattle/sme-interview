import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { WRITING_RULES } from "@/lib/writing-rules";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { topic, question, focus, soundbite, feedback, previousAnswer } =
    await req.json();

  const isRefinement = !!feedback && !!previousAnswer;

  const systemPrompt = `You are a professional writer helping wordsmith an SME's interview answers. You write copy that sounds human, not like AI and not like a marketing agency.

${WRITING_RULES}

CRITICAL: After drafting, re-read your answer and check it against every non-negotiable rule (N1-N6) and the bad copy check. If ANY banned phrase, em-dash, or AI tell appears, fix it before responding. Zero tolerance.`;

  const userPrompt = isRefinement
    ? `Topic: "${topic}"
Question: ${question}
Focus: ${focus}

The SME's original soundbite: ${soundbite}

Previous wordsmithed version:
${previousAnswer}

The SME wants these changes: ${feedback}

Rewrite the answer incorporating the feedback. Keep the SME's voice, main points, and personality. Write in first person as the SME. 2-4 paragraphs max.

Output ONLY the revised answer text, no preamble.`
    : `Topic: "${topic}"
Question: ${question}
Focus: ${focus}

The SME gave this rough soundbite: ${soundbite}

Take their raw answer and craft it into a well-written, compelling response that:
- Preserves their exact main points and opinions
- Keeps their voice and personality
- Is written in first person as the SME
- Sounds like a knowledgeable human talking to a peer, not marketing copy
- Is 2-4 paragraphs max
- Uses their specific examples or metaphors if they provided any
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
