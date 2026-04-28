import path from 'node:path';

import { convertImportedLegacyContent, ValidationError } from '@anydocs/core';

import { formatCliCommand } from '../help.ts';
import { error, info } from '../output/logger.ts';
import { writeJsonError, writeJsonSuccess } from '../output/structured.ts';

type ConvertImportCommandOptions = {
  importId?: string;
  targetDir?: string;
  json?: boolean;
};

export async function runConvertImportCommand(options: ConvertImportCommandOptions): Promise<number> {
  if (!options.importId) {
    if (options.json) {
      writeJsonError('convert-import', new Error('Convert import failed: missing import id.'));
      return 1;
    }
    error('Convert import failed: missing import id.');
    error('Usage: anydocs convert-import <importId> [targetDir]');
    return 1;
  }

  const repoRoot = path.resolve(process.cwd(), options.targetDir ?? '.');

  try {
    const result = await convertImportedLegacyContent({
      repoRoot,
      importId: options.importId,
    });

    if (options.json) {
      writeJsonSuccess(
        'convert-import',
        {
          convertedCount: result.convertedCount,
          importRoot: result.importRoot,
          reportFile: result.reportFile,
          items: result.items,
        },
        {
          repoRoot,
          importId: options.importId,
        },
      );
      return 0;
    }

    info(`Converted ${result.convertedCount} staged documents into canonical draft pages.`);
    info(`Import root: ${result.importRoot}`);
    info(`Report: ${result.reportFile}`);
    for (const item of result.items) {
      info(`- ${item.lang}:${item.slug} -> ${item.pageId} (${item.status})`);
      for (const warning of item.warnings) {
        info(`  warning: ${warning.code} - ${warning.message}`);
      }
    }
    info('Next:');
    info('- Review the generated draft pages and publish the ones you want to ship.');
    info(`- ⚠ All ${result.convertedCount} converted page(s) require review approval before appearing in build output.`);
    info('  In Studio: open the page menu (⋮) → Approve, or change status to Published then approve.');
    info(
      `- After approving and publishing, rebuild the site: ${formatCliCommand([
        'build',
        ...(options.targetDir ? [options.targetDir] : []),
      ])}`,
    );
    return 0;
  } catch (caughtError: unknown) {
    if (caughtError instanceof ValidationError) {
      if (options.json) {
        writeJsonError('convert-import', caughtError, { repoRoot, importId: options.importId });
        return 1;
      }
      error(`Convert import failed: ${caughtError.message}`);
      error(`Rule: ${caughtError.details.rule}`);
      if (caughtError.details.remediation) {
        error(`Fix: ${caughtError.details.remediation}`);
      }
      return 1;
    }

    if (options.json) {
      writeJsonError('convert-import', caughtError, { repoRoot, importId: options.importId });
      return 1;
    }
    error(`Convert import failed: ${caughtError instanceof Error ? caughtError.message : String(caughtError)}`);
    return 1;
  }
}
