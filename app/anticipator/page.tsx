"use client";

import { useState, useEffect, useCallback } from "react";
import { Radar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RegulationCard } from "@/components/anticipator/RegulationCard";
import { ScanEmptyState } from "@/components/anticipator/ScanEmptyState";
import type { FederalDocument, PolicyRecommendation } from "@/lib/store/types";
import { toast } from "sonner";

export default function AnticipatorPage() {
  const [documents, setDocuments] = useState<FederalDocument[]>([]);
  const [recommendations, setRecommendations] = useState<
    Record<string, PolicyRecommendation>
  >({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    const res = await fetch("/api/anticipator/regulations");
    if (!res.ok) return;
    const data = await res.json();
    setDocuments(data.documents ?? []);
    setRecommendations(data.recommendations ?? {});
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/anticipator/scan", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed to reach the Federal Register. Try again.");
        return;
      }
      const data = await res.json();
      await loadData();
      toast.success(
        data.added > 0
          ? `Found ${data.added} new regulation${data.added === 1 ? "" : "s"}`
          : "No new regulations since last scan",
      );
    } finally {
      setScanning(false);
    }
  };

  const handleAnalyze = async (id: string) => {
    setAnalyzingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/anticipator/${id}/analyze`, {
        method: "POST",
      });
      if (!res.ok || !res.body) {
        toast.error("Analysis request failed");
        return;
      }
      const reader = res.body.getReader();
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
          const msg = JSON.parse(line);
          if (msg.done && msg.recommendation) {
            setRecommendations((prev) => ({
              ...prev,
              [id]: msg.recommendation,
            }));
            await loadData();
          }
          if (msg.error) {
            toast.error("Analysis failed: " + msg.error);
          }
        }
      }
    } catch {
      toast.error("Analysis failed unexpectedly");
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Radar className="h-6 w-6 text-primary" />
            Policy Anticipator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scan the Federal Register for upcoming healthcare regulations and
            identify policy gaps to address before they become compliance
            requirements.
          </p>
        </div>
        {documents.length > 0 && (
          <Button onClick={handleScan} disabled={scanning} variant="outline">
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <Radar className="h-4 w-4 mr-2" />
                Scan Again
              </>
            )}
          </Button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : documents.length === 0 ? (
        <ScanEmptyState onScan={handleScan} scanning={scanning} />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {documents.length} regulation{documents.length === 1 ? "" : "s"} ·{" "}
            {Object.keys(recommendations).length} analyzed
          </p>
          {documents.map((doc) => (
            <RegulationCard
              key={doc.id}
              doc={doc}
              recommendation={recommendations[doc.id]}
              onAnalyze={() => handleAnalyze(doc.id)}
              isAnalyzing={analyzingIds.has(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
