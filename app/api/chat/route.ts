import { getChannel, addMessage, getMessages, getConversation } from "@/lib/db";
import { searchTranscripts } from "@/lib/rag";
import { searchPinecone, toNamespace } from "@/lib/pinecone-rag";
import { streamChatCompletion, chatCompletion } from "@/lib/llm";
import type { TranscriptChunk } from "@/lib/rag";
import type { PineconeChunk } from "@/lib/pinecone-rag";

export const dynamic = "force-dynamic";

/** Deduplicate sources by video URL, keeping the first occurrence. */
function deduplicateSources(
  sources: { title: string; url: string }[]
): { title: string; url: string }[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

/**
 * Convert Pinecone results into the TranscriptChunk shape that llm.ts expects.
 */
function pineconeToTranscriptChunks(
  pineconeChunks: PineconeChunk[],
  channelId: number
): TranscriptChunk[] {
  return pineconeChunks.map((pc) => ({
    videoId: 0, // not available from Pinecone metadata as a DB row id
    videoTitle: pc.videoTitle,
    videoUrl: pc.videoUrl,
    channelId,
    text: pc.text,
    score: pc.score,
  }));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      message,
      channelId,
      conversationId,
      mode,
    }: {
      message: string;
      channelId: number;
      conversationId?: number;
      mode?: "single" | "panel";
    } = body;

    if (!message || !channelId) {
      return Response.json(
        { error: "message and channelId are required" },
        { status: 400 }
      );
    }

    const channel = getChannel(channelId);
    if (!channel) {
      return Response.json({ error: "Channel not found" }, { status: 404 });
    }

    // --- Retrieve context: Pinecone first, fallback to LIKE search ---
    const namespace = toNamespace(channel.name || channel.handle);
    let chunks: TranscriptChunk[];

    // Try Pinecone vector search
    const pineconeResults = await searchPinecone(message, namespace);

    if (pineconeResults.length > 0) {
      console.log(
        `[RAG] Pinecone returned ${pineconeResults.length} chunks from namespace "${namespace}" (top score: ${pineconeResults[0].score.toFixed(3)})`
      );
      chunks = pineconeToTranscriptChunks(pineconeResults, channelId);
    } else {
      // Fallback: keyword-based LIKE search against SQLite
      console.log(
        `[RAG] Pinecone returned 0 results for namespace "${namespace}", falling back to LIKE search`
      );
      chunks = searchTranscripts(message, channelId);
    }

    // Panel mode: return non-streaming JSON response
    if (mode === "panel") {
      const responseText = await chatCompletion(channel, chunks, message);
      const sources = deduplicateSources(
        chunks.map((c) => ({ title: c.videoTitle, url: c.videoUrl }))
      );

      return Response.json({
        content: responseText,
        sources,
        channelId,
        channelName: channel.name,
      });
    }

    // Single mode: save user message, stream response
    if (conversationId) {
      addMessage(conversationId, "user", message);
    }

    // Get conversation history for context
    let conversationHistory: { role: "user" | "assistant"; content: string }[] =
      [];
    if (conversationId) {
      const existingMessages = getMessages(conversationId);
      // Take last 10 messages for context (excluding the one we just added)
      conversationHistory = existingMessages
        .slice(-11, -1) // last 10 before the new one
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
    }

    // Get the streaming response from OpenRouter
    const upstreamBody = await streamChatCompletion(
      channel,
      chunks,
      conversationHistory,
      message
    );

    // Build source info to prepend to the stream
    const sources = deduplicateSources(
      chunks.map((c) => ({ title: c.videoTitle, url: c.videoUrl }))
    );

    // Transform the SSE stream from OpenRouter into our own stream
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullResponse = "";

    const transformStream = new TransformStream<Uint8Array, Uint8Array>({
      start(controller) {
        // Send sources as the first SSE event
        const sourcesEvent = `data: ${JSON.stringify({ type: "sources", sources })}\n\n`;
        controller.enqueue(encoder.encode(sourcesEvent));
      },
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              const doneEvent = `data: ${JSON.stringify({ type: "done" })}\n\n`;
              controller.enqueue(encoder.encode(doneEvent));
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                const contentEvent = `data: ${JSON.stringify({ type: "content", content })}\n\n`;
                controller.enqueue(encoder.encode(contentEvent));
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      },
      flush() {
        // Save the complete assistant message
        if (conversationId && fullResponse) {
          const sourcesJson = JSON.stringify(
            deduplicateSources(
              chunks.map((c) => ({ title: c.videoTitle, url: c.videoUrl }))
            )
          );
          addMessage(
            conversationId,
            "assistant",
            fullResponse,
            channelId,
            sourcesJson
          );
        }
      },
    });

    const responseStream = upstreamBody.pipeThrough(transformStream);

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
