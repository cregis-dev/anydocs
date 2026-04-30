'use client';

import { FilePlus2, FolderOpen, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ProjectPathDialog } from '@/components/studio/project-path-dialog';
import type { StudioProject } from '@/components/studio/project-registry';

interface WelcomeScreenProps {
  recentProjects: StudioProject[];
  isOpeningFolder: boolean;
  supportsNativeDirectoryPicker: boolean;
  allowExternalProjectOpen: boolean;
  allowRecentProjects: boolean;
  allowProjectCreate: boolean;
  onOpenProject: (projectPath?: string) => Promise<void> | void;
  onCreateProject: (projectPath: string) => Promise<void> | void;
  onSelectProject: (project: StudioProject) => void;
  onRemoveProject: (project: StudioProject) => void;
}

export function WelcomeScreen({
  recentProjects,
  isOpeningFolder,
  supportsNativeDirectoryPicker,
  allowExternalProjectOpen,
  allowRecentProjects,
  allowProjectCreate,
  onOpenProject,
  onCreateProject,
  onSelectProject,
  onRemoveProject,
}: WelcomeScreenProps) {
  const [isProjectPathDialogOpen, setIsProjectPathDialogOpen] = useState(false);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-fd-background text-fd-foreground flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Anydocs Studio</h1>
          <p className="text-fd-muted-foreground">
            Open an existing docs project or create a new local project.
          </p>
        </div>

        {allowExternalProjectOpen ? (
          <div className="space-y-3">
            {allowProjectCreate ? (
              <Button
                onClick={() => setIsCreateProjectDialogOpen(true)}
                disabled={isOpeningFolder}
                className="w-full h-12 text-lg gap-2"
                size="lg"
                data-testid="studio-create-project-button"
              >
                <FilePlus2 className="size-5" />
                New Project
              </Button>
            ) : null}
            <Button
              onClick={() => {
                if (supportsNativeDirectoryPicker) {
                  void onOpenProject();
                  return;
                }

                setIsProjectPathDialogOpen(true);
              }}
              disabled={isOpeningFolder}
              className="w-full h-12 text-lg gap-2"
              size="lg"
              data-testid="studio-open-project-button"
            >
              {isOpeningFolder ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <FolderOpen className="size-5" />
                  Open Project
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-fd-border bg-fd-card px-4 py-3 text-sm text-fd-muted-foreground">
            This Studio session is locked to one project and cannot open another directory.
          </div>
        )}

        {allowExternalProjectOpen ? (
          <ProjectPathDialog
            open={isProjectPathDialogOpen}
            onOpenChange={setIsProjectPathDialogOpen}
            onSubmit={async (projectPath) => {
              await onOpenProject(projectPath);
            }}
          />
        ) : null}

        {allowProjectCreate ? (
          <ProjectPathDialog
            open={isCreateProjectDialogOpen}
            onOpenChange={setIsCreateProjectDialogOpen}
            title="Create Project"
            description="Enter the absolute path for the new docs project root."
            submitLabel="Create Project"
            fieldHelp="Use an empty directory or a new directory path. Existing Anydocs project files will not be overwritten."
            onSubmit={async (projectPath) => {
              await onCreateProject(projectPath);
            }}
          />
        ) : null}

        {allowRecentProjects && recentProjects.length > 0 && (
          <div className="space-y-3 pt-8">
            <h2 className="text-sm font-semibold text-fd-muted-foreground">Recent External Projects</h2>
            <div className="space-y-2">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-2 rounded-lg border border-fd-border p-2 transition-colors hover:bg-fd-accent"
                >
                  <button
                    onClick={() => onSelectProject(project)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left"
                  >
                    <FolderOpen className="size-5 text-fd-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{project.name}</div>
                      <div className="text-xs text-fd-muted-foreground truncate">{project.path}</div>
                    </div>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-fd-muted-foreground hover:text-fd-error"
                    onClick={() => onRemoveProject(project)}
                    title="Remove from history"
                    data-testid={`studio-remove-recent-project-${project.id}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
