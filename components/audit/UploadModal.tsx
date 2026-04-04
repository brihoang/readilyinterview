"use client";

import { Upload, FileText } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function UploadModal({
  open,
  onOpenChange,
  file,
  getRootProps,
  getInputProps,
  isDragActive,
  onProcess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  file: File | null;
  getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
  getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
  isDragActive: boolean;
  onProcess: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Questionnaire</DialogTitle>
          <DialogDescription>
            Upload your audit questionnaire PDF to extract compliance questions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50",
            )}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-700">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">{file.name}</span>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  {isDragActive
                    ? "Drop the PDF here"
                    : "Drag & drop a PDF, or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF files only
                </p>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              Google Drive URL
              <Badge variant="secondary" className="text-xs font-normal">
                Coming soon
              </Badge>
            </Label>
            <Input
              disabled
              placeholder="https://docs.google.com/..."
              className="opacity-50 cursor-not-allowed"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onProcess} disabled={!file}>
            Process Questionnaire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
