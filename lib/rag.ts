import { getDb, type Video } from "./db";

export interface TranscriptChunk {
  videoId: number;
  videoTitle: string;
  videoUrl: string;
  channelId: number;
  text: string;
  score: number;
}

/**
 * Extract meaningful keywords from the user's query.
 * Strips common stop-words so we match on substantive terms.
 */
function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "just",
    "because", "but", "and", "or", "if", "while", "about", "up", "it",
    "he", "she", "they", "we", "you", "i", "me", "my", "your", "his",
    "her", "its", "our", "their", "what", "which", "who", "whom", "this",
    "that", "these", "those", "am", "tell", "know", "think", "want",
    "like", "get", "make", "go", "see", "look", "come", "find", "give",
    "use", "say", "said", "also", "well", "back", "much", "even",
  ]);

  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

/**
 * Split a transcript into overlapping chunks of roughly `chunkSize` words.
 */
function chunkTranscript(
  transcript: string,
  chunkSize = 500,
  overlap = 100
): string[] {
  const words = transcript.split(/\s+/);
  const chunks: string[] = [];

  if (words.length <= chunkSize) {
    return [transcript];
  }

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    chunks.push(chunk);
    if (i + chunkSize >= words.length) break;
  }

  return chunks;
}

/**
 * Escape special regex characters in a string so it can be safely used in new RegExp().
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Score a chunk by counting keyword occurrences.
 */
function scoreChunk(chunk: string, keywords: string[]): number {
  const lower = chunk.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${escapeRegExp(kw)}\\b`, "gi");
    const matches = lower.match(regex);
    if (matches) {
      score += matches.length;
    }
  }
  return score;
}

/**
 * Search the database for relevant transcript chunks given a query.
 * Optionally filter by a single channel.
 */
export function searchTranscripts(
  query: string,
  channelId?: number | null,
  topK = 3
): TranscriptChunk[] {
  const db = getDb();
  const keywords = extractKeywords(query);

  if (keywords.length === 0) {
    return [];
  }

  // Build a SQL query that matches any keyword in the transcript
  const likeConditions = keywords
    .slice(0, 8) // limit to 8 keywords for performance
    .map(() => "transcript LIKE ?")
    .join(" OR ");

  const params = keywords.slice(0, 8).map((k) => `%${k}%`);

  let sql = `
    SELECT id, channel_id, video_id, title, url, transcript
    FROM videos
    WHERE transcript IS NOT NULL
      AND transcript != ''
      AND (${likeConditions})
  `;

  if (channelId) {
    sql += ` AND channel_id = ?`;
    params.push(String(channelId));
  }

  sql += ` LIMIT 20`;

  const videos = db.prepare(sql).all(...params) as Video[];

  // Chunk and score all matching transcripts
  const allChunks: TranscriptChunk[] = [];

  for (const video of videos) {
    if (!video.transcript) continue;

    const chunks = chunkTranscript(video.transcript);
    for (const chunkText of chunks) {
      const score = scoreChunk(chunkText, keywords);
      if (score > 0) {
        allChunks.push({
          videoId: video.id,
          videoTitle: video.title,
          videoUrl: video.url,
          channelId: video.channel_id,
          text: chunkText,
          score,
        });
      }
    }
  }

  // Sort by score descending and return top K
  allChunks.sort((a, b) => b.score - a.score);
  return allChunks.slice(0, topK);
}
