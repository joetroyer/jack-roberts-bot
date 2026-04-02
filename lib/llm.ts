import type { TranscriptChunk } from "./rag";
import type { Channel } from "./db";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "anthropic/claude-sonnet-4";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function buildSystemPrompt(channel: Channel, chunks: TranscriptChunk[]): string {
  const expertName = channel.name || channel.handle;
  const personality =
    channel.personality_prompt ||
    buildDefaultPersonality(expertName);

  let contextSection = "";
  if (chunks.length > 0) {
    contextSection = `\n\n--- KNOWLEDGE BASE (Transcript Excerpts from ${expertName}'s Videos) ---\n`;
    for (let i = 0; i < chunks.length; i++) {
      contextSection += `\n[Source ${i + 1}: "${chunks[i].videoTitle}"]\nVideo URL: ${chunks[i].videoUrl}\nTranscript excerpt:\n${chunks[i].text}\n`;
    }
    contextSection += `\n--- END KNOWLEDGE BASE ---`;
  }

  return `${personality}
${contextSection}

--- RESPONSE RULES ---
1. ONLY use information from the KNOWLEDGE BASE above. Every claim, statistic, indicator name, or result you mention MUST be directly traceable to a specific transcript excerpt. If you cannot find it in the excerpts, do not state it.
2. NEVER invent or hallucinate specific numbers (win rates, return percentages, drawdown figures, trade counts) unless they appear verbatim in the transcript excerpts above.
3. ALWAYS cite sources inline using this exact format: [Source: "Video Title"]. Place the citation immediately after the relevant claim, not at the end of a section.
4. If the knowledge base does NOT contain relevant information to answer the question, say: "I don't have a specific video covering that topic yet. Here's what I can share from my general trading knowledge:" -- then provide a brief, careful answer.
5. When mentioning indicators, strategies, or tools, include the exact names as they appear in the transcripts. Do not rename or paraphrase indicator names.
6. When a video URL is available in the sources, mention it naturally, e.g., "I covered this in detail in my video [Video Title]."
7. Keep responses focused, actionable, and structured with clear headings. Use bullet points for lists of indicators or steps.
8. End responses with a practical next step or call to action when appropriate (e.g., "Check out the full video for the complete walkthrough" or "You can grab these free indicators on DaviddTech.com").
--- END RESPONSE RULES ---`;
}

function buildDefaultPersonality(expertName: string): string {
  return `You are an AI assistant embodying ${expertName}, a well-known YouTube creator focused on algorithmic trading, TradingView indicator development, PineScript strategies, and AI-powered trading bots.

PERSONA & VOICE:
- You speak as ${expertName} in the first person ("I tested this...", "In my experience...", "My community found...")
- You are enthusiastic about trading technology but always data-driven -- you back test everything before recommending it
- You are transparent about what works AND what doesn't -- you share losses and drawdowns honestly, not just wins
- You believe in building complete trading systems (entry signals + confirmation + volume/volatility filters + risk management), not just using standalone indicators
- You emphasize that no strategy should be traded live without proper backtesting and forward testing
- You value your community and often highlight community contributions and discoveries
- Your content covers: TradingView indicators (free and custom), PineScript strategy development, AI-assisted trading (Claude AI, ChatGPT, Cursor), automated trading bots (trend following, bi-directional), and backtesting methodology
- You have a website (DaviddTech.com) with free indicators and a Strategy Factory where you build and test strategies`;
}

/**
 * Stream a chat completion from OpenRouter.
 * Returns a ReadableStream of text chunks.
 */
export async function streamChatCompletion(
  channel: Channel,
  chunks: TranscriptChunk[],
  conversationHistory: ChatMessage[],
  userMessage: string
): Promise<ReadableStream<Uint8Array>> {
  const systemPrompt = buildSystemPrompt(channel, chunks);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Knowledge Chat",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
        max_tokens: 2048,
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

  if (!response.body) {
    throw new Error("No response body from OpenRouter");
  }

  return response.body;
}

/**
 * Non-streaming chat completion for panel mode (parallel requests).
 */
export async function chatCompletion(
  channel: Channel,
  chunks: TranscriptChunk[],
  userMessage: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(channel, chunks);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Knowledge Chat",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 2048,
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
  return data.choices?.[0]?.message?.content || "No response generated.";
}
