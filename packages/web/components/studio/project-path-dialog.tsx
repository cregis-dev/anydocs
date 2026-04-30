"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ProjectPathDialog({
  open,
  onOpenChange,
  onSubmit,
  title = "Open External Project",
  description = "Enter the absolute path to your docs project root.",
  submitLabel = "Open Project",
  fieldHelp = "Use an absolute path that contains `anydocs.config.json`.",
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onSubmit: (projectPath: string) => Promise<void> | void;
  title?: string;
  description?: string;
  submitLabel?: string;
  fieldHelp?: string;
}) {
  const [projectPath, setProjectPath] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setProjectPath("");
      setSubmitting(false);
      setError(null);
    }

    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border-fd-border bg-fd-card p-0">
        <form
          className="grid gap-0"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!projectPath.trim() || submitting) {
              return;
            }

            setSubmitting(true);
            setError(null);
            try {
              await onSubmit(projectPath);
              handleOpenChange(false);
            } catch (submitError) {
              setError(
                submitError instanceof Error
                  ? submitError.message
                  : "Failed to open project",
              );
              setSubmitting(false);
            }
          }}
        >
          <DialogHeader className="border-b border-fd-border px-6 py-5 text-left">
            <DialogTitle className="text-base">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-5">
            <div className="grid gap-2">
              <div className="text-sm font-medium text-fd-foreground">
                Project root path
              </div>
              <Input
                autoFocus
                value={projectPath}
                onChange={(event) => setProjectPath(event.target.value)}
                placeholder="/absolute/path/to/docs-project"
                data-testid="studio-project-path-input"
              />
              <div className="text-xs text-fd-muted-foreground">
                {fieldHelp}
              </div>
            </div>

            {error ? (
              <div
                className="text-sm text-fd-error"
                data-testid="studio-project-path-error"
              >
                {error}
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t border-fd-border px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!projectPath.trim() || submitting}
              data-testid="studio-project-path-submit"
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
