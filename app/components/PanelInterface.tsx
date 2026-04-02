"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Source {
  title: string;
  url: string;
}

interface PanelResponse {
  channelId: number;
  channelName: string;
  avatarUrl: string | null;
  content: string;
  sources: Source[];
  loading: boolean;
  error?: string;
}

interface Channel {
  id: number;
  name: string;
  handle: string;
  avatar_url: string | null;
}

interface SynthesisState {
  content: string;
  loading: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Simple Markdown renderer (no external deps)
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): string {
  let html = text
    // Escape HTML entities first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (``` ... ```)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre><code class="language-$1">$2</code></pre>'
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  // Unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Links (block javascript: and data: URIs to prevent XSS)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match: string, text: string, url: string) => {
      const trimmedUrl = url.trim().toLowerCase();
      if (trimmedUrl.startsWith("javascript:") || trimmedUrl.startsWith("data:") || trimmedUrl.startsWith("vbscript:")) {
        return text; // render as plain text, strip the dangerous link
      }
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
  );

  // Paragraphs: wrap remaining loose lines
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<li")
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return html;
}

// ---------------------------------------------------------------------------
// Unique colour palette for expert avatars (up to 5)
// ---------------------------------------------------------------------------

const AVATAR_GRADIENTS = [
  "from-violet-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-sky-500 to-cyan-600",
];

const CARD_RING_COLOURS = [
  "ring-violet-500/30",
  "ring-emerald-500/30",
  "ring-amber-500/30",
  "ring-rose-500/30",
  "ring-sky-500/30",
];

const ACCENT_TEXT_COLOURS = [
  "text-violet-400",
  "text-emerald-400",
  "text-amber-400",
  "text-rose-400",
  "text-sky-400",
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ExpertChip({
  channel,
  selected,
  disabled,
  colourIndex,
  onToggle,
}: {
  channel: Channel;
  selected: boolean;
  disabled: boolean;
  colourIndex: number;
  onToggle: () => void;
}) {
  const gradient = AVATAR_GRADIENTS[colourIndex % AVATAR_GRADIENTS.length];

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`group relative flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 select-none ${
        selected
          ? `bg-zinc-800 text-white ring-2 ${CARD_RING_COLOURS[colourIndex % CARD_RING_COLOURS.length]} shadow-lg`
          : "bg-zinc-900/60 text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300"
      } ${disabled && !selected ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      title={selected ? `Deselect ${channel.name}` : `Select ${channel.name}`}
    >
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all duration-200 ${
          selected
            ? `bg-gradient-to-br ${gradient} text-white`
            : "bg-zinc-800 text-zinc-500 group-hover:text-zinc-300"
        }`}
      >
        {channel.avatar_url ? (
          <img
            src={channel.avatar_url}
            alt={channel.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          channel.name.charAt(0).toUpperCase()
        )}
      </div>

      {/* Name */}
      <span className="truncate max-w-[120px]">{channel.name}</span>

      {/* Selection indicator */}
      {selected && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#18181b"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      )}
    </button>
  );
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className={`opacity-0 animate-panel-card-in panel-card-delay-${index} bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden`}
    >
      {/* Header skeleton */}
      <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full animate-shimmer" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 animate-shimmer rounded w-24" />
          <div className="h-2.5 animate-shimmer rounded w-16" />
        </div>
        <div className="w-5 h-5 rounded-full animate-shimmer" />
      </div>
      {/* Body skeleton */}
      <div className="px-5 py-4 space-y-2.5">
        <div className="h-3 animate-shimmer rounded w-full" />
        <div className="h-3 animate-shimmer rounded w-11/12" />
        <div className="h-3 animate-shimmer rounded w-4/5" />
        <div className="h-3 animate-shimmer rounded w-full" />
        <div className="h-3 animate-shimmer rounded w-3/5" />
        <div className="h-3 animate-shimmer rounded w-9/12" />
        <div className="h-3 animate-shimmer rounded w-2/3" />
      </div>
    </div>
  );
}

