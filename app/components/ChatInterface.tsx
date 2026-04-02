"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Source {
  title: string;
  url: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  channelName?: string;
}

interface Channel {
  id: number;
  name: string;
  handle: string;
}

interface ChatInterfaceProps {
  conversationId: number | null;
  sessionId: string;
  onConversationCreated: (id: number) => void;
}

export default function ChatInterface({
  conversationId,
  sessionId,
  onConversationCreated,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load channels
  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((data) => {
        const ch = data.channels || [];
        setChannels(ch);
        if (ch.length > 0 && !selectedChannel) {
          setSelectedChannel(ch[0].id);
        }
      })
      .catch(console.error);
  }, [selectedChannel]);

  // Clear messages when conversation changes
  useEffect(() => {
    setMessages([]);
  }, [conversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming || !selectedChannel) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Create conversation if needed
    let convId = conversationId;
    if (!convId) {
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            mode: "single",
            channelIds: [selectedChannel],
          }),
        });
        const data = await res.json();
        convId = data.conversation.id;
        onConversationCreated(convId!);
      } catch (err) {
        console.error("Failed to create conversation:", err);
        setIsStreaming(false);
        return;
      }
    }

    // Create a placeholder assistant message
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      sources: [],
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          channelId: selectedChannel,
          conversationId: convId,
          mode: "single",
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Chat request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "sources") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, sources: event.sources } : m
                )
              );
            } else if (event.type === "content") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + event.content }
                    : m
                )
              );
            } else if (event.type === "done") {
              // Stream complete
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (error) {
      console.error("Streaming error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  m.content ||
                  `Error: ${error instanceof Error ? error.message : "Something went wrong"}`,
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectedChannelName =
    channels.find((c) => c.id === selectedChannel)?.name || "Select Expert";

  return (
    <div className="flex flex-col h-full">
      {/* Expert Selector */}
      <div className="flex-shrink-0 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Expert
          </label>
          <select
            value={selectedChannel || ""}
            onChange={(e) => setSelectedChannel(Number(e.target.value))}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          >
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Online
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-violet-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Chat with {selectedChannelName}
            </h2>
            <p className="text-zinc-500 max-w-md text-sm leading-relaxed">
              Ask questions and get answers powered by knowledge from their
              YouTube videos. Responses include source citations so you can
              verify and explore further.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">
                {selectedChannelName.charAt(0)}
              </div>
            )}
            <div
              className={`max-w-[75%] ${
                msg.role === "user"
                  ? "bg-violet-600 text-white rounded-2xl rounded-br-md px-4 py-3"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-2xl rounded-bl-md px-4 py-3"
              }`}
            >
              {/* Message Content */}
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {msg.content}
                {msg.role === "assistant" && isStreaming && !msg.content && (
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:300ms]" />
                  </span>
                )}
              </div>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && msg.content && (
                <div className="mt-3 pt-3 border-t border-zinc-700/50">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Sources
                  </p>
                  <div className="space-y-1">
                    {msg.sources.map((source, idx) => (
                      <a
                        key={idx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-violet-400 hover:text-violet-300 transition-colors truncate"
                      >
                        {idx + 1}. {source.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-bold flex-shrink-0 mt-1">
                You
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-950/50 backdrop-blur-sm px-6 py-4">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${selectedChannelName} something...`}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none min-h-[44px] max-h-[200px]"
              rows={1}
              disabled={isStreaming}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white flex items-center justify-center transition-colors"
          >
            {isStreaming ? (
              <svg
                className="animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-zinc-600 text-center mt-2">
          Responses are generated from YouTube video transcripts. Always verify important information.
        </p>
      </div>
    </div>
  );
}
