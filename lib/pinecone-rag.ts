import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ---- singleton clients ----

let _pinecone: Pinecone | null = null;
let _genai: GoogleGenerativeAI | null = null;

function getPinecone(): Pinecone {
  if (!_pinecone) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) throw new Error("PINECONE_API_KEY is not set");
    _pinecone = new Pinecone({ apiKey });
  }
  return _pinecone;
}

function getGenAI(): GoogleGenerativeAI {
  if (!_genai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    _genai = new GoogleGenerativeAI(apiKey);
  }
  return _genai;
}

// ---- constants ----

const INDEX_NAME = "expert-knowledge";
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const DEFAULT_TOP_K = 5;
const MIN_SCORE = 0.35;

// ---- types ----

export interface PineconeChunk {
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  channelName: string;
  chunkIndex: number;
  text: string;
  score: number;
  publishedAt: string | null;
}

// ---- helpers ----

/**
 * Slugify a channel name/handle to match Pinecone namespace convention.
 * e.g. "DaviddTech" -> "davidd-tech", "@DaviddTech" -> "davidd-tech"
 */
export function toNamespace(name: string): string {
  return name
    .replace(/^@/, "")                     // strip leading @
    .replace(/([a-z])([A-Z])/g, "$1-$2")  // camelCase -> camel-Case
    .replace(/[^a-z0-9]+/gi, "-")          // non-alphanumeric -> dash
    .replace(/^-+|-+$/g, "")              // trim leading/trailing dashes
    .toLowerCase();
}

/**
 * Embed a query using Gemini embedding model (task_type: RETRIEVAL_QUERY).
 */
async function embedQuery(text: string): Promise<number[]> {
  const genai = getGenAI();
  const model = genai.getGenerativeModel({ model: EMBEDDING_MODEL });

  const result = await model.embedContent({
    content: { parts: [{ text }], role: "user" },
    taskType: "RETRIEVAL_QUERY" as any,
  });

  const values = result.embedding.values;

  // Sanity check dimensions
  if (values.length !== EMBEDDING_DIMENSIONS) {
    console.warn(
      `Embedding returned ${values.length} dims, expected ${EMBEDDING_DIMENSIONS}`
    );
  }

  return values;
}

/**
 * Query Pinecone for relevant chunks in a single namespace.
 */
async function queryNamespace(
  queryEmbedding: number[],
  namespace: string,
  topK: number = DEFAULT_TOP_K
): Promise<PineconeChunk[]> {
  const pc = getPinecone();
  const index = pc.index(INDEX_NAME);

  const result = await index.namespace(namespace).query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  if (!result.matches || result.matches.length === 0) {
    return [];
  }

  return result.matches
    .filter((match) => (match.score || 0) >= MIN_SCORE)
    .map((match) => {
      const meta = match.metadata || {};
      return {
        videoId: (meta.video_id as string) || "",
        videoTitle: (meta.title as string) || "Unknown",
        videoUrl: (meta.url as string) || "",
        channelName: (meta.channel_name as string) || "",
        chunkIndex: (meta.chunk_index as number) || 0,
        text: (meta.chunk_text as string) || "",
        score: match.score || 0,
        publishedAt: (meta.published_at as string) || null,
      };
    });
}

// ---- public API ----

/**
 * Search Pinecone for relevant transcript chunks given a query.
 * Works for single-channel mode: one namespace.
 */
export async function searchPinecone(
  query: string,
  namespace: string,
  topK: number = DEFAULT_TOP_K
): Promise<PineconeChunk[]> {
  try {
    const embedding = await embedQuery(query);
    const chunks = await queryNamespace(embedding, namespace, topK);
    return chunks;
  } catch (error) {
    console.error("Pinecone search failed:", error);
    return [];
  }
}

/**
 * Search Pinecone across multiple namespaces (panel mode).
 * Returns a map of namespace -> chunks.
 */
export async function searchPineconeMulti(
  query: string,
  namespaces: string[],
  topK: number = DEFAULT_TOP_K
): Promise<Map<string, PineconeChunk[]>> {
  const results = new Map<string, PineconeChunk[]>();

  try {
    // Embed once, query each namespace in parallel
    const embedding = await embedQuery(query);

    const queries = namespaces.map(async (ns) => {
      const chunks = await queryNamespace(embedding, ns, topK);
      results.set(ns, chunks);
    });

    await Promise.all(queries);
  } catch (error) {
    console.error("Pinecone multi-search failed:", error);
    // Return empty results for all namespaces on error
    for (const ns of namespaces) {
      if (!results.has(ns)) {
        results.set(ns, []);
      }
    }
  }

  return results;
}
