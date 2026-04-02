import {
  createConversation,
  getConversationsBySession,
  getMessages,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return Response.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const conversations = getConversationsBySession(sessionId);

    // Attach message previews to each conversation
    const conversationsWithPreviews = conversations.map((conv) => {
      const messages = getMessages(conv.id);
      const lastUserMessage = messages.filter((m) => m.role === "user").pop();
      return {
        ...conv,
        preview: lastUserMessage?.content?.slice(0, 80) || "New conversation",
        messageCount: messages.length,
      };
    });

    return Response.json({ conversations: conversationsWithPreviews });
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return Response.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, mode, channelIds } = body;

    if (!sessionId || !mode || !channelIds) {
      return Response.json(
        { error: "sessionId, mode, and channelIds are required" },
        { status: 400 }
      );
    }

    const conversation = createConversation(sessionId, mode, channelIds);
    return Response.json({ conversation });
  } catch (error) {
    console.error("Failed to create conversation:", error);
    return Response.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
