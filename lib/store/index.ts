import { nanoid } from "nanoid";
import type {
  Audit,
  PolicyDocument,
  PolicyChunk,
  AuditSummary,
  AcceptedPatch,
  ActivityEntry,
  ActivityAction,
  ActionItem,
  FederalDocument,
  PolicyRecommendation,
} from "./types";

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

async function kvWriteActivity(entry: ActivityEntry): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`activity:${entry.id}`, JSON.stringify(entry));
    await redis.lpush("activity_ids", entry.id);
  } catch (e) {
    console.warn("[store] Redis activity write failed:", e);
  }
}

async function kvLoadActivities(): Promise<ActivityEntry[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const ids: string[] = await redis.lrange("activity_ids", 0, -1);
    if (ids.length === 0) return [];
    const raw = await Promise.all(ids.map((id) => redis.get(`activity:${id}`)));
    return raw
      .filter(Boolean)
      .map((e) => (typeof e === "string" ? JSON.parse(e) : e) as ActivityEntry);
  } catch (e) {
    console.warn("[store] Redis activity load failed:", e);
    return [];
  }
}

async function kvClearActivities(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const ids: string[] = await redis.lrange("activity_ids", 0, -1);
    if (ids.length > 0) {
      await Promise.all(ids.map((id) => redis.del(`activity:${id}`)));
    }
    await redis.del("activity_ids");
  } catch (e) {
    console.warn("[store] Redis activity clear failed:", e);
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

async function kvWriteFedDoc(id: string, doc: FederalDocument): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`fedoc:${id}`, JSON.stringify(doc));
    await redis.sadd("fedoc_ids", id);
  } catch (e) {
    console.warn("[store] Redis fedoc write failed:", e);
  }
}

async function kvWriteActionItem(item: ActionItem): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`action_item:${item.id}`, JSON.stringify(item));
    await redis.sadd("action_item_ids", item.id);
  } catch (e) {
    console.warn("[store] Redis action item write failed:", e);
  }
}

async function kvDeleteActionItem(id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(`action_item:${id}`);
    await redis.srem("action_item_ids", id);
  } catch (e) {
    console.warn("[store] Redis action item delete failed:", e);
  }
}

async function kvLoadActionItems(): Promise<ActionItem[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const ids: string[] = await redis.smembers("action_item_ids");
    if (ids.length === 0) return [];
    const raw = await Promise.all(ids.map((id) => redis.get(`action_item:${id}`)));
    return raw
      .filter(Boolean)
      .map((e) => (typeof e === "string" ? JSON.parse(e) : e) as ActionItem);
  } catch (e) {
    console.warn("[store] Redis action items load failed:", e);
    return [];
  }
}

async function kvWriteRec(documentId: string, rec: PolicyRecommendation): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`anticipator_rec:${documentId}`, JSON.stringify(rec));
  } catch (e) {
    console.warn("[store] Redis rec write failed:", e);
  }
}

class InMemoryStore {
  private audits: Map<string, Audit> = new Map();
  private policyDocuments: Map<string, PolicyDocument> = new Map();
  private activities: ActivityEntry[] = [];
  private auditsLoaded = false;
  private auditsLoading = false;
  private activitiesLoaded = false;
  private federalDocuments: Map<string, FederalDocument> = new Map();
  private recommendations: Map<string, PolicyRecommendation> = new Map();
  private anticipatorLoaded = false;
  private anticipatorLoading = false;
  private actionItems: Map<string, ActionItem> = new Map();
  private actionItemsLoaded = false;

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
    stakeholders?: string[];
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
        stakeholders: a.stakeholders,
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

  // --- Activity Log ---

  async ensureActivitiesLoaded(): Promise<void> {
    if (this.activitiesLoaded) return;
    this.activities = await kvLoadActivities();
    this.activitiesLoaded = true;
    console.log(`[store] Loaded ${this.activities.length} activity entries from Redis`);
  }

  async addActivity(entry: Omit<ActivityEntry, "id" | "timestamp">): Promise<void> {
    const full: ActivityEntry = {
      ...entry,
      id: nanoid(),
      timestamp: new Date().toISOString(),
    };
    this.activities.unshift(full);
    await kvWriteActivity(full);
  }

  getActivities(): ActivityEntry[] {
    return this.activities;
  }

  async clearActivities(): Promise<void> {
    this.activities = [];
    this.activitiesLoaded = false;
    await kvClearActivities();
  }

  // --- Policy Anticipator ---

