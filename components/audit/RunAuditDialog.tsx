"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function RunAuditDialog({
  open,
  onOpenChange,
  onRun,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRun: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Run Audit?</DialogTitle>
          <DialogDescription>
            The AI will evaluate each question against your policy library. This
            may take a few minutes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Save for Later
          </Button>
          <Button onClick={onRun}>Run Now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
