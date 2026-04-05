import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  ANYDOCS_CONFIG_FILE,
  assertValidProjectId,
  resolveProjectRoot,
} from '../config/project-config.ts';
import { validateProjectConfig } from '../schemas/project-schema.ts';
import { createProjectPathContract } from '../fs/project-paths.ts';
import type {
  WorkflowStandardDefinition,
  WorkflowSyncDiffEntry,
  WorkflowSyncResult,
} from '../types/workflow-standard.ts';
import type { ProjectContract } from '../types/project.ts';
import { createWorkflowStandardDefinition } from './workflow-standard-service.ts';
import { ValidationError } from '../errors/validation-error.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diffWorkflowValues(
  pathName: string,
  expected: unknown,
  received: unknown,
  out: WorkflowSyncDiffEntry[],
) {
  if (isEqual(expected, received)) {
    return;
  }

  if (isRecord(expected) && isRecord(received)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(received)]);
    for (const key of [...keys].sort()) {
      const nextPath = pathName ? `${pathName}.${key}` : key;
      const nextExpected = expected[key];
      const nextReceived = received[key];

      if (!(key in expected)) {
        out.push({
          path: nextPath,
          action: 'remove',
          received: nextReceived,
        });
        continue;
      }

      if (!(key in received)) {
        out.push({
          path: nextPath,
          action: 'add',
          expected: nextExpected,
        });
        continue;
      }

      diffWorkflowValues(nextPath, nextExpected, nextReceived, out);
    }
    return;
  }

  out.push({
    path: pathName || '$',
    action:
      expected === undefined
        ? 'remove'
        : received === undefined
          ? 'add'
          : 'replace',
    ...(expected !== undefined ? { expected } : {}),
    ...(received !== undefined ? { received } : {}),
  });
}

function sortDiffEntries(diff: WorkflowSyncDiffEntry[]): WorkflowSyncDiffEntry[] {
  return [...diff].sort((left, right) => left.path.localeCompare(right.path));
}

async function readPersistedWorkflow(filePath: string): Promise<unknown> {
  const rawWorkflow = await readFile(filePath, 'utf8');

  try {
    return JSON.parse(rawWorkflow) as unknown;
  } catch (error: unknown) {
    throw new ValidationError(`Workflow standard at "${filePath}" is not valid JSON.`, {
      entity: 'workflow-standard-file',
      rule: 'workflow-standard-json-valid',
      remediation: 'Fix anydocs.workflow.json so it contains valid JSON before syncing the workflow contract.',
      metadata: {
        workflowFile: filePath,
        cause: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

async function ensureExists(targetPath: string, entity: string, remediation: string) {
  try {
    await readFile(targetPath, 'utf8');
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new ValidationError(`Missing required ${entity} at "${targetPath}".`, {
        entity,
        rule: 'required-path-exists',
        remediation,
        metadata: { targetPath },
      });
    }

    throw error;
  }
}

async function readProjectConfigForWorkflowSync(configPath: string): Promise<unknown> {
  const rawConfig = await readFile(configPath, 'utf8');

  try {
    return JSON.parse(rawConfig) as unknown;
  } catch (error: unknown) {
    throw new ValidationError(`Project configuration at "${configPath}" is not valid JSON.`, {
      entity: 'project-config-file',
      rule: 'project-config-json-valid',
      remediation: 'Fix anydocs.config.json so it contains valid JSON before syncing the workflow contract.',
      metadata: {
        configPath,
        cause: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

async function loadProjectContractForWorkflowSync(
  repoRoot: string,
  projectId?: string,
): Promise<ProjectContract> {
  if (projectId) {
    assertValidProjectId(projectId);
  }

  const projectRoot = resolveProjectRoot(repoRoot, projectId);
  const configPath = path.join(projectRoot, ANYDOCS_CONFIG_FILE);
  await ensureExists(
    configPath,
    'project-config-file',
    'Create anydocs.config.json in the canonical project root before syncing the workflow contract.',
  );
  const rawConfig = await readProjectConfigForWorkflowSync(configPath);
  const config = validateProjectConfig(rawConfig);
  if (projectId && config.projectId !== projectId) {
    throw new ValidationError(
      `Project configuration at "${configPath}" declares projectId "${config.projectId}" but the requested project is "${projectId}".`,
      {
        entity: 'project-config',
        rule: 'project-id-matches-requested-project-root',
        remediation:
          'Update anydocs.config.json so projectId matches the canonical project directory, or load the project using the matching projectId.',
        metadata: {
          configPath,
          expectedProjectId: projectId,
          receivedProjectId: config.projectId,
        },
      },
    );
  }

  return {
    config,
    paths: createProjectPathContract(repoRoot, config),
  };
}

async function writeWorkflowDefinition(filePath: string, workflow: WorkflowStandardDefinition): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
}

export async function syncWorkflowStandard(
  repoRoot: string,
  options: { apply?: boolean; projectId?: string } = {},
): Promise<WorkflowSyncResult> {
  const contract = await loadProjectContractForWorkflowSync(repoRoot, options.projectId);
  const workflowFile = contract.paths.workflowFile;
  const persisted = await readPersistedWorkflow(workflowFile);
  const workflow = createWorkflowStandardDefinition(contract);
  const diff: WorkflowSyncDiffEntry[] = [];
  diffWorkflowValues('', workflow, persisted, diff);
  const sortedDiff = sortDiffEntries(diff);

  if (options.apply && sortedDiff.length > 0) {
    await writeWorkflowDefinition(workflowFile, workflow);
  }

  return {
    applied: Boolean(options.apply && sortedDiff.length > 0),
    filePath: workflowFile,
    diff: sortedDiff,
    workflow,
  };
}
