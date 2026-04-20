import { nanoid } from "nanoid";
import type { Audit, PolicyDocument, PolicyChunk, AuditSummary, AcceptedPatch } from "./types";

// Redis persistence via Upstash — graceful no-op when env vars are absent (local dev)
function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  const { Redis } = require("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

async function kvWrite(id: string, audit: Audit): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`audit:${id}`, JSON.stringify(audit));
    await redis.sadd("audit_ids", id);
  } catch (e) {
    console.warn("[store] Redis write failed:", e);
  }
}

async function kvRemove(id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(`audit:${id}`);
    await redis.srem("audit_ids", id);
  } catch (e) {
    console.warn("[store] Redis delete failed:", e);
  }
}

async function kvClear(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const ids: string[] = await redis.smembers("audit_ids");
    if (ids.length > 0) {
      await Promise.all(ids.map((id) => redis.del(`audit:${id}`)));
    }
    await redis.del("audit_ids");
  } catch (e) {
    console.warn("[store] Redis clear failed:", e);
  }
}

class InMemoryStore {
  private audits: Map<string, Audit> = new Map();
  private policyDocuments: Map<string, PolicyDocument> = new Map();
  private auditsLoaded = false;
  private auditsLoading = false;

  // Load audits from Redis on cold start
  async ensureAuditsLoaded(): Promise<void> {
    if (this.auditsLoaded || this.auditsLoading) return;
    const redis = getRedis();
    if (!redis) {
      this.auditsLoaded = true;
      return;
    }
    this.auditsLoading = true;
    try {
      const ids: string[] = await redis.smembers("audit_ids");
      const raw = await Promise.all(
        ids.map((id) => redis.get(`audit:${id}`)),
      );
      for (const entry of raw) {
        if (!entry) continue;
        const audit: Audit =
          typeof entry === "string" ? JSON.parse(entry) : entry;
        this.audits.set(audit.id, audit);
      }
      console.log(`[store] Loaded ${this.audits.size} audits from Redis`);
    } catch (e) {
      console.warn("[store] Redis load failed, continuing with empty store:", e);
    } finally {
      this.auditsLoaded = true;
      this.auditsLoading = false;
    }
  }

  // --- Policy Documents ---

  addPolicyDocument(doc: Omit<PolicyDocument, "id">): PolicyDocument {
    // Deterministic ID from filename so IDs are stable across server restarts
    const id = `doc_${doc.folder}_${doc.filename}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const chunks = doc.chunks.map((c) => ({ ...c, documentId: id }));
    const full = { ...doc, id, chunks };
    this.policyDocuments.set(id, full);
    return full;
  }

  getPolicyDocuments(): PolicyDocument[] {
    return Array.from(this.policyDocuments.values());
  }

  getPolicyDocument(id: string): PolicyDocument | undefined {
    return this.policyDocuments.get(id);
  }

  getAllChunks(): PolicyChunk[] {
    return Array.from(this.policyDocuments.values()).flatMap((d) => d.chunks);
  }

  hasPolicyDocuments(): boolean {
    return this.policyDocuments.size > 0;
  }

  patchPolicyDocument(
    docId: string,
    patch: Omit<AcceptedPatch, "acceptedAt">,
  ): PolicyDocument | undefined {
    const doc = this.policyDocuments.get(docId);
    if (!doc) return undefined;

    let applied = false;
    const updatedChunks = doc.chunks.map((chunk) => {
      if (!applied && patch.originalText && chunk.text.includes(patch.originalText)) {
        applied = true;
        return { ...chunk, text: chunk.text.replace(patch.originalText, patch.patchedText) };
      }
      return chunk;
    });

    // No matching chunk (fail case — no existing policy) — append new chunk
    if (!applied) {
      updatedChunks.push({
        id: nanoid(),
        documentId: docId,
        sectionTitle: "Policy Update",
        text: patch.patchedText,
        chunkIndex: updatedChunks.length,
      });
    }

    const acceptedPatch: AcceptedPatch = {
      ...patch,
      acceptedAt: new Date().toISOString(),
    };

    const updatedDoc: PolicyDocument = {
      ...doc,
      chunks: updatedChunks,
      isPatched: true,
      patches: [...(doc.patches ?? []), acceptedPatch],
    };

    this.policyDocuments.set(docId, updatedDoc);
    return updatedDoc;
  }

  // --- Audits ---

  async createAudit(data: {
    name: string;
    organization: string;
    framework: Audit["framework"];
    targetDate: string;
    notes: string;
  }): Promise<Audit> {
    const id = nanoid();
    const audit: Audit = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
      status: "idle",
      questionnaireFileName: null,
      questions: [],
      results: {},
      iterationCount: 0,
    };
    this.audits.set(id, audit);
    await kvWrite(id, audit);
    return audit;
  }

  getAudit(id: string): Audit | undefined {
    return this.audits.get(id);
  }

  getAuditSummaries(): AuditSummary[] {
    return Array.from(this.audits.values()).map((a) => {
      const results = Object.values(a.results);
      return {
        id: a.id,
        name: a.name,
        organization: a.organization,
        framework: a.framework,
        targetDate: a.targetDate,
        createdAt: a.createdAt,
        status: a.status,
        questionCount: a.questions.length,
        passCount: results.filter((r) => r.verdict === "pass").length,
        failCount: results.filter((r) => r.verdict === "fail").length,
        partialCount: results.filter((r) => r.verdict === "partial").length,
        iterationCount: a.iterationCount,
      };
    });
  }

  async updateAudit(
    id: string,
    updates: Partial<Audit>,
  ): Promise<Audit | undefined> {
    const audit = this.audits.get(id);
    if (!audit) return undefined;
    const updated = { ...audit, ...updates };
    this.audits.set(id, updated);
    await kvWrite(id, updated);
    return updated;
  }

  async deleteAudit(id: string): Promise<boolean> {
    const deleted = this.audits.delete(id);
    await kvRemove(id);
    return deleted;
  }

  async clearAudits(): Promise<void> {
    this.audits.clear();
    await kvClear();
  }
}

// Module-level singleton — persists across requests within the same warm instance
const globalForStore = globalThis as unknown as { store?: InMemoryStore };
export const store = globalForStore.store ?? new InMemoryStore();
globalForStore.store = store;
