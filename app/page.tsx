"use client";

import ChatInterface from "./components/ChatInterface";
import { useAppContext } from "./components/AppShell";

export default function Home() {
  const { sessionId, conversationId, onConversationCreated } = useAppContext();

  return (
    <ChatInterface
      sessionId={sessionId}
      conversationId={conversationId}
      onConversationCreated={onConversationCreated}
    />
  );
}