function PanelCard({
  response,
  index,
  colourIndex,
}: {
  response: PanelResponse;
  index: number;
  colourIndex: number;
}) {
  const gradient = AVATAR_GRADIENTS[colourIndex % AVATAR_GRADIENTS.length];
  const accentText = ACCENT_TEXT_COLOURS[colourIndex % ACCENT_TEXT_COLOURS.length];

  if (response.loading) {
    return <SkeletonCard index={index} />;
  }

  const renderedContent = response.error
    ? ""
    : renderMarkdown(response.content);

  // De-duplicate sources by URL
  const uniqueSources = response.sources.reduce<Source[]>((acc, src) => {
    if (!acc.some((s) => s.url === src.url)) acc.push(src);
    return acc;
  }, []);

  return (
    <div
      className={`opacity-0 animate-panel-card-in panel-card-delay-${index} bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col backdrop-blur-sm hover:border-zinc-700 transition-colors duration-200`}
    >
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md`}
        >
          {response.avatarUrl ? (
            <img
              src={response.avatarUrl}
              alt={response.channelName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            response.channelName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white truncate">
            {response.channelName}
          </h3>
          <p className={`text-[11px] ${response.error ? "text-red-400" : "text-zinc-500"}`}>
            {response.error ? "Failed to respond" : "Response ready"}
          </p>
        </div>
        {!response.error && (
          <div className={`w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0`} />
        )}
        {response.error && (
          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
        )}
      </div>

      {/* Card Content */}
      <div className="flex-1 px-5 py-4 overflow-y-auto max-h-[500px]">
        {response.error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-sm text-red-400 font-medium mb-1">
              Something went wrong
            </p>
            <p className="text-xs text-zinc-600">{response.error}</p>
          </div>
        ) : (
          <div
            className="panel-markdown text-sm text-zinc-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />
        )}
      </div>

      {/* Sources */}
      {uniqueSources.length > 0 && !response.error && (
        <div className="px-5 py-3.5 border-t border-zinc-800/60 bg-zinc-950/40">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Sources ({uniqueSources.length})
          </p>
          <div className="space-y-1">
            {uniqueSources.map((source, idx) => (
              <a
                key={`${source.url}-${idx}`}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-start gap-2 text-xs ${accentText} hover:brightness-125 transition-all duration-150 group`}
              >
                <span className="text-zinc-600 flex-shrink-0 mt-px font-mono text-[10px]">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="truncate group-hover:underline underline-offset-2">
                  {source.title}
                </span>
                <svg
                  className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SynthesisSection({ synthesis }: { synthesis: SynthesisState }) {
  if (!synthesis.loading && !synthesis.content && !synthesis.error) return null;

  const renderedContent = synthesis.content
    ? renderMarkdown(synthesis.content)
    : "";

  return (
    <div className={`mt-6 ${synthesis.content || synthesis.error ? "animate-synthesis-in" : ""}`}>
      {/* Divider */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          AI Synthesis
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
      </div>

      <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-purple-500/20">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Moderator Synthesis
            </h3>
            <p className="text-[11px] text-zinc-500">
              {synthesis.loading
                ? "Analyzing all responses..."
                : synthesis.error
                  ? "Failed to generate"
                  : "Cross-expert analysis"}
            </p>
          </div>
          {synthesis.loading && (
            <svg
              className="ml-auto animate-spin text-purple-400"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          {synthesis.loading ? (
            <div className="space-y-2.5">
              <div className="h-3 animate-shimmer rounded w-full" />
              <div className="h-3 animate-shimmer rounded w-11/12" />
              <div className="h-3 animate-shimmer rounded w-4/5" />
              <div className="h-3 animate-shimmer rounded w-full" />
              <div className="h-3 animate-shimmer rounded w-3/5" />
            </div>
          ) : synthesis.error ? (
            <p className="text-sm text-red-400">{synthesis.error}</p>
          ) : (
            <div
              className="panel-markdown text-sm text-zinc-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center mb-8">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="url(#panelGrad)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <defs>
            <linearGradient id="panelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold text-white mb-3 tracking-tight">
        Expert Panel
      </h2>
      <p className="text-zinc-500 max-w-lg text-sm leading-relaxed mb-6">
        Select the experts you want to consult, type a single question, and
        compare how different experts answer based on their unique knowledge
        base. An AI moderator will synthesize agreements and disagreements.
      </p>
      <div className="flex items-center gap-6 text-xs text-zinc-600">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-[10px] font-bold text-zinc-400">1</span>
          </div>
          Select experts
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-zinc-700"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-[10px] font-bold text-zinc-400">2</span>
          </div>
          Ask a question
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-zinc-700"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-[10px] font-bold text-zinc-400">3</span>
          </div>
          Compare answers
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Max experts cap
// ---------------------------------------------------------------------------

const MAX_EXPERTS = 5;

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PanelInterface() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<number[]>([]);
  const [question, setQuestion] = useState("");
  const [responses, setResponses] = useState<PanelResponse[]>([]);
  const [synthesis, setSynthesis] = useState<SynthesisState>({
    content: "",
    loading: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Build a stable mapping of channelId -> colour index
  const channelColourMap = useMemo(() => {
    const map = new Map<number, number>();
    channels.forEach((ch, idx) => map.set(ch.id, idx));
    return map;
  }, [channels]);

  // Load channels on mount
  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((data) => {
        const ch: Channel[] = data.channels || [];
        setChannels(ch);
        // Auto-select all if <= MAX_EXPERTS, otherwise select first MAX_EXPERTS
        setSelectedChannels(ch.slice(0, MAX_EXPERTS).map((c) => c.id));
      })
      .catch(console.error);
  }, []);

  // Toggle an expert
  const toggleChannel = useCallback(
    (id: number) => {
      setSelectedChannels((prev) => {
        if (prev.includes(id)) {
          return prev.filter((c) => c !== id);
        }
        if (prev.length >= MAX_EXPERTS) return prev; // already at cap
        return [...prev, id];
      });
    },
    []
  );

  // Request synthesis after all panelists respond
  const requestSynthesis = useCallback(
    async (question: string, completedResponses: PanelResponse[]) => {
      // Only synthesize if we have at least 2 successful responses
      const successfulResponses = completedResponses.filter(
        (r) => !r.error && r.content
      );
      if (successfulResponses.length < 2) return;

      setSynthesis({ content: "", loading: true });

      try {
        const res = await fetch("/api/panel-synthesis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            panelAnswers: successfulResponses.map((r) => ({
              channelName: r.channelName,
              content: r.content,
            })),
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Synthesis request failed");
        }

        const data = await res.json();
        setSynthesis({ content: data.content, loading: false });
      } catch (error) {
        setSynthesis({
          content: "",
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate synthesis",
        });
      }
    },
    []
  );

  // Submit the question to all selected experts
  const submitQuestion = useCallback(async () => {
    if (!question.trim() || selectedChannels.length === 0 || isLoading) return;

    const currentQuestion = question.trim();

    setIsLoading(true);
    setHasSubmitted(true);
    setSynthesis({ content: "", loading: false });

    // Initialize responses with loading state
    const initialResponses: PanelResponse[] = selectedChannels.map((chId) => {
      const ch = channels.find((c) => c.id === chId);
      return {
        channelId: chId,
        channelName: ch?.name || "Unknown",
        avatarUrl: ch?.avatar_url || null,
        content: "",
        sources: [],
        loading: true,
      };
    });
    setResponses(initialResponses);

    // Scroll to grid area
    setTimeout(() => {
      gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);

    // Track completed responses for synthesis
    const completedResponses: PanelResponse[] = [];

    // Fire parallel requests -- each resolves independently and updates its card
    const promises = selectedChannels.map(async (channelId) => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: currentQuestion,
            channelId,
            mode: "panel",
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Request failed");
        }

        const data = await res.json();
        const ch = channels.find((c) => c.id === channelId);

        const completed: PanelResponse = {
          channelId,
          channelName: ch?.name || "Unknown",
          avatarUrl: ch?.avatar_url || null,
          content: data.content,
          sources: data.sources || [],
          loading: false,
        };

        completedResponses.push(completed);

        setResponses((prev) =>
          prev.map((r) => (r.channelId === channelId ? completed : r))
        );
      } catch (error) {
        const ch = channels.find((c) => c.id === channelId);
        const errResponse: PanelResponse = {
          channelId,
          channelName: ch?.name || "Unknown",
          avatarUrl: ch?.avatar_url || null,
          content: "",
          sources: [],
          loading: false,
          error:
            error instanceof Error ? error.message : "Something went wrong",
        };

        completedResponses.push(errResponse);

        setResponses((prev) =>
          prev.map((r) => (r.channelId === channelId ? errResponse : r))
        );
      }
    });

    await Promise.allSettled(promises);
    setIsLoading(false);

    // Trigger synthesis after all panels have responded
    requestSynthesis(currentQuestion, completedResponses);
  }, [question, selectedChannels, isLoading, channels, requestSynthesis]);

  // Enter to submit (Shift+Enter for newline)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitQuestion();
      }
    },
    [submitQuestion]
  );

  // Reset panel
  const handleReset = useCallback(() => {
    setResponses([]);
    setSynthesis({ content: "", loading: false });
    setHasSubmitted(false);
    setQuestion("");
    textareaRef.current?.focus();
  }, []);

  const atMaxExperts = selectedChannels.length >= MAX_EXPERTS;

  return (
    <div className="flex flex-col h-full">
      {/* ====== Header / Controls ====== */}
      <div className="flex-shrink-0 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-6 py-5">
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </span>
              Panel Mode
            </h2>
            <p className="text-xs text-zinc-500 mt-1 ml-[38px]">
              One question, multiple expert perspectives
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasSubmitted && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                New Panel
              </button>
            )}
            <span className="text-xs text-zinc-600 tabular-nums">
              {selectedChannels.length}/{MAX_EXPERTS} experts
            </span>
          </div>
        </div>

        {/* Expert Selection Chips */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {channels.map((ch) => {
              const colourIdx = channelColourMap.get(ch.id) ?? 0;
              return (
                <ExpertChip
                  key={ch.id}
                  channel={ch}
                  selected={selectedChannels.includes(ch.id)}
                  disabled={
                    isLoading ||
                    (atMaxExperts && !selectedChannels.includes(ch.id))
                  }
                  colourIndex={colourIdx}
                  onToggle={() => toggleChannel(ch.id)}
                />
              );
            })}
            {channels.length === 0 && (
              <p className="text-xs text-zinc-600 italic">
                Loading experts...
              </p>
            )}
          </div>
          {atMaxExperts && channels.length > MAX_EXPERTS && (
            <p className="text-[11px] text-amber-500/70 mt-2 ml-1">
              Maximum of {MAX_EXPERTS} experts per panel. Deselect one to choose
              another.
            </p>
          )}
        </div>

        {/* Question Input */}
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedChannels.length === 0
                  ? "Select at least one expert above..."
                  : `Ask ${selectedChannels.length} expert${selectedChannels.length !== 1 ? "s" : ""} a question...`
              }
              className="w-full bg-zinc-900/80 border border-zinc-700/80 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/30 resize-none transition-all duration-200"
              rows={2}
              disabled={isLoading || selectedChannels.length === 0}
            />
            <div className="absolute bottom-2.5 right-3 text-[10px] text-zinc-700">
              Shift+Enter for newline
            </div>
          </div>
          <button
            onClick={submitQuestion}
            disabled={
              isLoading || !question.trim() || selectedChannels.length === 0
            }
            className="flex-shrink-0 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-violet-600/10 hover:shadow-violet-500/20 disabled:shadow-none"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Asking...
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
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
                Ask All
              </>
            )}
          </button>
        </div>
      </div>

      {/* ====== Response Area ====== */}
      <div className="flex-1 overflow-y-auto">
        {!hasSubmitted ? (
          <EmptyState />
        ) : (
          <div className="p-6" ref={gridRef}>
            {/* Question echo */}
            <div className="mb-5 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#a1a1aa"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] text-zinc-600 font-medium uppercase tracking-wider mb-1">
                  Your Question
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {question || "(question submitted)"}
                </p>
              </div>
            </div>

            {/* Response Grid */}
            <div
              className={`grid gap-4 ${
                responses.length === 1
                  ? "grid-cols-1 max-w-2xl"
                  : "grid-cols-1 lg:grid-cols-2"
              }`}
            >
              {responses.map((resp, idx) => {
                const colourIdx = channelColourMap.get(resp.channelId) ?? 0;
                return (
                  <PanelCard
                    key={resp.channelId}
                    response={resp}
                    index={idx}
                    colourIndex={colourIdx}
                  />
                );
              })}
            </div>

            {/* Synthesis */}
            <SynthesisSection synthesis={synthesis} />

            {/* Bottom spacer */}
            <div className="h-8" />
          </div>
        )}
      </div>
    </div>
  );
}
