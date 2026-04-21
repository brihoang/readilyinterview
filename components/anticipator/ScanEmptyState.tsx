"use client";

import { Radar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScanEmptyStateProps {
  onScan: () => void;
  scanning: boolean;
}

export function ScanEmptyState({ onScan, scanning }: ScanEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="rounded-full bg-primary/10 p-4 mb-4">
        <Radar className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-1">
        No regulations scanned yet
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Scan the Federal Register for recently proposed and finalized rules from
        HHS and CMS that may require new or updated internal policies.
      </p>
      <Button onClick={onScan} disabled={scanning}>
        {scanning ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Scanning…
          </>
        ) : (
          <>
            <Radar className="h-4 w-4 mr-2" />
            Scan for Regulations
          </>
        )}
      </Button>
    </div>
  );
}
