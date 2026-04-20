"use client";

import { useEffect, useState } from "react";
import { FileText, Search, X, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface PolicyChunk {
  id: string;
  sectionTitle: string;
  text: string;
  chunkIndex: number;
}

interface PolicyDetail {
  id: string;
  title: string;
  filename: string;
  folder: string;
  category: string;
  dateAdded: string;
  chunks: PolicyChunk[];
}

interface PolicyViewerProps {
  docId: string | null;
  onClose: () => void;
}

export function PolicyViewer({ docId, onClose }: PolicyViewerProps) {
  const [doc, setDoc] = useState<PolicyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeChunk, setActiveChunk] = useState<string | null>(null);

  useEffect(() => {
    if (!docId) {
      setDoc(null);
      setSearch("");
      setActiveChunk(null);
      return;
    }
    setLoading(true);
    setSearch("");
    setActiveChunk(null);
    fetch(`/api/policies/${docId}`)
      .then((r) => r.json())
      .then((d) => setDoc(d))
      .finally(() => setLoading(false));
  }, [docId]);

  const filteredChunks =
    doc?.chunks.filter(
      (c) =>
        search === "" ||
        c.text.toLowerCase().includes(search.toLowerCase()) ||
        c.sectionTitle.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];

  function highlight(text: string, query: string) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-inherit rounded-sm px-0.5">
          {part}
        </mark>
      ) : (
        part
      ),
    );
  }

  return (
    <Dialog open={!!docId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              {loading ? (
                <div className="h-5 w-64 rounded bg-muted animate-pulse" />
              ) : (
                <>
                  <h2 className="font-semibold text-slate-800 leading-tight">
                    {doc?.title || doc?.filename}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {doc?.folder}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {doc?.category}
                    </span>
                    {doc && (
                      <span className="text-xs text-muted-foreground">
                        · {doc.chunks.length} sections
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 -mr-2 -mt-1"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search within document..."
              className="pl-9 h-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loading || !doc}
            />
            {search && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {filteredChunks.length} match{filteredChunks.length !== 1 ? "es" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Section nav */}
          <div className="w-56 border-r overflow-y-auto shrink-0 py-2">
            {loading ? (
              <div className="px-3 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-8 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              filteredChunks.map((chunk) => (
                <button
                  key={chunk.id}
                  onClick={() => {
                    setActiveChunk(chunk.id);
                    document
                      .getElementById(`chunk-${chunk.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-1.5 hover:bg-muted/60 transition-colors ${
                    activeChunk === chunk.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-slate-600"
                  }`}
                >
                  <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
                  <span className="truncate">
                    {chunk.sectionTitle || `Section ${chunk.chunkIndex + 1}`}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                    <div className="h-24 rounded bg-muted animate-pulse" />
                  </div>
                ))}
              </div>
            ) : filteredChunks.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                No sections match your search.
              </div>
            ) : (
              filteredChunks.map((chunk) => (
                <div
                  key={chunk.id}
                  id={`chunk-${chunk.id}`}
                  className="scroll-mt-4"
                  onClick={() => setActiveChunk(chunk.id)}
                >
                  {chunk.sectionTitle && (
                    <h3 className="text-sm font-semibold text-slate-700 mb-2 pb-1 border-b">
                      {highlight(chunk.sectionTitle, search)}
                    </h3>
                  )}
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {highlight(chunk.text, search)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
