"use client";

import { useEffect, useState } from "react";
import { FolderOpen, FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface PolicyDoc {
  id: string;
  title: string;
  filename: string;
  folder: string;
  category: string;
  dateAdded: string;
  chunkCount: number;
}

export default function PoliciesPage() {
  const [docs, setDocs] = useState<PolicyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d) => setDocs(d.documents ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = docs.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.folder.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase()),
  );

  // Group by folder
  const grouped = filtered.reduce<Record<string, PolicyDoc[]>>((acc, doc) => {
    if (!acc[doc.folder]) acc[doc.folder] = [];
    acc[doc.folder].push(doc);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Policy Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? "Loading..."
              : `${docs.length} policy documents across ${Object.keys(grouped).length} categories`}
          </p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search policies..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-5 w-32 rounded bg-muted animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((j) => (
                  <div
                    key={j}
                    className="h-20 rounded-xl border bg-white animate-pulse"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-slate-700">No policies found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search
                ? "Try a different search term"
                : "Policy documents will appear here once loaded"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([folder, folderDocs]) => (
              <div key={folder}>
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-slate-700">
                    {folderDocs[0].category}
                  </h2>
                  <Badge variant="secondary" className="text-xs">
                    {folder}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {folderDocs.length} documents
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {folderDocs.map((doc) => (
                    <Card
                      key={doc.id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p
                              className="text-sm font-medium text-slate-800 truncate"
                              title={doc.title}
                            >
                              {doc.title || doc.filename}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {doc.filename}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {doc.chunkCount} sections
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
