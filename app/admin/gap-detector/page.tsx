"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ScanSearch, ChevronDown, ChevronRight, Loader2, Wand2, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/context/UserContext";
import type { PolicyAnalysis } from "@/lib/ai/analyzePolicy";

interface PolicyDoc {
  id: string;
  title: string;
  folder: string;
  category: string;
  chunkCount: number;
}

interface GapResult extends PolicyAnalysis {
  docId: string;
  title: string;
  folder: string;
  category: string;
  isPatched: boolean;
}

interface FixState {
  loading: boolean;
  improvedText: string;
  changesSummary: string;
  originalText: string;
  applied: boolean;
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  missing_coverage: "Missing Coverage",
  vague_language: "Vague Language",
  outdated: "Outdated",
  contradiction: "Contradiction",
};

const SEVERITY_CONFIG = {
  high: { label: "High Risk", border: "border-l-red-500", bg: "bg-red-50/50", dot: "bg-red-500", badge: "destructive" as const },
  medium: { label: "Medium Risk", border: "border-l-amber-400", bg: "bg-amber-50/50", dot: "bg-amber-400", badge: "warning" as const },
  low: { label: "Low Risk", border: "border-l-blue-400", bg: "bg-blue-50/40", dot: "bg-blue-400", badge: "info" as const },
  none: { label: "No Issues", border: "border-l-emerald-400", bg: "bg-white", dot: "bg-emerald-400", badge: "success" as const },
};

