"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  CalendarDays,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/context/UserContext";

interface AuditRow {
  id: string;
  name: string;
  framework: string;
  status: string;
  totalQuestions: number;
  passing: number;
  outstanding: number;
  exposureOpen: number;
  exposureClosed: number;
}

interface AnalyticsData {
  outstandingCount: number;
  exposureOpen: number;
  exposureClosed: number;
  resolvedLast7: number;
  resolvedLast30: number;
  totalAudits: number;
  auditRows: AuditRow[];
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { currentUser } = useCurrentUser();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-48 rounded bg-muted animate-pulse mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-xl border bg-white animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const activeAuditRows = data.auditRows.filter((r) => r.status !== "archived");
  const archivedRows = data.auditRows.filter((r) => r.status === "archived");

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compliance posture across all audits
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label="Outstanding Issues"
          value={String(data.outstandingCount)}
          sub="across all active audits"
          color="bg-red-50"
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-red-600" />}
          label="Exposure Open"
          value={data.exposureOpen > 0 ? fmt(data.exposureOpen) : "—"}
          sub="estimated financial risk"
          color="bg-red-50"
        />
        <StatCard
          icon={<TrendingDown className="h-5 w-5 text-emerald-600" />}
          label="Exposure Closed"
          value={data.exposureClosed > 0 ? fmt(data.exposureClosed) : "—"}
          sub="resolved via patches & sign-offs"
          color="bg-emerald-50"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          label="Resolved — Last 7 Days"
          value={String(data.resolvedLast7)}
          sub="questions marked compliant"
          color="bg-emerald-50"
        />
        <StatCard
          icon={<CalendarDays className="h-5 w-5 text-blue-600" />}
          label="Resolved — Last 30 Days"
          value={String(data.resolvedLast30)}
          sub="questions marked compliant"
          color="bg-blue-50"
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5 text-violet-600" />}
          label="Total Audits"
          value={String(data.totalAudits)}
          sub={`${archivedRows.length} signed off`}
          color="bg-violet-50"
        />
      </div>

      {/* Per-audit breakdown */}
      {activeAuditRows.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Active Audits</h2>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Audit</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 w-32">Framework</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 w-24">Passing</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 w-28">Outstanding</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 w-32">Open Exposure</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeAuditRows.map((row) => (
                  <tr
                    key={row.id}
                    className="bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/audits/${row.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{row.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{row.framework}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                      {row.passing}/{row.totalQuestions}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.outstanding > 0 ? (
                        <span className="text-red-600 font-medium">{row.outstanding}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.exposureOpen > 0 ? (
                        <span className="text-red-600 font-medium">{fmt(row.exposureOpen)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {archivedRows.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-3">Signed Off</h2>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Audit</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 w-32">Framework</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 w-36">Exposure Closed</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {archivedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/audits/${row.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{row.framework}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.exposureClosed > 0 ? (
                        <span className="text-emerald-700 font-medium">{fmt(row.exposureClosed)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.totalAudits === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-4" />
          <p className="text-slate-600 font-medium">No audit data yet</p>
          <p className="text-sm text-muted-foreground mt-1">Run your first audit to see analytics here.</p>
        </div>
      )}
    </div>
  );
}
