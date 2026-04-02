"use client";

import { useState, useEffect, useCallback } from "react";

/* ---------- Types ---------- */

interface ChannelWithStats {
  id: number;
  name: string;
  channel_id: string;
  handle: string;
  avatar_url: string | null;
  personality_prompt: string | null;
  priority: string | null;
  active: number;
  total_videos: number;
  processed_count: number;
  vectorized_count: number;
}

type Priority = "high" | "medium" | "low";

const PRIORITY_OPTIONS: Priority[] = ["high", "medium", "low"];

const PRIORITY_COLORS: Record<Priority, string> = {
  high: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-rose-400",
  medium: "bg-amber-400",
  low: "bg-zinc-500",
};

/* ---------- Sub-components ---------- */

function ProgressBar({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-zinc-500 tabular-nums w-9 text-right">
        {pct}%
      </span>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-violet-600" : "bg-zinc-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/* ---------- Add Channel Modal ---------- */

function AddChannelModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (data: {
    name: string;
    handle: string;
    personality_prompt: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setHandle("");
      setPrompt("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !handle.trim()) {
      setError("Name and handle are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onAdd({
        name: name.trim(),
        handle: handle.trim(),
        personality_prompt: prompt.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add channel.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl animate-fade-in">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-white mb-1">
            Add Channel
          </h2>
          <p className="text-sm text-zinc-400 mb-5">
            Connect a YouTube channel as a knowledge source.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Handle */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                YouTube Handle
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@DaviddTech"
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow"
              />
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="DaviddTech"
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow"
              />
            </div>

            {/* Personality Prompt */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Personality Prompt{" "}
                <span className="text-zinc-600">(optional)</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe how this expert should respond..."
                rows={4}
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Adding..." : "Add Channel"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ---------- Delete Confirm Modal ---------- */

function DeleteConfirmModal({
  channel,
  onClose,
  onConfirm,
}: {
  channel: ChannelWithStats | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  if (!channel) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md mx-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl animate-fade-in p-6">
        <h2 className="text-lg font-semibold text-white mb-2">
          Delete Channel
        </h2>
        <p className="text-sm text-zinc-400 mb-1">
          Are you sure you want to delete{" "}
          <span className="text-white font-medium">{channel.name}</span>?
        </p>
        <p className="text-xs text-zinc-500 mb-5">
          This will also remove {channel.total_videos} video
          {channel.total_videos !== 1 ? "s" : ""} and all associated data.
          This action cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Channel Card ---------- */

function ChannelCard({
  channel,
  onUpdate,
  onDelete,
}: {
  channel: ChannelWithStats;
  onUpdate: (
    id: number,
    updates: Partial<{
      personality_prompt: string | null;
      active: number;
      priority: string;
    }>
  ) => Promise<void>;
  onDelete: (channel: ChannelWithStats) => void;
}) {
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptValue, setPromptValue] = useState(
    channel.personality_prompt || ""
  );
  const [saving, setSaving] = useState(false);

  const priority = (channel.priority || "high") as Priority;

  const handleSavePrompt = async () => {
    setSaving(true);
    try {
      await onUpdate(channel.id, { personality_prompt: promptValue || null });
      setEditingPrompt(false);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (val: boolean) => {
    await onUpdate(channel.id, { active: val ? 1 : 0 });
  };

  const handlePriorityChange = async (newPriority: string) => {
    await onUpdate(channel.id, { priority: newPriority });
  };

  return (
    <div className="group bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-all duration-200">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-lg shadow-violet-500/20">
            {channel.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">
              {channel.name}
            </h3>
            <p className="text-xs text-zinc-500 truncate">{channel.handle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Toggle
            checked={channel.active === 1}
            onChange={handleToggleActive}
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center px-2 py-2 bg-zinc-800/50 rounded-xl">
          <div className="text-lg font-semibold text-white tabular-nums">
            {channel.total_videos}
          </div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Videos
          </div>
        </div>
        <div className="text-center px-2 py-2 bg-zinc-800/50 rounded-xl">
          <div className="text-lg font-semibold text-emerald-400 tabular-nums">
            {channel.processed_count}
          </div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Processed
          </div>
        </div>
        <div className="text-center px-2 py-2 bg-zinc-800/50 rounded-xl">
          <div className="text-lg font-semibold text-violet-400 tabular-nums">
            {channel.vectorized_count}
          </div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Vectorized
          </div>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="space-y-2 mb-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-zinc-500">Processing</span>
            <span className="text-[11px] text-zinc-600 tabular-nums">
              {channel.processed_count}/{channel.total_videos}
            </span>
          </div>
          <ProgressBar
            value={channel.processed_count}
            total={channel.total_videos}
            color="bg-emerald-500"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-zinc-500">Vectorization</span>
            <span className="text-[11px] text-zinc-600 tabular-nums">
              {channel.vectorized_count}/{channel.total_videos}
            </span>
          </div>
          <ProgressBar
            value={channel.vectorized_count}
            total={channel.total_videos}
            color="bg-violet-500"
          />
        </div>
      </div>

      {/* Priority Selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] text-zinc-500">Priority</span>
        <div className="flex gap-1">
          {PRIORITY_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => handlePriorityChange(p)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all duration-150 ${
                priority === p
                  ? PRIORITY_COLORS[p]
                  : "bg-zinc-800/50 text-zinc-600 border-zinc-800 hover:border-zinc-700 hover:text-zinc-400"
              }`}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                  priority === p ? PRIORITY_DOT[p] : "bg-zinc-700"
                }`}
              />
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Personality Prompt */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-zinc-500">
            Personality Prompt
          </span>
          {!editingPrompt && (
            <button
              onClick={() => {
                setPromptValue(channel.personality_prompt || "");
                setEditingPrompt(true);
              }}
              className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
        {editingPrompt ? (
          <div className="space-y-2">
            <textarea
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow resize-none"
              placeholder="Describe how this expert should respond..."
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingPrompt(false)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePrompt}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
            {channel.personality_prompt || (
              <span className="text-zinc-600 italic">
                No personality prompt set
              </span>
            )}
          </p>
        )}
      </div>

      {/* Delete */}
      <div className="pt-3 border-t border-zinc-800/50">
        <button
          onClick={() => onDelete(channel)}
          className="text-[11px] text-zinc-600 hover:text-rose-400 transition-colors"
        >
          Remove channel
        </button>
      </div>
    </div>
  );
}

/* ---------- Main Page ---------- */

export default function SourcesPage() {
  const [channels, setChannels] = useState<ChannelWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChannelWithStats | null>(
    null
  );

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/sources");
      const data = await res.json();
      setChannels(data.channels || []);
    } catch (err) {
      console.error("Failed to load sources:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const handleAdd = async (data: {
    name: string;
    handle: string;
    personality_prompt: string;
  }) => {
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to add channel");
    }
    await fetchChannels();
  };

  const handleUpdate = async (
    id: number,
    updates: Partial<{
      personality_prompt: string | null;
      active: number;
      priority: string;
    }>
  ) => {
    const res = await fetch("/api/sources", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) {
      console.error("Failed to update channel");
      return;
    }
    await fetchChannels();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/sources?id=${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      console.error("Failed to delete channel");
      return;
    }
    setDeleteTarget(null);
    await fetchChannels();
  };

  // Summary stats
  const totalVideos = channels.reduce((s, c) => s + c.total_videos, 0);
  const totalProcessed = channels.reduce((s, c) => s + c.processed_count, 0);
  const totalVectorized = channels.reduce(
    (s, c) => s + c.vectorized_count,
    0
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="max-w-5xl w-full mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Sources
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Manage YouTube channels that power your knowledge base.
            </p>
          </div>
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors shadow-lg shadow-violet-600/20"
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
            Add Channel
          </button>
        </div>

        {/* Summary Stats */}
        {!loading && channels.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl px-4 py-3">
              <div className="text-2xl font-bold text-white tabular-nums">
                {channels.length}
              </div>
              <div className="text-xs text-zinc-500">
                Channel{channels.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl px-4 py-3">
              <div className="text-2xl font-bold text-white tabular-nums">
                {totalVideos}
              </div>
              <div className="text-xs text-zinc-500">Total Videos</div>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl px-4 py-3">
              <div className="text-2xl font-bold text-emerald-400 tabular-nums">
                {totalProcessed}
              </div>
              <div className="text-xs text-zinc-500">Processed</div>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl px-4 py-3">
              <div className="text-2xl font-bold text-violet-400 tabular-nums">
                {totalVectorized}
              </div>
              <div className="text-xs text-zinc-500">Vectorized</div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full animate-shimmer" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 rounded animate-shimmer" />
                    <div className="h-3 w-16 rounded animate-shimmer" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[0, 1, 2].map((j) => (
                    <div
                      key={j}
                      className="h-14 rounded-xl animate-shimmer"
                    />
                  ))}
                </div>
                <div className="space-y-3">
                  <div className="h-2 rounded animate-shimmer" />
                  <div className="h-2 rounded animate-shimmer" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && channels.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-zinc-600"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              No sources yet
            </h2>
            <p className="text-sm text-zinc-500 mb-6 max-w-sm mx-auto">
              Add YouTube channels to build your knowledge base. Each channel
              becomes an expert your AI can draw from.
            </p>
            <button
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
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
              Add Your First Channel
            </button>
          </div>
        )}

        {/* Channel Cards Grid */}
        {!loading && channels.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onUpdate={handleUpdate}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddChannelModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={handleAdd}
      />
      <DeleteConfirmModal
        channel={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
