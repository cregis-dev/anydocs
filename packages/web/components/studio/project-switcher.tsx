'use client';

import { Check, ChevronsUpDown, Folder, Trash2, Loader2, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  hasNativeDirectoryPicker,
  normalizeAbsoluteProjectPath,
  pickNativeProjectPath,
  type StudioProject,
  loadProjectsFromStorage,
  registerRecentProject,
  saveProjectsToStorage,
} from '@/components/studio/project-registry';
import { ProjectPathDialog } from '@/components/studio/project-path-dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ProjectSwitcherProps {
  currentProjectId: string;
  onProjectChange: (projectId: string) => void;
  allowProjectCreate?: boolean;
  onProjectCreate?: (projectPath: string) => Promise<void> | void;
}

export function ProjectSwitcher({
  currentProjectId,
  onProjectChange,
  allowProjectCreate = false,
  onProjectCreate,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [isProjectPathDialogOpen, setIsProjectPathDialogOpen] = useState(false);
  const [projectPathDialogMode, setProjectPathDialogMode] = useState<'open' | 'create'>('open');

  useEffect(() => {
    setMounted(true);
    setProjects(loadProjectsFromStorage());
  }, []);

  const loadProjects = useCallback(async () => {
    setProjects(loadProjectsFromStorage());
  }, []);

  useEffect(() => {
    if (open) {
      loadProjects();
    }
  }, [open, loadProjects]);

  const handleProjectPathSelection = useCallback(async (projectPath: string) => {
    if (projectPathDialogMode === 'create') {
      if (!onProjectCreate) {
        throw new Error('Create Project is not available in this Studio runtime.');
      }

      await onProjectCreate(projectPath);
      setProjects(loadProjectsFromStorage());
      return;
    }

    const { current, projects: updated } = registerRecentProject(projects, normalizeAbsoluteProjectPath(projectPath));
    saveProjectsToStorage(updated);
    setProjects(updated);
    onProjectChange(current.id);
  }, [onProjectChange, onProjectCreate, projectPathDialogMode, projects]);

  const handleSelectFolder = async () => {
    if (isSelectingFolder) return;
    setIsSelectingFolder(true);
    setOpen(false);

    try {
      if (!hasNativeDirectoryPicker()) {
        setProjectPathDialogMode('open');
        setIsProjectPathDialogOpen(true);
        return;
      }

      const projectPath = await pickNativeProjectPath();
      if (!projectPath) {
        return;
      }

      await handleProjectPathSelection(projectPath);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        alert(e instanceof Error ? e.message : 'Failed to open folder');
      }
    } finally {
      setIsSelectingFolder(false);
    }
  };

  const handleCreateProject = () => {
    setProjectPathDialogMode('create');
    setOpen(false);
    setIsProjectPathDialogOpen(true);
  };

  const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    const updated = projects.filter(p => p.id !== projectId);
    saveProjectsToStorage(updated);
    setProjects(updated);
  };

  const handleProjectSelect = (project: StudioProject) => {
    const updated = projects.map(p => 
      p.id === project.id 
        ? { ...p, lastOpened: Date.now() }
        : p
    ).sort((a, b) => b.lastOpened - a.lastOpened);
    saveProjectsToStorage(updated);
    setProjects(updated);
    onProjectChange(project.id);
    setOpen(false);
  };

  if (!mounted) {
    return (
      <Button
        variant="secondary"
        role="combobox"
        className="w-[200px] justify-between"
      >
        <Folder className="mr-2 size-4 opacity-50" />
        <span className="truncate">{currentProjectId || 'Select Project'}</span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  const currentProject = projects.find(p => p.id === currentProjectId);
  const displayName = currentProject?.name || currentProjectId || 'Select Project';

  return (
    <>
      <ProjectPathDialog
        open={isProjectPathDialogOpen}
        onOpenChange={setIsProjectPathDialogOpen}
        onSubmit={handleProjectPathSelection}
        title={projectPathDialogMode === 'create' ? 'Create Project' : 'Open External Project'}
        description={
          projectPathDialogMode === 'create'
            ? 'Enter the absolute path for a new Anydocs project.'
            : 'Enter the absolute path to your docs project root.'
        }
        submitLabel={projectPathDialogMode === 'create' ? 'Create Project' : 'Open Project'}
        fieldHelp={
          projectPathDialogMode === 'create'
            ? 'Use an absolute path for an empty directory or a directory without anydocs.config.json.'
            : 'Use an absolute path that contains `anydocs.config.json`.'
        }
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            role="combobox"
            aria-expanded={open}
            className="w-[200px] justify-between"
          >
            <Folder className="mr-2 size-4 opacity-50" />
            <span className="truncate">{displayName}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0">
          <Command>
            <CommandInput placeholder="Search project..." />
            <CommandList>
              <CommandEmpty>No project found.</CommandEmpty>
              <CommandGroup heading="Recent Projects">
                {projects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={project.name}
                    onSelect={() => handleProjectSelect(project)}
                    className="group"
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        currentProjectId === project.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 flex flex-col min-w-0">
                      <span className="truncate">{project.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{project.path}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteProject(e, project.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive hover:text-destructive-foreground rounded transition-opacity"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                {allowProjectCreate ? (
                  <CommandItem
                    onSelect={handleCreateProject}
                    disabled={!onProjectCreate}
                    data-testid="studio-project-switcher-create-project-button"
                  >
                    <Plus className="mr-2 size-4" />
                    New Project
                  </CommandItem>
                ) : null}
                <CommandItem onSelect={handleSelectFolder} disabled={isSelectingFolder}>
                  {isSelectingFolder ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Folder className="mr-2 size-4" />
                  )}
                  Open External Project
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
