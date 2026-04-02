"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Channel {
  id: number;
  name: string;
  handle: string;
  avatar_url: string | null;
  active: number;
}

interface ConversationPreview {
  id: number;
  session_id: string;
  mode: string;
  preview: string;
  messageCount: number;
}

interface SidebarProps {
  sessionId: string;
  onNewChat: () => void;
  activeConversationId: number | null;
  onSelectConversation: (id: number) => void;
  refreshKey: number;
}

export default function Sidebar({
  sessionId,
  onNewChat,
  activeConversationId,
  onSelectConversation,
  refreshKey,
}: SidebarProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((data) => setChannels(data.channels || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/conversations?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((data) => setConversations(data.conversations || []))
      .catch(console.error);
  }, [sessionId, refreshKey]);

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-72"
      } flex-shrink-0 bg-zinc-950 border-r border-zinc-800 flex flex-col transition-all duration-300 ease-in-out`}
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        {!collapsed && (
          <h1 className="text-lg font-semibold text-white tracking-tight">
            Knowledge Chat
          </h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
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
            {collapsed ? (
              <path d="M9 18l6-6-6-6" />
            ) : (
              <path d="M15 18l-6-6 6-6" />
            )}
          </svg>
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {!collapsed && "New Chat"}
        </button>
      </div>

      {/* Mode Navigation */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
            <Link
              href="/"
              className={`flex-1 text-center text-xs font-medium py-1.5 rounded-md transition-colors ${
                pathname === "/"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Chat
            </Link>
            <Link
              href="/panel"
              className={`flex-1 text-center text-xs font-medium py-1.5 rounded-md transition-colors ${
                pathname === "/panel"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Panel
            </Link>
            <Link
              href="/sources"
              className={`flex-1 text-center text-xs font-medium py-1.5 rounded-md transition-colors ${
                pathname === "/sources"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Sources
            </Link>
          </div>
        </div>
      )}
      {/* Sources link when collapsed */}
      {collapsed && (
        <div className="px-3 pb-2 flex justify-center">
          <Link
            href="/sources"
            className={`p-2 rounded-lg transition-colors ${
              pathname === "/sources"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
            title="Sources"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </Link>
        </div>
      )}

      {/* Experts */}
      {!collapsed && (
        <div className="px-3 py-2">
          <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">
            Experts
          </h2>
          <div className="space-y-0.5">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-zinc-300 text-sm"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {channel.name?.charAt(0) || "?"}
                </div>
                <span className="truncate">{channel.name}</span>
                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              </div>
            ))}
            {channels.length === 0 && (
              <p className="text-zinc-600 text-xs px-2">
                No experts loaded yet
              </p>
            )}
          </div>
        </div>
      )}

      {/* Conversations */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">
            Recent Chats
          </h2>
          <div className="space-y-0.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full text-left px-2 py-2 rounded-lg text-sm transition-colors truncate ${
                  activeConversationId === conv.id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <div className="truncate">{conv.preview}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">
                  {conv.messageCount} messages
                </div>
              </button>
            ))}
            {conversations.length === 0 && (
              <p className="text-zinc-600 text-xs px-2">
                No conversations yet
              </p>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-zinc-800">
          <div className="text-[10px] text-zinc-600 text-center">
            Powered by OpenRouter + Claude
          </div>
        </div>
      )}
    </aside>
  );
}
