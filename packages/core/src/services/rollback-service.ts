import { DomainError, type DomainErrorDetails } from '../errors/domain-error.ts';
import { ValidationError } from '../errors/validation-error.ts';
import type { AuditActor, AuditEntry } from '../types/audit.ts';
import { findAuditEntry, runWriteAhead, type WriteAheadResult } from './audit-log-service.ts';

/**
 * Rollback service (Story 10.5). Re-applies a committed Agent operation's
 * pre-change snapshot and persists a new `operation: 'rollback'` audit entry
 * referencing the original — itself through the write-ahead lifecycle (10.3),
 * so the rollback is fully audited. See architecture.md §"Rollback".
 *
 * Content re-application is delegated to a host-supplied callback: `@anydocs/core`
 * stays decoupled from the concrete content repositories (the architecture's
 * "re-apply through content-repository.write()" is realized by `applyRollback`,
 * wired by Epic 11's agent-service).
 */

/** Machine-branchable reasons a rollback cannot proceed. */
export type RollbackErrorCode = 'ROLLBACK_NOT_COMMITTED' | 'ROLLBACK_NO_SNAPSHOT';

/**
 * Thrown when the referenced entry exists but is not rollbackable (not committed,
 * or has no captured pre-change snapshot). Distinct from `ValidationError`, which
 * is thrown when the entry id was never persisted at all.
 */
export class RollbackNotApplicableError extends DomainError {
  constructor(code: RollbackErrorCode, message: string, details: DomainErrorDetails) {
    super(code, message, details);
    this.name = 'RollbackNotApplicableError';
  }
}

export type RollbackOptions = {
  /**
   * Re-applies the original entry's pre-change snapshot to content. The host
   * wires the concrete `content-repository` write here (Epic 11). Receives the
   * `diff.before` snapshot and the original audit entry (for `target` routing).
   */
  applyRollback: (snapshot: unknown, original: AuditEntry) => Promise<void>;
  /** Id for the new rollback audit entry — producer-supplied (core has no ULID generator). */
  rollbackEntryId: string;
  /** Timestamp for the rollback entry; defaults to now (ISO). Overridable for deterministic tests. */
  timestamp?: string;
  /**
   * Actor for the rollback entry. Defaults to `{ kind: 'system' }` — a rollback is
   * a tool-initiated recovery, NOT a re-run by the original actor, so it must not
   * impersonate the original (often an agent). Pass the initiating human/agent
   * when the host knows it.
   */
  actor?: AuditActor;
};

/**
 * Roll a committed audit entry back to its pre-change snapshot. Refuses
 * non-committed / snapshot-less entries WITHOUT touching content (no callback,
 * no pending record). Persists the rollback through `runWriteAhead`.
 */
export async function rollback(
  auditRoot: string,
  entryId: string,
  options: RollbackOptions,
): Promise<WriteAheadResult<void>> {
  const original = await findAuditEntry(auditRoot, entryId);
  if (!original) {
    throw new ValidationError(`No audit entry found for id "${entryId}".`, {
      entity: 'audit-entry',
      rule: 'audit-entry-must-exist-for-rollback',
      remediation: 'Roll back only an entry id that was previously persisted to the audit log.',
      metadata: { entryId },
    });
  }
  if (original.status !== 'committed') {
    throw new RollbackNotApplicableError(
      'ROLLBACK_NOT_COMMITTED',
      `Cannot roll back audit entry "${entryId}" with status "${original.status}" — only committed entries are rollbackable.`,
      {
        entity: 'audit-entry',
        rule: 'rollback-requires-committed-entry',
        remediation: 'Only committed operations can be rolled back; pending/rejected entries made no durable change.',
        metadata: { entryId, status: original.status },
      },
    );
  }
  if (original.diff?.before === undefined) {
    throw new RollbackNotApplicableError(
      'ROLLBACK_NO_SNAPSHOT',
      `Audit entry "${entryId}" has no captured pre-change snapshot (diff.before) to restore.`,
      {
        entity: 'audit-entry',
        rule: 'rollback-requires-pre-change-snapshot',
        remediation: 'Rollback needs the original operation to have recorded its diff.before snapshot.',
        metadata: { entryId },
      },
    );
  }

  const snapshot = original.diff.before;
  const rollbackEntry: AuditEntry = {
    schemaVersion: original.schemaVersion,
    id: options.rollbackEntryId,
    timestamp: options.timestamp ?? new Date().toISOString(),
    scope: original.scope,
    operation: 'rollback',
    status: 'pending', // runWriteAhead re-forces pending; explicit for clarity
    projectId: original.projectId,
    target: original.target,
    // A rollback is a tool-initiated recovery — default to 'system' rather than
    // impersonating the original actor; the host overrides when the initiator is known.
    actor: options.actor ?? { kind: 'system' },
    runtimeMode: original.runtimeMode,
    rollbackOf: entryId,
    diff: {
      before: original.diff.after,
      after: snapshot,
      summary: `Rollback of ${entryId}`,
    },
  };

  return runWriteAhead(auditRoot, rollbackEntry, async () => {
    await options.applyRollback(snapshot, original);
  });
}
