'use client';

import { FilePlus2, FolderOpen, Loader2, Trash2 } from 'lucide-react';
import { useState, type CSSProperties } from 'react';

import { LocalChip } from '@/lib/desktop-shell';
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

/**
 * WelcomeScreen — first-launch project picker, restyled to the Claude Design
 * desktop handoff vocabulary (Anydocs Desktop · v1.0). Token-only styling:
 * warm neutrals (`--n-*`), near-black primary `.btn`, brand-gradient logo and
 * mono paths — matching the rest of the migrated Studio shell. The radial
 * backdrop mirrors the handoff `DesktopBG`.
 */
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

  const tallButton: CSSProperties = {
    width: '100%',
    height: 42,
    justifyContent: 'center',
    fontSize: 13.5,
    borderRadius: 'var(--r-8)',
  };

  return (
    <div
      className="ax"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        background:
          'radial-gradient(120% 80% at 50% 0%, oklch(0.985 0.005 80), oklch(0.945 0.006 80) 70%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--n-0)',
          border: '1px solid var(--n-200)',
          borderRadius: 'var(--r-16)',
          boxShadow: 'var(--sh-3)',
          padding: '32px 28px 24px',
        }}
      >
        {/* Brand mark + title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, var(--brand-500), var(--brand-700))',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 700,
              boxShadow: 'var(--sh-1)',
              marginBottom: 4,
            }}
          >
            A
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--t-20)',
              fontWeight: 700,
              color: 'var(--n-900)',
              letterSpacing: '-0.01em',
            }}
          >
            Anydocs Studio
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--t-13)', color: 'var(--n-500)', lineHeight: 1.5 }}>
            Open an existing docs project or create a new local one.
          </p>
          <div style={{ marginTop: 2 }}>
            <LocalChip />
          </div>
        </div>

        {/* Primary actions */}
        {allowExternalProjectOpen ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
            {allowProjectCreate ? (
              <button
                type="button"
                className="btn primary"
                style={tallButton}
                onClick={() => setIsCreateProjectDialogOpen(true)}
                disabled={isOpeningFolder}
                data-testid="studio-create-project-button"
              >
                <FilePlus2 className="size-4" />
                New Project
              </button>
            ) : null}
            <button
              type="button"
              className="btn"
              style={tallButton}
              onClick={() => {
                if (supportsNativeDirectoryPicker) {
                  void onOpenProject();
                  return;
                }

                setIsProjectPathDialogOpen(true);
              }}
              disabled={isOpeningFolder}
              data-testid="studio-open-project-button"
            >
              {isOpeningFolder ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Opening…
                </>
              ) : (
                <>
                  <FolderOpen className="size-4" />
                  Open Project
                </>
              )}
            </button>
          </div>
        ) : (
          <div
            style={{
              marginTop: 24,
              borderRadius: 'var(--r-8)',
              border: '1px solid var(--n-200)',
              background: 'var(--n-50)',
              padding: '12px 14px',
              fontSize: 'var(--t-13)',
              color: 'var(--n-500)',
              lineHeight: 1.5,
            }}
          >
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

        {/* Recent projects */}
        {allowRecentProjects && recentProjects.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--n-400)',
                padding: '0 2px 8px',
              }}
            >
              Recent Projects
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentProjects.map((project) => (
                <RecentProjectRow
                  key={project.id}
                  project={project}
                  onSelect={() => onSelectProject(project)}
                  onRemove={() => onRemoveProject(project)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RecentProjectRow({
  project,
  onSelect,
  onRemove,
}: {
  project: StudioProject;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const [hover, setHover] = useState(false);
  const displayPath = project.path.replace(/^\/Users\/[^/]+/, '~');
  const initial = (project.name.trim()[0] ?? 'A').toUpperCase();

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 8px 8px 9px',
        borderRadius: 'var(--r-8)',
        border: '1px solid var(--n-200)',
        background: hover ? 'var(--n-100)' : 'var(--n-50)',
        transition: 'background 120ms var(--ease)',
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        style={{
          display: 'flex',
          minWidth: 0,
          flex: 1,
          alignItems: 'center',
          gap: 10,
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            flex: 'none',
            borderRadius: 6,
            background: 'linear-gradient(135deg, var(--brand-500), var(--brand-700))',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--t-13)',
              fontWeight: 500,
              color: 'var(--n-900)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {project.name}
          </div>
          <div
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--n-500)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: 1,
            }}
          >
            {displayPath}
          </div>
        </div>
      </button>
      <button
        type="button"
        className="btn ghost sm"
        style={{
          width: 28,
          height: 28,
          padding: 0,
          justifyContent: 'center',
          flex: 'none',
          opacity: hover ? 1 : 0.45,
        }}
        onClick={onRemove}
        title="Remove from history"
        aria-label={`Remove ${project.name} from history`}
        data-testid={`studio-remove-recent-project-${project.id}`}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
