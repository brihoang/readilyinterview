import { nanoid } from "nanoid";
import type { Audit, PolicyDocument, PolicyChunk, AuditSummary } from "./types";

class InMemoryStore {
  private audits: Map<string, Audit> = new Map();
  private policyDocuments: Map<string, PolicyDocument> = new Map();

  // --- Policy Documents ---

  addPolicyDocument(doc: Omit<PolicyDocument, "id">): PolicyDocument {
    const id = nanoid();
    const full = { ...doc, id };
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

  // --- Audits ---

  createAudit(data: {
    name: string;
    organization: string;
    framework: Audit["framework"];
    targetDate: string;
    notes: string;
  }): Audit {
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

  updateAudit(id: string, updates: Partial<Audit>): Audit | undefined {
    const audit = this.audits.get(id);
    if (!audit) return undefined;
    const updated = { ...audit, ...updates };
    this.audits.set(id, updated);
    return updated;
  }

  deleteAudit(id: string): boolean {
    return this.audits.delete(id);
  }
}

// Module-level singleton
const globalForStore = globalThis as unknown as { store?: InMemoryStore };
export const store = globalForStore.store ?? new InMemoryStore();
if (process.env.NODE_ENV !== "production") {
  globalForStore.store = store;
}
