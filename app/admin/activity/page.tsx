"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/lib/context/UserContext";
import type { ActivityEntry, ActivityAction } from "@/lib/store/types";

const ACTION_LABELS: Record<ActivityAction, string> = {
  audit_created: "Audit Created",
  questions_confirmed: "Questions Confirmed",
  audit_run: "AI Audit Run",
  policy_patched: "Policy Patched",
  question_marked_compliant: "Marked Compliant",
  question_unmarked_compliant: "Unmarked Compliant",
  audit_signed_off: "Audit Signed Off",
  action_item_created: "Action Item Created",
  action_item_completed: "Action Item Completed",
};

const ACTION_VARIANTS: Record<ActivityAction, "success" | "info" | "warning" | "secondary"> = {
  audit_created: "info",
  questions_confirmed: "info",
  audit_run: "warning",
  policy_patched: "warning",
  question_marked_compliant: "success",
  question_unmarked_compliant: "secondary",
  audit_signed_off: "success",
  action_item_created: "info",
  action_item_completed: "success",
};

export default function ActivityLogPage() {
  const { currentUser } = useCurrentUser();
  const router = useRouter();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<ActivityAction | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (currentUser.role !== "admin") {
      router.replace("/audits");
    }
  }, [currentUser, router]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (actionFilter !== "all") params.set("action", actionFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    setLoading(true);
    fetch(`/api/admin/activity?${params}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .finally(() => setLoading(false));
  }, [actionFilter, fromDate, toDate]);

  if (currentUser.role !== "admin") return null;

  return (
    <div className="max-w-5xl mx-auto">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: 600; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Activity Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All major actions across the platform
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Readily — Activity Log</h1>
        <p className="text-sm text-gray-500">
          Exported {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          {actionFilter !== "all" ? ` · Filtered by: ${ACTION_LABELS[actionFilter]}` : ""}
          {fromDate || toDate ? ` · ${fromDate || "start"} – ${toDate || "now"}` : ""}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 no-print">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as ActivityAction | "all")}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {(Object.keys(ACTION_LABELS) as ActivityAction[]).map((a) => (
              <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="w-44"
          placeholder="From"
        />
        <span className="text-muted-foreground text-sm">–</span>
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="w-44"
          placeholder="To"
        />
        {(actionFilter !== "all" || fromDate || toDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setActionFilter("all"); setFromDate(""); setToDate(""); }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2 no-print">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-lg border bg-white animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center py-16 text-muted-foreground text-sm no-print">
          No activity entries found.
        </p>
      ) : (
        <div className="rounded-xl border overflow-hidden print:overflow-visible print:rounded-none">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 w-44">Timestamp</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 w-44">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 w-36">Actor</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 w-40">Audit</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((entry) => (
                <tr key={entry.id} className="bg-white hover:bg-slate-50 transition-colors print:break-inside-avoid">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ACTION_VARIANTS[entry.action]}>
                      {ACTION_LABELS[entry.action]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">{entry.actor}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[160px] print:max-w-none print:whitespace-normal">
                    {entry.auditName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{entry.details ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4 no-print">
        {entries.length} {entries.length === 1 ? "entry" : "entries"}
      </p>
    </div>
  );
}
