import Database from "better-sqlite3";
import path from "path";

const DB_PATH =
  process.env.DB_PATH ||
  path.resolve(process.cwd(), "..", "data", "knowledge.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: false });
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }
  return _db;
}

// ---------- Types ----------

export interface Channel {
  id: number;
  name: string;
  channel_id: string;
  handle: string;
  avatar_url: string | null;
  personality_prompt: string | null;
  priority: number | null;
  active: number;
}

export interface Video {
  id: number;
  channel_id: number;
  video_id: string;
  title: string;
  url: string;
  published_at: string | null;
  duration_sec: number | null;
  transcript: string | null;
  summary: string | null;
  key_points: string | null;
  tags: string | null;
  processed: number;
}

export interface Conversation {
  id: number;
  session_id: string;
  mode: "single" | "panel";
  channel_ids: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  channel_id: number | null;
  sources: string | null;
}

// ---------- Channel queries ----------

export function getChannels(): Channel[] {
  const db = getDb();
  return db.prepare("SELECT * FROM channels WHERE active = 1").all() as Channel[];
}

export function getChannel(id: number): Channel | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM channels WHERE id = ?").get(id) as
    | Channel
    | undefined;
}

export function getAllChannels(): Channel[] {
  const db = getDb();
  return db.prepare("SELECT * FROM channels ORDER BY id ASC").all() as Channel[];
}

export interface ChannelWithStats extends Channel {
  total_videos: number;
  processed_count: number;
  vectorized_count: number;
}

export function getChannelsWithStats(): ChannelWithStats[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT c.*,
              COALESCE(s.total_videos, 0) AS total_videos,
              COALESCE(s.processed_count, 0) AS processed_count,
              COALESCE(s.vectorized_count, 0) AS vectorized_count
       FROM channels c
       LEFT JOIN (
         SELECT channel_id,
                COUNT(*) AS total_videos,
                SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) AS processed_count,
                SUM(CASE WHEN vectorized = 1 THEN 1 ELSE 0 END) AS vectorized_count
         FROM videos
         GROUP BY channel_id
       ) s ON s.channel_id = c.id
       ORDER BY c.id ASC`
    )
    .all() as ChannelWithStats[];
}

export function addChannel(
  name: string,
  channelId: string,
  handle: string,
  personalityPrompt?: string | null
): Channel {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO channels (name, channel_id, handle, personality_prompt) VALUES (?, ?, ?, ?)"
  );
  const result = stmt.run(name, channelId, handle, personalityPrompt ?? null);
  return getChannel(result.lastInsertRowid as number)!;
}

export function updateChannel(
  id: number,
  updates: {
    personality_prompt?: string | null;
    active?: number;
    priority?: string;
  }
): Channel | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.personality_prompt !== undefined) {
    fields.push("personality_prompt = ?");
    values.push(updates.personality_prompt);
  }
  if (updates.active !== undefined) {
    fields.push("active = ?");
    values.push(updates.active);
  }
  if (updates.priority !== undefined) {
    fields.push("priority = ?");
    values.push(updates.priority);
  }

  if (fields.length === 0) return getChannel(id);

  values.push(id);
  db.prepare(`UPDATE channels SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values
  );
  return getChannel(id);
}

export function deleteChannel(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM videos WHERE channel_id = ?").run(id);
  db.prepare("DELETE FROM channels WHERE id = ?").run(id);
}

// ---------- Conversation queries ----------

export function createConversation(
  sessionId: string,
  mode: "single" | "panel",
  channelIds: number[]
): Conversation {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO conversations (session_id, mode, channel_ids) VALUES (?, ?, ?)"
  );
  const result = stmt.run(sessionId, mode, JSON.stringify(channelIds));
  return {
    id: result.lastInsertRowid as number,
    session_id: sessionId,
    mode,
    channel_ids: JSON.stringify(channelIds),
  };
}

export function getConversation(id: number): Conversation | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(id) as Conversation | undefined;
}

export function getConversationsBySession(sessionId: string): Conversation[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM conversations WHERE session_id = ? ORDER BY id DESC"
    )
    .all(sessionId) as Conversation[];
}

// ---------- Message queries ----------

export function addMessage(
  conversationId: number,
  role: "user" | "assistant" | "system",
  content: string,
  channelId?: number | null,
  sources?: string | null
): Message {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO messages (conversation_id, role, content, channel_id, sources) VALUES (?, ?, ?, ?, ?)"
  );
  const result = stmt.run(
    conversationId,
    role,
    content,
    channelId ?? null,
    sources ?? null
  );
  return {
    id: result.lastInsertRowid as number,
    conversation_id: conversationId,
    role,
    content,
    channel_id: channelId ?? null,
    sources: sources ?? null,
  };
}

export function getMessages(conversationId: number): Message[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC"
    )
    .all(conversationId) as Message[];
}
