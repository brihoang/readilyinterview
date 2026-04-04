"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, ClipboardList, Building2, Calendar, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AuditSummary, ComplianceFramework } from "@/lib/store/types"

const FRAMEWORKS: ComplianceFramework[] = [
  "HIPAA",
  "CMS Conditions of Participation",
  "Joint Commission",
  "NCQA",
  "State Health Department",
  "Other",
]

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "info" | "warning" | "secondary" }> = {
  idle: { label: "Draft", variant: "secondary" },
  uploading: { label: "Uploading", variant: "info" },
  extracting: { label: "Extracting", variant: "info" },
  review: { label: "Review", variant: "warning" },
  ready: { label: "Ready", variant: "info" },
  evaluating: { label: "Evaluating", variant: "warning" },
  complete: { label: "Complete", variant: "success" },
}

export default function AuditsPage() {
  const router = useRouter()
  const [audits, setAudits] = useState<AuditSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: "",
    organization: "",
    framework: "" as ComplianceFramework | "",
    targetDate: "",
    notes: "",
  })

  useEffect(() => {
    fetch("/api/audits")
      .then((r) => r.json())
      .then((d) => setAudits(d.audits ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate() {
    if (!form.name || !form.organization || !form.framework) return
    setCreating(true)
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      router.push(`/audits/${data.audit.id}`)
    } finally {
      setCreating(false)
    }
  }

  function getComplianceScore(a: AuditSummary) {
    if (a.questionCount === 0) return null
    return Math.round(((a.passCount + a.partialCount * 0.5) / a.questionCount) * 100)
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Audits</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and track your compliance audit preparations
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New Audit
        </Button>
      </div>

      {/* Audit list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl border bg-white animate-pulse" />
          ))}
        </div>
      ) : audits.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-slate-700 mb-1">No audits yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first audit to start preparing for compliance reviews
            </p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              New Audit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {audits.map((audit) => {
            const cfg = STATUS_CONFIG[audit.status] ?? STATUS_CONFIG.idle
            const score = getComplianceScore(audit)
            return (
              <Card
                key={audit.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/audits/${audit.id}`)}
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800 truncate">{audit.name}</h3>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {audit.organization}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {audit.targetDate
                          ? new Date(audit.targetDate).toLocaleDateString()
                          : "No date set"}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {audit.framework}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    {audit.questionCount > 0 && (
                      <div className="text-center">
                        {score !== null ? (
                          <>
                            <p className="text-2xl font-bold text-slate-800">{score}%</p>
                            <p className="text-xs text-muted-foreground">Compliance</p>
                          </>
                        ) : (
                          <>
                            <p className="text-2xl font-bold text-slate-800">{audit.questionCount}</p>
                            <p className="text-xs text-muted-foreground">Questions</p>
                          </>
                        )}
                      </div>
                    )}
                    {score !== null && (
                      <div className="flex gap-3 text-xs">
                        <span className="flex items-center gap-1 text-emerald-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          {audit.passCount} pass
                        </span>
                        <span className="flex items-center gap-1 text-red-700">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          {audit.failCount} fail
                        </span>
                      </div>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Audit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Audit Name *</Label>
              <Input
                placeholder="e.g. Q2 2026 HIPAA Readiness Review"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Organization *</Label>
              <Input
                placeholder="e.g. Lakewood Regional Medical Center"
                value={form.organization}
                onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Compliance Framework *</Label>
              <Select
                value={form.framework}
                onValueChange={(v) => setForm((f) => ({ ...f, framework: v as ComplianceFramework }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select framework..." />
                </SelectTrigger>
                <SelectContent>
                  {FRAMEWORKS.map((fw) => (
                    <SelectItem key={fw} value={fw}>{fw}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Target Audit Date</Label>
              <Input
                type="date"
                value={form.targetDate}
                onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any additional context..."
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !form.name || !form.organization || !form.framework}
            >
              {creating ? "Creating..." : "Create Audit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
