import { chatCompletion } from "@/lib/llm";
import { getChannel } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PanelAnswer {
  channelName: string;
  content: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      question,
      panelAnswers,
    }: {
      question: string;
      panelAnswers: PanelAnswer[];
    } = body;

    if (!question || !panelAnswers || panelAnswers.length < 2) {
      return Response.json(
        { error: "question and at least 2 panelAnswers are required" },
        { status: 400 }
      );
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    const MODEL = "anthropic/claude-sonnet-4";

    // Build a synthesis prompt that compares all panel responses
    let panelSection = "";
    for (const answer of panelAnswers) {
      panelSection += `\n--- ${answer.channelName} ---\n${answer.content}\n`;
    }

    const systemPrompt = `You are an impartial AI moderator synthesizing responses from multiple experts on a panel discussion.

Your job is to:
1. Identify key AGREEMENTS across the panelists - where do they align?
2. Identify key DISAGREEMENTS or different perspectives - where do they diverge?
3. Highlight unique insights that only one panelist brought up
4. Provide a brief, balanced conclusion

Keep your synthesis concise (2-4 paragraphs). Use the experts' names when referencing their positions.
Do NOT introduce new information. Only synthesize what was said.

Format your response in clear markdown with bold headers for each section.`;

    const userMessage = `**Question asked:** ${question}

**Panel responses:**
${panelSection}

Please synthesize these expert responses.`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Knowledge Chat - Panel Synthesis",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: 1500,
          temperature: 0.5,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenRouter API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    const content =
      data.choices?.[0]?.message?.content || "Unable to generate synthesis.";

    return Response.json({ content });
  } catch (error) {
    console.error("Panel synthesis error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