  async ensureAnticipatorLoaded(): Promise<void> {
    if (this.anticipatorLoaded || this.anticipatorLoading) return;
    const redis = getRedis();
    if (!redis) {
      this.anticipatorLoaded = true;
      return;
    }
    this.anticipatorLoading = true;
    try {
      const ids: string[] = await redis.smembers("fedoc_ids");
      const rawDocs = await Promise.all(ids.map((id) => redis.get(`fedoc:${id}`)));
      for (const entry of rawDocs) {
        if (!entry) continue;
        const doc: FederalDocument = typeof entry === "string" ? JSON.parse(entry) : entry;
        this.federalDocuments.set(doc.id, doc);
      }
      const recKeys = ids.map((id) => {
        const doc = this.federalDocuments.get(id);
        return doc ? `anticipator_rec:${doc.id}` : null;
      }).filter(Boolean) as string[];
      if (recKeys.length > 0) {
        const rawRecs = await Promise.all(recKeys.map((k) => redis.get(k)));
        for (const entry of rawRecs) {
          if (!entry) continue;
          const rec: PolicyRecommendation = typeof entry === "string" ? JSON.parse(entry) : entry;
          this.recommendations.set(rec.documentId, rec);
        }
      }
      console.log(`[store] Loaded ${this.federalDocuments.size} federal docs, ${this.recommendations.size} recommendations from Redis`);
    } catch (e) {
      console.warn("[store] Redis anticipator load failed:", e);
    } finally {
      this.anticipatorLoaded = true;
      this.anticipatorLoading = false;
    }
  }

  addFederalDocument(data: Omit<FederalDocument, "id">): FederalDocument | null {
    const existing = Array.from(this.federalDocuments.values()).find(
      (d) => d.documentNumber === data.documentNumber,
    );
    if (existing) return null;
    const id = nanoid();
    const doc: FederalDocument = { ...data, id };
    this.federalDocuments.set(id, doc);
    kvWriteFedDoc(id, doc);
    return doc;
  }

  getFederalDocuments(): FederalDocument[] {
    return Array.from(this.federalDocuments.values()).sort(
      (a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime(),
    );
  }

  getFederalDocument(id: string): FederalDocument | undefined {
    return this.federalDocuments.get(id);
  }

  async updateFederalDocument(
    id: string,
    updates: Partial<FederalDocument>,
  ): Promise<FederalDocument | undefined> {
    const doc = this.federalDocuments.get(id);
    if (!doc) return undefined;
    const updated = { ...doc, ...updates };
    this.federalDocuments.set(id, updated);
    await kvWriteFedDoc(id, updated);
    return updated;
  }

  async setRecommendation(rec: PolicyRecommendation): Promise<void> {
    this.recommendations.set(rec.documentId, rec);
    await kvWriteRec(rec.documentId, rec);
  }

  getRecommendation(documentId: string): PolicyRecommendation | undefined {
    return this.recommendations.get(documentId);
  }

  getAllRecommendations(): PolicyRecommendation[] {
    return Array.from(this.recommendations.values());
  }

  // --- Action Items ---

  async ensureActionItemsLoaded(): Promise<void> {
    if (this.actionItemsLoaded) return;
    const items = await kvLoadActionItems();
    for (const item of items) this.actionItems.set(item.id, item);
    this.actionItemsLoaded = true;
    console.log(`[store] Loaded ${this.actionItems.size} action items from Redis`);
  }

  async createActionItem(data: Omit<ActionItem, "id" | "createdAt" | "status">): Promise<ActionItem> {
    const item: ActionItem = {
      ...data,
      id: nanoid(),
      createdAt: new Date().toISOString(),
      status: "open",
    };
    this.actionItems.set(item.id, item);
    await kvWriteActionItem(item);
    return item;
  }

  getActionItem(id: string): ActionItem | undefined {
    return this.actionItems.get(id);
  }

  getActionItems(auditId?: string): ActionItem[] {
    const all = Array.from(this.actionItems.values());
    if (auditId) return all.filter((i) => i.auditId === auditId);
    return all;
  }

  async updateActionItem(id: string, updates: Partial<ActionItem>): Promise<ActionItem | undefined> {
    const item = this.actionItems.get(id);
    if (!item) return undefined;
    const updated = { ...item, ...updates };
    this.actionItems.set(id, updated);
    await kvWriteActionItem(updated);
    return updated;
  }

  async deleteActionItem(id: string): Promise<boolean> {
    const deleted = this.actionItems.delete(id);
    await kvDeleteActionItem(id);
    return deleted;
  }
}

// Version bump whenever new methods are added — forces singleton recreation on hot reload
const STORE_VERSION = 3;

const globalForStore = globalThis as unknown as {
  store?: InMemoryStore;
  storeVersion?: number;
};

if (globalForStore.storeVersion !== STORE_VERSION) {
  globalForStore.store = undefined;
  globalForStore.storeVersion = STORE_VERSION;
}

export const store = globalForStore.store ?? new InMemoryStore();
globalForStore.store = store;
