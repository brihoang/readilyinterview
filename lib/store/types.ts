export type ActivityAction =
  | "audit_created"
  | "questions_confirmed"
  | "audit_run"
  | "policy_patched"
  | "question_marked_compliant"
  | "question_unmarked_compliant"
  | "audit_signed_off";

export interface ActivityEntry {
  id: string;
  timestamp: string;
  action: ActivityAction;
  actor: string;
  auditId?: string;
  auditName?: string;
  details?: string;
}

export type AuditStatus =
  | "idle"
  | "uploading"
  | "extracting"
  | "review"
  | "ready"
  | "evaluating"
  | "complete"
  | "archived";

export type Verdict = "pass" | "fail" | "partial" | "pending";

export type ComplianceFramework =
  | "HIPAA"
  | "CMS Conditions of Participation"
  | "Joint Commission"
  | "NCQA"
  | "State Health Department"
  | "Other";

export interface AcceptedPatch {
  originalText: string;
  patchedText: string;
  reasoning: string;
  acceptedBy: string;
  acceptedAt: string;
}

export interface PolicyDocument {
  id: string;
  title: string;
  filename: string;
  folder: string;
  category: string;
  dateAdded: string;
  chunks: PolicyChunk[];
  rawText: string;
  isPatched?: boolean;
  patches?: AcceptedPatch[];
}

export interface PolicyChunk {
  id: string;
  documentId: string;
  sectionTitle: string;
  text: string;
  chunkIndex: number;
}

export interface Question {
  id: string;
  auditId: string;
  orderIndex: number;
  category: string;
  text: string;
  source: string;
  isEdited: boolean;
}

export interface PolicyPatch {
  originalText: string;
  patchedText: string;
  reasoning: string;
}

export interface QuestionResult {
  questionId: string;
  verdict: Verdict;
  confidence: number;
  evidenceText: string;
  sourceDocumentId: string;
  sourceDocumentTitle: string;
  sourceSectionTitle: string;
  reasoning: string;
  estimatedExposure?: { low: number; high: number };
  evaluatedAt: string;
  markedCompliant?: boolean;
  markedCompliantAt?: string;
  markedCompliantBy?: string;
}

export interface Audit {
  id: string;
  name: string;
  organization: string;
  framework: ComplianceFramework;
  targetDate: string;
  notes: string;
  createdAt: string;
  status: AuditStatus;
  questionnaireFileName: string | null;
  questions: Question[];
  results: Record<string, QuestionResult>;
  iterationCount: number;
  runMode?: "all" | "failed-only";
  createdBy?: string;
  archivedBy?: string;
  archivedAt?: string;
}

export interface AuditSummary {
  id: string;
  name: string;
  organization: string;
  framework: ComplianceFramework;
  targetDate: string;
  createdAt: string;
  status: AuditStatus;
  questionCount: number;
  passCount: number;
  failCount: number;
  partialCount: number;
  markedCompliantCount: number;
  iterationCount: number;
  createdBy?: string;
  archivedBy?: string;
  archivedAt?: string;
}
