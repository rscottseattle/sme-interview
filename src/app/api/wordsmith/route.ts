import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { topic, question, focus, soundbite, feedback, previousAnswer } =
    await req.json();

  const isRefinement = !!feedback && !!previousAnswer;

  const prompt = isRefinement
    ? `You are helping wordsmith an SME's interview answer about "${topic}".

Question: ${question}
Focus: ${focus}

The SME's original soundbite: ${soundbite}

Previous wordsmithed version:
${previousAnswer}

The SME wants these changes: ${feedback}

Rewrite the answer incorporating the feedback. Keep the SME's voice, main points, and personality. Write in first person as the SME. Make it sound like a knowledgeable human speaking — not marketing copy, not AI-sounding. 2-4 paragraphs max.

Output ONLY the revised answer text, no preamble.`
    : `You are helping wordsmith an SME's interview answer about "${topic}".

Question: ${question}
Focus: ${focus}

The SME gave this rough soundbite: ${soundbite}

Take their raw answer and craft it into a well-written, compelling response that:
- Preserves their exact main points and opinions
- Keeps their voice and personality
- Is written in first person as the SME
- Sounds like a knowledgeable human speaking — not marketing copy, not AI-generated
- Is 2-4 paragraphs max
- Uses their specific examples or metaphors if they provided any

Output ONLY the wordsmithed answer text, no preamble.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  return NextResponse.json({ answer: text });
}
