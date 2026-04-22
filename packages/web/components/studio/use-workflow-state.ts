'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { openNativeDesktopPath } from '@/components/studio/native-desktop-bridge';
import {
  type WorkflowAction,
  type WorkflowDiagnostic,
  type WorkflowResultHistoryEntry,
  type WorkflowSuccess,
  WORKFLOW_RESULT_HISTORY_LIMIT,
  WORKFLOW_STAGE_HINT_DELAY_MS,
  clearStoredWorkflowResult,
  describeWorkflowError,
  formatWorkflowActionLabel,
  formatWorkflowElapsed,
  formatWorkflowResolvedAt,
  getWorkflowStageHint,
  readStoredWorkflowResults,
  writeStoredWorkflowResults,
} from '@/components/studio/local-studio-utils';

export type UseWorkflowStateReturn = {
  // State
  workflowBusy: WorkflowAction | null;
  setWorkflowBusy: Dispatch<SetStateAction<WorkflowAction | null>>;
  workflowMessage: string | null;
  setWorkflowMessage: Dispatch<SetStateAction<string | null>>;
  workflowError: string | null;
  setWorkflowError: Dispatch<SetStateAction<string | null>>;
  workflowSuccess: WorkflowSuccess | null;
  setWorkflowSuccess: Dispatch<SetStateAction<WorkflowSuccess | null>>;
  workflowResultAction: WorkflowAction | null;
  setWorkflowResultAction: Dispatch<SetStateAction<WorkflowAction | null>>;
  workflowStartedAt: number | null;
  setWorkflowStartedAt: Dispatch<SetStateAction<number | null>>;
  workflowAction: WorkflowAction;
  setWorkflowAction: Dispatch<SetStateAction<WorkflowAction>>;
  workflowMenuOpen: boolean;
  setWorkflowMenuOpen: Dispatch<SetStateAction<boolean>>;
  workflowHistory: WorkflowResultHistoryEntry[];
  // Refs
  workflowMenuRef: React.RefObject<HTMLDivElement | null>;
  previewWindowRef: React.RefObject<Window | null>;
  // Derived
  workflowBusyLabel: string | null;
  workflowElapsedLabel: string | null;
  workflowStageHint: { title: string; detail: string } | null;
  showWorkflowStageHint: boolean;
  workflowResolvedLabel: string | null;
  workflowErrorDiagnostic: WorkflowDiagnostic | null;
  workflowHistoryEntries: WorkflowResultHistoryEntry[];
  // Callbacks
  clearWorkflowResult: (targetProjectId?: string, options?: { clearHistory?: boolean }) => void;
  persistWorkflowResult: (action: WorkflowAction, result: { success?: WorkflowSuccess | null; error?: string | null }) => void;
  handleOpenWorkflowArtifactRoot: () => Promise<void>;
  handleOpenWorkflowPreview: () => void;
};

