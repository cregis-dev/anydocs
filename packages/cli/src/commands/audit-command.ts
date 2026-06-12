import {
  isRuntimeMode,
  loadProjectContract,
  pruneAuditShards,
  resolveRuntimeMode,
  type RuntimeMode,
} from '@anydocs/core';

import { error, info } from '../output/logger.ts';
import { writeJsonError, writeJsonSuccess } from '../output/structured.ts';
import { resolveRepoRoot } from './read-command-helpers.ts';

type AuditPruneCommandOptions = {
  targetDir?: string;
  json?: boolean;
  retentionDays?: number;
};

/**
 * Resolve the runtime mode for the prune's system audit entry. A bare CLI/node
 * process can't probe a mode, so honor a valid `ANYDOCS_RUNTIME_MODE` env and
 * otherwise inject `'web'` (a CLI/local prune is a web-mode operation). Goes
 * through the core resolver — no inline literal comparison (Story 8.2 guard).
 */
function resolveCliRuntimeMode(): RuntimeMode {
  const fromEnv = process.env.ANYDOCS_RUNTIME_MODE;
  return resolveRuntimeMode(isRuntimeMode(fromEnv) ? {} : { injectedMode: 'web' });
}

export async function runAuditPruneCommand(options: AuditPruneCommandOptions = {}): Promise<number> {
  const repoRoot = resolveRepoRoot(options.targetDir);
  const contractResult = await loadProjectContract(repoRoot);
  if (!contractResult.ok) {
    if (options.json) {
      writeJsonError('audit prune', contractResult.error, { repoRoot });
    } else {
      error(`Audit prune failed: ${contractResult.error.message}`);
      error(`Rule: ${contractResult.error.details.rule}`);
      if (contractResult.error.details.remediation) {
        error(`Fix: ${contractResult.error.details.remediation}`);
      }
    }
    return 1;
  }

  const contract = contractResult.value;
  try {
    const result = await pruneAuditShards(contract.paths.auditRoot, {
      projectId: contract.config.projectId,
      runtimeMode: resolveCliRuntimeMode(),
      ...(options.retentionDays !== undefined ? { retentionDays: options.retentionDays } : {}),
    });

    if (options.json) {
      writeJsonSuccess('audit prune', result, {
        projectId: contract.config.projectId,
        repoRoot,
      });
    } else if (result.prunedDates.length === 0) {
      info(`No audit shards older than ${result.retentionDays} days (cutoff ${result.cutoff}); nothing pruned.`);
    } else {
      info(`Pruned ${result.prunedDates.length} audit shard(s) older than ${result.retentionDays} days (cutoff ${result.cutoff}):`);
      for (const date of result.prunedDates) {
        info(`  - ${date}`);
      }
      info(`Recorded system audit entry ${result.auditEntryId}.`);
    }

    return 0;
  } catch (caughtError: unknown) {
    if (options.json) {
      writeJsonError('audit prune', caughtError, { repoRoot });
    } else {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      error(`Audit prune failed: ${message}`);
    }
    return 1;
  }
}
