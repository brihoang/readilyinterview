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

async function kvWritePatches(docId: string, patches: AcceptedPatch[]): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`patch:${docId}`, JSON.stringify(patches));
    await redis.sadd("patched_doc_ids", docId);
  } catch (e) {
    console.warn("[store] Redis patch write failed:", e);
  }
}

async function kvLoadAllPatches(): Promise<Record<string, AcceptedPatch[]>> {
  const redis = getRedis();
  if (!redis) return {};
  try {
    const ids: string[] = await redis.smembers("patched_doc_ids");
    if (ids.length === 0) return {};
    const raw = await Promise.all(ids.map((id) => redis.get(`patch:${id}`)));
    const result: Record<string, AcceptedPatch[]> = {};
    for (let i = 0; i < ids.length; i++) {
      const entry = raw[i];
      if (!entry) continue;
      result[ids[i]] = typeof entry === "string" ? JSON.parse(entry) : entry;
    }
    return result;
  } catch (e) {
    console.warn("[store] Redis patch load failed:", e);
    return {};
  }
}

async function kvClearPatches(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const ids: string[] = await redis.smembers("patched_doc_ids");
    if (ids.length > 0) {
      await Promise.all(ids.map((id) => redis.del(`patch:${id}`)));
    }
    await redis.del("patched_doc_ids");
  } catch (e) {
    console.warn("[store] Redis patch clear failed:", e);
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
    // Don't overwrite an existing doc — preserves any accepted patches
    if (this.policyDocuments.has(id)) return this.policyDocuments.get(id)!;
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

  async patchPolicyDocument(
    docId: string,
    patch: Omit<AcceptedPatch, "acceptedAt">,
  ): Promise<PolicyDocument | undefined> {
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
    await kvWritePatches(docId, updatedDoc.patches!);
    return updatedDoc;
  }

  async replayPersistedPatches(): Promise<void> {
    const allPatches = await kvLoadAllPatches();
    const docIds = Object.keys(allPatches);
    if (docIds.length === 0) return;
    for (const docId of docIds) {
      for (const patch of allPatches[docId]) {
        await this.patchPolicyDocument(docId, patch);
      }
    }
    console.log(`[store] Replayed patches for ${docIds.length} policy document(s)`);
  }

  async clearPatches(): Promise<void> {
    for (const [id, doc] of Array.from(this.policyDocuments.entries())) {
      if (doc.isPatched) {
        this.policyDocuments.set(id, { ...doc, isPatched: false, patches: [] });
      }
    }
    await kvClearPatches();
  }

  // --- Audits ---

  async createAudit(data: {
    name: string;
    organization: string;
    framework: Audit["framework"];
    targetDate: string;
    notes: string;
    createdBy?: string;
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
        markedCompliantCount: results.filter((r) => r.markedCompliant && r.verdict !== "pass").length,
        iterationCount: a.iterationCount,
        createdBy: a.createdBy,
        archivedBy: a.archivedBy,
        archivedAt: a.archivedAt,
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
