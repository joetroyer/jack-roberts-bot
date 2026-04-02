"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("chat_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("chat_session_id", id);
  }
  return id;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<
    number | null
  >(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setRefreshKey((k) => k + 1);
    // Navigate to home if not already there
    if (pathname !== "/") {
      window.location.href = "/";
    }
  }, [pathname]);

  const handleSelectConversation = useCallback((id: number) => {
    setActiveConversationId(id);
  }, []);

  const handleConversationCreated = useCallback((id: number) => {
    setActiveConversationId(id);
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <Sidebar
        sessionId={sessionId}
        onNewChat={handleNewChat}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        refreshKey={refreshKey}
      />
      <main className="flex-1 flex flex-col min-w-0 bg-zinc-925">
        {typeof children === "object" && children !== null
          ? (() => {
              // Clone children to pass down props
              const childProps = {
                sessionId,
                conversationId: activeConversationId,
                onConversationCreated: handleConversationCreated,
              };
              // We'll use a context-like approach instead
              return (
                <AppContext.Provider value={childProps}>
                  {children}
                </AppContext.Provider>
              );
            })()
          : children}
      </main>
    </div>
  );
}

import { createContext, useContext } from "react";

interface AppContextType {
  sessionId: string;
  conversationId: number | null;
  onConversationCreated: (id: number) => void;
}

export const AppContext = createContext<AppContextType>({
  sessionId: "",
  conversationId: null,
  onConversationCreated: () => {},
});

export function useAppContext() {
  return useContext(AppContext);
}
