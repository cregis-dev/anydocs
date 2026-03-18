'use client';

import { Check, ChevronsUpDown, Folder, Trash2, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  type StudioProject,
  loadProjectsFromStorage,
  pickExternalProjectPath,
  registerRecentProject,
  saveProjectsToStorage,
} from '@/components/studio/project-registry';
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
}

export function ProjectSwitcher({ currentProjectId, onProjectChange }: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);

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

  const handleSelectFolder = async () => {
    if (isSelectingFolder) return;
    setIsSelectingFolder(true);
    setOpen(false);

    try {
      const projectPath = await pickExternalProjectPath();
      if (!projectPath) {
        return;
      }

      const { current, projects: updated } = registerRecentProject(projects, projectPath);
      saveProjectsToStorage(updated);
      setProjects(updated);
      onProjectChange(current.id);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        alert(e instanceof Error ? e.message : 'Failed to open folder');
      }
    } finally {
      setIsSelectingFolder(false);
    }
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