export function useWorkflowState(projectId: string): UseWorkflowStateReturn {
  const [workflowBusy, setWorkflowBusy] = useState<WorkflowAction | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowSuccess, setWorkflowSuccess] = useState<WorkflowSuccess | null>(null);
  const [workflowResultAction, setWorkflowResultAction] = useState<WorkflowAction | null>(null);
  const [workflowResolvedAt, setWorkflowResolvedAt] = useState<string | null>(null);
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowResultHistoryEntry[]>([]);
  const [workflowStartedAt, setWorkflowStartedAt] = useState<number | null>(null);
  const [workflowElapsedMs, setWorkflowElapsedMs] = useState(0);
  const [workflowAction, setWorkflowAction] = useState<WorkflowAction>('preview');
  const [workflowMenuOpen, setWorkflowMenuOpen] = useState(false);

  const workflowMenuRef = useRef<HTMLDivElement | null>(null);
  const previewWindowRef = useRef<Window | null>(null);

  // Elapsed timer while a workflow is running. Synchronously setting 0 is avoided;
  // derived labels below are already gated on `workflowBusy`, so a stale value is
  // never rendered once the workflow stops.
  useEffect(() => {
    if (!workflowBusy || workflowStartedAt === null) {
      return;
    }

    const updateElapsed = () => {
      setWorkflowElapsedMs(Date.now() - workflowStartedAt);
    };

    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(intervalId);
  }, [workflowBusy, workflowStartedAt]);

  // Restore workflow history from session storage when project changes.
  // Hydrating React state from external storage is a legitimate effect use;
  // setters are wrapped in helpers to stay out of the raw effect body.
  useEffect(() => {
    if (!projectId) {
      return;
    }

    const resetWorkflowState = () => {
      setWorkflowMessage(null);
      setWorkflowError(null);
      setWorkflowSuccess(null);
      setWorkflowResultAction(null);
      setWorkflowResolvedAt(null);
      setWorkflowHistory([]);
    };

    const applyStored = (stored: WorkflowResultHistoryEntry[]) => {
      const latest = stored[0];
      setWorkflowHistory(stored);
      setWorkflowResultAction(latest.action);
      setWorkflowResolvedAt(latest.resolvedAt);
      setWorkflowSuccess(latest.success);
      setWorkflowError(latest.error);
      setWorkflowMessage(latest.success?.message ?? null);
    };

    const stored = readStoredWorkflowResults(projectId);
    if (!stored.length) {
      resetWorkflowState();
      return;
    }

    applyStored(stored);
  }, [projectId]);

  // Close workflow menu on outside click or Escape
  useEffect(() => {
    if (!workflowMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || workflowMenuRef.current?.contains(target)) {
        return;
      }
      setWorkflowMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setWorkflowMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [workflowMenuOpen]);

  const clearWorkflowResult = useCallback(
    (targetProjectId?: string, options?: { clearHistory?: boolean }) => {
      const nextProjectId = targetProjectId ?? projectId;
      setWorkflowMessage(null);
      setWorkflowError(null);
      setWorkflowSuccess(null);
      setWorkflowResultAction(null);
      setWorkflowResolvedAt(null);
      if (options?.clearHistory) {
        setWorkflowHistory([]);
      }
      if (nextProjectId && options?.clearHistory) {
        clearStoredWorkflowResult(nextProjectId);
      }
    },
    [projectId],
  );

  const persistWorkflowResult = useCallback(
    (nextAction: WorkflowAction, result: { success?: WorkflowSuccess | null; error?: string | null }) => {
      const nextEntry: WorkflowResultHistoryEntry = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        resolvedAt: new Date().toISOString(),
        action: nextAction,
        success: result.success ?? null,
        error: result.error ?? null,
      };
      setWorkflowResultAction(nextAction);
      setWorkflowResolvedAt(nextEntry.resolvedAt);
      setWorkflowHistory((current) => {
        const nextHistory = [nextEntry, ...current].slice(0, WORKFLOW_RESULT_HISTORY_LIMIT);
        writeStoredWorkflowResults(projectId, nextHistory);
        return nextHistory;
      });
    },
    [projectId],
  );

  const handleOpenWorkflowArtifactRoot = useCallback(async () => {
    if (workflowSuccess?.type !== 'build') {
      return;
    }
    const opened = await openNativeDesktopPath(workflowSuccess.artifactRoot);
    if (!opened) {
      setWorkflowError('Desktop path opener is unavailable in this runtime.');
    }
  }, [workflowSuccess]);

  const handleOpenWorkflowPreview = useCallback(() => {
    if (workflowSuccess?.type !== 'preview') {
      return;
    }
    const existingPreviewWindow = previewWindowRef.current;
    if (existingPreviewWindow && !existingPreviewWindow.closed) {
      existingPreviewWindow.location.href = workflowSuccess.previewUrl;
      existingPreviewWindow.focus();
      return;
    }
    previewWindowRef.current = window.open(workflowSuccess.previewUrl, '_blank');
  }, [workflowSuccess]);

  // Derived display values
  const workflowBusyLabel = workflowBusy ? formatWorkflowActionLabel(workflowBusy) : null;
  const workflowElapsedLabel = workflowBusy ? formatWorkflowElapsed(workflowElapsedMs) : null;
  const workflowStageHint = workflowBusy ? getWorkflowStageHint(workflowBusy, workflowElapsedMs) : null;
  const showWorkflowStageHint = workflowBusy !== null && workflowElapsedMs >= WORKFLOW_STAGE_HINT_DELAY_MS;
  const workflowResolvedLabel = workflowResolvedAt ? formatWorkflowResolvedAt(workflowResolvedAt) : null;
  const workflowErrorDiagnostic = workflowError
    ? describeWorkflowError(workflowResultAction ?? workflowAction, workflowError)
    : null;
  const workflowHistoryEntries = workflowHistory.slice(1);

  return {
    workflowBusy,
    setWorkflowBusy,
    workflowMessage,
    setWorkflowMessage,
    workflowError,
    setWorkflowError,
    workflowSuccess,
    setWorkflowSuccess,
    workflowResultAction,
    setWorkflowResultAction,
    workflowStartedAt,
    setWorkflowStartedAt,
    workflowAction,
    setWorkflowAction,
    workflowMenuOpen,
    setWorkflowMenuOpen,
    workflowHistory,
    workflowMenuRef,
    previewWindowRef,
    workflowBusyLabel,
    workflowElapsedLabel,
    workflowStageHint,
    showWorkflowStageHint,
    workflowResolvedLabel,
    workflowErrorDiagnostic,
    workflowHistoryEntries,
    clearWorkflowResult,
    persistWorkflowResult,
    handleOpenWorkflowArtifactRoot,
    handleOpenWorkflowPreview,
  };
}