function groupByFolder(docs: PolicyDoc[]) {
  const map = new Map<string, { category: string; docs: PolicyDoc[] }>();
  for (const d of docs) {
    if (!map.has(d.folder)) map.set(d.folder, { category: d.category, docs: [] });
    map.get(d.folder)!.docs.push(d);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export default function GapDetectorPage() {
  const { currentUser } = useCurrentUser();
  const router = useRouter();

  const [docs, setDocs] = useState<PolicyDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<GapResult[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [fixes, setFixes] = useState<Map<string, FixState>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (currentUser.role !== "admin") router.replace("/audits");
  }, [currentUser, router]);

  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d) => setDocs(d.documents ?? []))
      .finally(() => setLoadingDocs(false));
  }, []);

  if (currentUser.role !== "admin") return null;

  const folders = groupByFolder(docs);
  const selectedDocs = selectedFolder === "all" ? docs : docs.filter((d) => d.folder === selectedFolder);

  async function runAnalysis() {
    if (running) return;
    setRunning(true);
    setResults([]);
    setExpanded(new Set());
    setFixes(new Map());
    setProgress({ done: 0, total: selectedDocs.length });

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/admin/gap-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: selectedFolder === "all" ? undefined : selectedFolder }),
        signal: ctrl.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.done) {
              setProgress((p) => ({ ...p, done: parsed.total }));
              return;
            }
            setResults((prev) => [...prev, parsed as GapResult]);
            setProgress((p) => ({ ...p, done: p.done + 1 }));
            if (parsed.fragile) {
              setExpanded((prev) => new Set(Array.from(prev).concat(parsed.docId)));
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error("Analysis failed. Check your API key and try again.");
      }
    } finally {
      setRunning(false);
    }
  }

  async function generateFix(docId: string, issueIdx: number, issueDescription: string, issueType: string, section: string) {
    const key = `${docId}:${issueIdx}`;
    setFixes((prev) => new Map(prev).set(key, { loading: true, improvedText: "", changesSummary: "", originalText: "", applied: false }));

    try {
      const res = await fetch("/api/admin/gap-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, issueDescription, issueType, section }),
      });
      const data = await res.json();
      setFixes((prev) => new Map(prev).set(key, {
        loading: false,
        improvedText: data.improvedText ?? "",
        changesSummary: data.changesSummary ?? "",
        originalText: data.originalText ?? "",
        applied: false,
      }));
    } catch {
      toast.error("Failed to generate fix.");
      setFixes((prev) => { const m = new Map(prev); m.delete(key); return m; });
    }
  }

  async function applyPatch(docId: string, issueIdx: number) {
    const key = `${docId}:${issueIdx}`;
    const fix = fixes.get(key);
    if (!fix) return;

    try {
      const res = await fetch("/api/admin/gap-patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId,
          originalText: fix.originalText,
          patchedText: fix.improvedText,
          reasoning: fix.changesSummary,
          acceptedBy: currentUser.displayName,
        }),
      });
      if (!res.ok) throw new Error("Patch failed");
      setFixes((prev) => new Map(prev).set(key, { ...fix, applied: true }));
      toast.success("Patch applied successfully.");
    } catch {
      toast.error("Failed to apply patch.");
    }
  }

  const fragileCount = results.filter((r) => r.fragile).length;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Policy Gap Detector</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze policy documents for compliance weaknesses and generate targeted fixes
          </p>
        </div>
      </div>

      {/* Category picker */}
      <div className="bg-white border rounded-xl p-4 mb-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Select Scope</p>
        {loadingDocs ? (
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-9 w-28 rounded-lg bg-slate-100 animate-pulse" />)}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedFolder("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
                selectedFolder === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-slate-700 border-slate-200 hover:border-primary/50",
              )}
            >
              All ({docs.length})
            </button>
            {folders.map(([folder, { category, docs: fdocs }]) => (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
                  selectedFolder === folder
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white text-slate-700 border-slate-200 hover:border-primary/50",
                )}
              >
                {folder} — {category} ({fdocs.length})
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedDocs.length} {selectedDocs.length === 1 ? "document" : "documents"} selected
            {running && (
              <span className="ml-2 text-primary font-medium">
                — Analyzing {progress.done} / {progress.total}…
              </span>
            )}
            {!running && results.length > 0 && (
              <span className="ml-2">
                — {fragileCount} fragile {fragileCount === 1 ? "policy" : "policies"} found
              </span>
            )}
          </p>
          <Button onClick={runAnalysis} disabled={running || loadingDocs || selectedDocs.length === 0}>
            {running ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>
            ) : (
              <><ScanSearch className="h-4 w-4" /> Run Analysis</>
            )}
          </Button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((result) => {
            const cfg = SEVERITY_CONFIG[result.severity];
            const isExpanded = expanded.has(result.docId);

            return (
              <div
                key={result.docId}
                className={cn("border rounded-xl border-l-4 overflow-hidden", cfg.border, cfg.bg)}
              >
                {/* Card header */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 transition-colors"
                  onClick={() => setExpanded((prev) => {
                    const next = new Set(prev);
                    next.has(result.docId) ? next.delete(result.docId) : next.add(result.docId);
                    return next;
                  })}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", cfg.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800 text-sm truncate">{result.title}</span>
                      {result.isPatched && (
                        <Badge variant="secondary" className="text-[10px]">Patched</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{result.summary}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={cfg.badge}>{cfg.label}</Badge>
                    <Badge variant="outline" className="text-xs">{result.folder}</Badge>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Issues */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 space-y-4">
                    {result.issues.length === 0 ? (
                      <p className="text-sm text-emerald-700 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> No issues found — this policy appears compliant.
                      </p>
                    ) : (
                      result.issues.map((issue, idx) => {
                        const key = `${result.docId}:${idx}`;
                        const fix = fixes.get(key);

                        return (
                          <div key={idx} className="bg-white border rounded-lg p-3 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                    {ISSUE_TYPE_LABELS[issue.type] ?? issue.type}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{issue.section}</span>
                                </div>
                                <p className="text-sm text-slate-700">{issue.description}</p>
                              </div>
                              {!fix && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="shrink-0 text-xs h-7"
                                  onClick={() => generateFix(result.docId, idx, issue.description, issue.type, issue.section)}
                                >
                                  <Wand2 className="h-3 w-3" />
                                  Generate Fix
                                </Button>
                              )}
                            </div>

                            {fix && !fix.applied && (
                              <div className="mt-2 space-y-2">
                                {fix.loading ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Generating fix…
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-start gap-1.5 text-xs text-blue-700 bg-blue-50 rounded p-2">
                                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                      <span>{fix.changesSummary}</span>
                                    </div>
                                    <Textarea
                                      value={fix.improvedText}
                                      onChange={(e) => setFixes((prev) => new Map(prev).set(key, { ...fix, improvedText: e.target.value }))}
                                      rows={6}
                                      className="text-xs font-mono"
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs"
                                        onClick={() => setFixes((prev) => { const m = new Map(prev); m.delete(key); return m; })}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => applyPatch(result.docId, idx)}
                                      >
                                        Apply Patch
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            {fix?.applied && (
                              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded p-2 mt-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Patch applied successfully
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {running && (
            <div className="flex items-center gap-3 py-4 px-4 border rounded-xl bg-white">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Analyzing document {progress.done + 1} of {progress.total}…
              </span>
            </div>
          )}
        </div>
      )}

      {!running && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No analysis run yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Select a policy category above and click Run Analysis to identify compliance gaps.
          </p>
        </div>
      )}
    </div>
  );
}
